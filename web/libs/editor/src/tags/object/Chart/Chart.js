import { getRoot, types } from 'mobx-state-tree';

import { AnnotationMixin } from '../../../mixins/AnnotationMixin';
import IsReadyMixin from '../../../mixins/IsReadyMixin';
import ProcessAttrsMixin from '../../../mixins/ProcessAttrs';
import { SyncableMixin } from '../../../mixins/Syncable';
import ObjectBase from '../Base';
import {  AudioRegionModel as ChartRegionModel } from '../../../regions/AudioRegion';
// import { ChartRegionModel } from '../../../regions/ChartRegionTs';
import { observe } from 'mobx';

/**
 * Chart tag draws a simple line chart. Used for parquet data visualization.
 *
 * Use with the following data types: parquet
 * @example
 * <!--Labeling configuration to display a Chart on the labeling interface-->
 * <View>
 *   <Chart name="chart" value="$video" />
 * </View>
 * @name Chart
 * @meta_title Chart Tag for Chart Labeling
 * @meta_description Customize Label Studio with the Chart tag for basic line chart drawing from remote api.
 * @param {string} name Name of the element
 * @param {string} value URL of the data source
 * @param {string} [sync] object name to sync with
 */

const TagAttrs = types.model({
  value: types.maybeNull(types.string),
  hotkey: types.maybeNull(types.string),
});

const Model = types
  .model({
    type: 'chart',
    _value: types.optional(types.string, ''),
    // special flag to store labels inside result, but under original type
    // @todo make it able to be disabled
    mergeLabelsAndResults: true,
    playedTime: types.optional(types.number, 0),
    totalDuration: types.optional(types.number, 1024),
    playing: types.optional(types.boolean, false),
    // regions: types.array(ChartRegionModel),
  })
  .volatile(() => ({
    errors: [],
    // ref: React.createRef(),
  }))
  .views(self => ({
    get hasStates() {
      const states = self.states();

      return states && states.length > 0;
    },

    get store() {
      return getRoot(self);
    },

    states() {
      return self.annotation?.toNames.get(self.name) || [];
    },

    activeStates() {
      const states = self.states();

      return states && states.filter(s => getType(s).name === 'LabelsModel' && s.isSelected);
    },

    get activeState() {
      const states = self.states();

      return states && states.filter(s => getType(s).name === 'LabelsModel' && s.isSelected)[0];
    },

    get activeLabel() {
      const state = self.activeState;

      return state?.selectedValues()?.[0];
    },
  }))
  ////// Sync actions
  .actions(self => ({
    ////// Outgoing

    triggerSync(event, data) {
      if (!self._ws) return;

      self.syncSend({
        playing: self._ws.playing,
        time: self._ws.currentTime,
        speed: self._ws.rate,
        ...data,
      }, event);
    },

    triggerSyncSpeed(speed) {
      self.triggerSync('speed', { speed });
    },

    triggerSyncPlay() {
      // @todo should not be handled like this
      self.handleSyncPlay();
      // trigger play only after it actually started to play
      self.triggerSync('play', { playing: true });
    },

    triggerSyncPause() {
      // @todo should not be handled like this
      self.handleSyncPause();
      self.triggerSync('pause', { playing: false });
    },

    triggerSyncSeek(time) {
      self.triggerSync('seek', { time });
    },

    ////// Incoming

    registerSyncHandlers() {
      ['play', 'pause', 'seek', 'length'].forEach(event => {
        self.syncHandlers.set(event, self.handleSync);
      });
      self.syncHandlers.set('speed', self.handleSyncSpeed);
    },

    handleSync(data) {
      if (data?.time) self.playedTime = Number(data.time) || 0.01;
      if (data?.length) self.totalDuration = Number(data.length) || 1024;
      if (data?.playing || data.playing === false) self.playing = data.playing ?? false;
      if (!self._ws?.loaded) return;

      self.handleSyncSeek(data);
      if (data.playing) {
        if (!self._ws.playing) self._ws?.play();
      } else {
        if (self._ws.playing) self._ws?.pause();
      }
    },

    // @todo remove both of these methods
    handleSyncPlay() {
      if (self._ws?.playing) return;

      self._ws?.play();
    },

    handleSyncPause() {
      if (!self._ws?.playing) return;

      self._ws?.pause();
    },

    handleSyncSeek({ time }) {
      if (!self._ws?.loaded || !isDefined(time)) return;

      try {
        self._ws.setCurrentTime(time, true);
        self._ws.syncCursor(); // sync cursor with current time
      } catch (err) {
        console.log(err);
      }
    },

    handleSyncSpeed({ speed }) {
      if (!self._ws) return;
      self._ws.rate = speed;
    },

    syncMuted(muted) {
      if (!self._ws) return;
      self._ws.muted = muted;
    },
  }))
  .actions(self => {
    let dispose;
    let updateTimeout = null;

    return {
      afterCreate() {
        dispose = observe(self, 'activeLabel', () => {
          const selectedRegions = self._ws?.regions?.selected;

          if (!selectedRegions || selectedRegions.length === 0) return;

          const activeState = self.activeState;
          const selectedColor = activeState?.selectedColor;
          const labels = activeState?.selectedValues();

          selectedRegions.forEach(r => {
            r.update({ color: selectedColor, labels: labels ?? [] });

            const region = r.isRegion ? self.updateRegion(r) : self.addRegion(r);

            self.annotation.selectArea(region);
          });

          if (selectedRegions.length) {
            self.requestWSUpdate();
          }
        }, false);
      },

      requestWSUpdate() {
        if (!self._ws) return;
        if (updateTimeout) {
          clearTimeout(updateTimeout);
        }

        updateTimeout = setTimeout(() => {
          self._ws.regions.redraw();
        }, 33);
      },

      onReady() {
        self.setReady(true);
      },

      onRateChange(rate) {
        self.triggerSyncSpeed(rate);
      },

      /**
       * Load any synced paragraph text segments which contain start and end values
       * as Audio segments for visualization of the excerpts within the audio track
       **/
      loadSyncedParagraphs() {
        if (!self.syncManager) return;

        // find synced paragraphs if any
        // and add their regions to the audio
        const syncedParagraphs = Array.from(self.syncManager.syncTargets, ([,value]) => value).filter(target => target.type === 'paragraphs' && target.contextscroll);

        syncedParagraphs.forEach(paragraph => {
          const segments = Object.values(paragraph.regionsStartEnd).map(({ start, end }) => ({ start, end, showInTimeline: true, external: true, locked: true }));

          self._ws.addRegions(segments);
        });
      },

      handleNewRegions() {
        if (!self._ws) return;

        self.regs.map(reg => {
          if (reg._ws_region) {
            self.updateWsRegion(reg);
          } else {
            self.createWsRegion(reg);
          }
        });
      },

      findRegionByWsRegion(wsRegion) {
        return self.regs.find(r => r._ws_region?.id === wsRegion?.id);
      },

      getRegionColor() {
        const control = self.activeState;

        if (control) {
          return control.selectedColor;
        }

        return null;
      },

      onHotKey(e) {
        e && e.preventDefault();
        self._ws.togglePlay();
        return false;
      },

      setRangeValue(val) {
        self.rangeValue = val;
      },

      setPlaybackRate(val) {
        self.playBackRate = val;
      },

      createRegion(wsRegion, states) {
        let bgColor = self.selectedregionbg;
        const st = states.find(s => s.type === 'labels');

        if (st) bgColor = Utils.Colors.convertToRGBA(st.getSelectedColor(), 0.3);

        const r = ChartRegionModel.create({
          id: wsRegion.id ? wsRegion.id : guidGenerator(),
          pid: wsRegion.pid ? wsRegion.pid : guidGenerator(),
          parentID: wsRegion.parent_id === null ? '' : wsRegion.parent_id,
          start: wsRegion.start,
          end: wsRegion.end,
          score: wsRegion.score,
          readonly: wsRegion.readonly,
          regionbg: self.regionbg,
          selectedregionbg: bgColor,
          normalization: wsRegion.normalization,
          states,
        });

        r._ws_region = wsRegion;

        self.regions.push(r);
        self.annotation.addRegion(r);

        return r;
      },

      addRegion(wsRegion) {
        // area id is assigned to WS region during deserealization
        const find_r = self.annotation.areas.get(wsRegion.id);


        if (find_r) {
          find_r._ws_region = wsRegion;
          find_r.updateColor();
          return find_r;
        }

        const states = self.getAvailableStates();

        if (states.length === 0) {
          // wsRegion.on("update-end", ev=> self.selectRange(ev, wsRegion));
          if (wsRegion.isRegion) {
            wsRegion.convertToSegment().handleSelected();
          }

          return;
        }

        const control = self.activeState;
        const labels = { [control.valueType]: control.selectedValues() };
        const r = self.annotation.createResult(wsRegion, labels, control, self);
        const updatedRegion = wsRegion.convertToRegion(labels.labels);

        r._ws_region = updatedRegion;
        r.updateColor();
        return r;
      },

      updateRegion(wsRegion) {
        const r = self.findRegionByWsRegion(wsRegion);

        if (!r) return;

        r.onUpdateEnd();
        return r;
      },

      createWsRegion(region) {
        if (!self._ws) return;

        const options = region.wsRegionOptions();

        options.labels = region.labels?.length ? region.labels : undefined;

        const r = self._ws.addRegion(options, false);

        region._ws_region = r;
      },

      updateWsRegion(region) {
        if (!self._ws) return;

        const options = region.wsRegionOptions();

        options.labels = region.labels?.length ? region.labels : undefined;

        self._ws.updateRegion(options, false);
      },

      clearRegionMappings() {
        self.regs.forEach(r => {
          r._ws_region = null;
        });
      },

      onLoad(ws) {

        console.log('--------------------ws Loaded charts----------------------------------------')
        self.clearRegionMappings();
        self._ws = ws;

        self.onReady();
        self.needsUpdate();
        if (isFF(FF_LSDV_E_278)) {
          self.loadSyncedParagraphs();
        }
      },
     
      onError(error) {
        let messageHandler;

        if (error.name === 'HTTPError') {
          messageHandler = 'ERR_LOADING_HTTP';
        } else {
          messageHandler = 'ERR_LOADING_AUDIO';
        }

        const message = getEnv(self.store).messages[messageHandler]({ attr: self.value, url: self._value, error: error.message });

        self.errors = [message];
      },

      beforeDestroy() {
        try {
          if (updateTimeout) clearTimeout(updateTimeout);
          if (dispose) dispose();
          if (isDefined(self._ws)) {
            self._ws.destroy();
            self._ws = null;
          }
        } catch (err) {
          self._ws = null;
          console.warn('Already destroyed');
        }
      },
    };
  });

export const ChartModel = types.compose('ChartModel',
  TagAttrs,
  SyncableMixin,
  ProcessAttrsMixin,
  ObjectBase,
  AnnotationMixin,
  Model,
  IsReadyMixin,
);
