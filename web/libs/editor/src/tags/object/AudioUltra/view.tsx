import { inject, observer } from 'mobx-react';
import { FC, useEffect, useRef, useState } from 'react';
import { Hotkey } from '../../../core/Hotkey';
import { useWaveform } from '../../../lib/AudioUltra/react';
import { Controls } from '../../../components/Timeline/Controls';
import { Region, RegionOptions } from '../../../lib/AudioUltra/Regions/Region';
import { Segment } from '../../../lib/AudioUltra/Regions/Segment';
import { Regions } from '../../../lib/AudioUltra/Regions/Regions';
import { Block } from '../../../utils/bem';
import { ErrorMessage } from '../../../components/ErrorMessage/ErrorMessage';

import './view.styl';
import { Waveform } from '../../../lib/AudioUltra';
import { Visualizer } from '../../../lib/AudioUltra/Visual/Visualizer';
import { onSnapshot } from 'mobx-state-tree';
import { rgba } from '../../../lib/AudioUltra/Common/Color';

interface AudioUltraProps {
  item: any;
}

const NORMALIZED_STEP = 0.1;

const AudioUltraView: FC<AudioUltraProps> = inject(['store'])(observer(({ item, store }) => {
  const rootRef = useRef<HTMLElement | null>();

  const { waveform, ...controls } = useWaveform(rootRef, {
    src: item._value,
    autoLoad: false,
    waveColor: '#BEB9C5',
    gridColor: '#BEB9C5',
    gridWidth: 1,
    backgroundColor: '#fafafa',
    autoCenter: true,
    zoomToCursor: true,
    height: item.height && !isNaN(Number(item.height)) ? Number(item.height) : 96,
    waveHeight: item.waveheight && !isNaN(Number(item.waveheight)) ? Number(item.waveheight) : 32,
    splitChannels: item.splitchannels,
    decoderType: item.decoder,
    playerType: item.player,
    volume: item.defaultvolume ? Number(item.defaultvolume) : 1,
    amp: item.defaultscale ? Number(item.defaultscale) : 1,
    zoom: item.defaultzoom ? Number(item.defaultzoom) : 1,
    showLabels: item.annotationStore.store.settings.showLabels,
    rate: item.defaultspeed ? Number(item.defaultspeed) : 1,
    muted: item.muted === 'true',
    onLoad: item.onLoad,
    onPlaying: item.onPlaying,
    onSeek: item.onSeek,
    onRateChange: item.onRateChange,
    onError: item.onError,
    regions: {
      createable: !item.readonly,
      updateable: !item.readonly,
      deleteable: !item.readonly,
    },
    timeline: {
      backgroundColor: '#ffffff',
    },
    experimental: {
      backgroundCompute: true,
      denoize: true,
    },
    autoPlayNewSegments: true,
  });

  const seekVal = () =>{
    let val = -1;
    return {
      get: () => val,
      set: (newVal:number) => { val = newVal; },
      reset: () => { val = -1; },
    };
  };
  const seekStart = seekVal();

  const keyRegionLabel = (() => {
    let selectedLabels = [] as string[];
    return {
      get: () => selectedLabels,
      set: (arr: string[]) => { selectedLabels = [...arr] },
      reset: () => { selectedLabels = [] },
    };
  })();

  const [isRegionRecording, setIsRegionRecording] = useState(false);
  const [regionStart, setRegionStart] = useState(-1);

  const [chartRegionCb, setChartRegionCb] = useState(false);
  const [chartRegionUpdateCb, setChartRegionUpdateCb] = useState(false);

  onSnapshot(store.shouldDrawChartRegion, snap => {
    setChartRegionCb(snap.flag);
  });

  onSnapshot(store.shouldEditChartRegion, snap => {
    setChartRegionUpdateCb(snap.flag);
  });

  const addRegionFromChart = () => {
      const newRegionToDraw = store.chartRegionToDraw;
      if (
        (newRegionToDraw.start > 0 && newRegionToDraw.end > 0) &&
        (newRegionToDraw.start < controls.duration && newRegionToDraw.end <= controls.duration) &&
        (newRegionToDraw.start < newRegionToDraw.end)
      ) {
        if (newRegionToDraw.end > controls.duration) newRegionToDraw.end = controls.duration;
        const labels = item.activeState?.selectedValues();
        const newRegion = new Region(
          {
            start:newRegionToDraw.start as number,
            end:newRegionToDraw.end as number,
            labels:labels,
            color: waveform.current?.regions.drawingColor?.toString(),
          },
          waveform.current as Waveform,
          waveform.current?.visualizer as Visualizer,
          waveform.current?.regions as Regions
          );
          waveform.current?.regions.addRegionKey(newRegion);
          // store.setChartRegionDrawFlag();
      }
      store.resetChartRegionToDraw();
  };

  const updateRegionFromChart = () => {
    const regionToUpdate = store.chartRegionToEdit;
    if (
      (regionToUpdate.start > 0 && regionToUpdate.end > 0) &&
      (regionToUpdate.start < controls.duration && regionToUpdate.end <= controls.duration)
    ) {
      const region = waveform?.current?.regions?.findRegion(regionToUpdate.id);
    if (region) {
        region.start = regionToUpdate.start;
        region.end = regionToUpdate.end;
        region.selected = true;
        item.updateRegion(region);
      }
      store.resetChartRegionToEdit();
    }
  };

  const [labelSelectionUpdated, setLabelSelectionUpdated] = useState(0);
  const [labelClickedUpdated, setLabelClickedUpdated] = useState(0);

  const [labelDataUpdated, setLabelDataUpdated] = useState(0);

  onSnapshot(store.labelsData, (snp) => {
    setLabelDataUpdated(Date.now());
  });

  onSnapshot(store.selectedLabels, (snp) => {
    setLabelSelectionUpdated(Date.now());
  });

  useEffect(() => {
    if (labelSelectionUpdated) {
      // Create a new KeyboardEvent for the 'w' key
    const event = new KeyboardEvent('keydown', {
      key: 'w',
      code: 'KeyW',
      keyCode: 87, // keyCode for 'w'
      which: 87, // which is also 87 for 'w'
      bubbles: true, // Make sure the event bubbles up through the DOM
      cancelable: true // Allow the event to be canceled
    });

    // Dispatch the event on the document
    store.selectedLabels?.map(itm => {
      setTimeout(() => document.dispatchEvent(event), 100);
    });
    }
  }, [labelSelectionUpdated]);

  useEffect(() => {
    if (labelDataUpdated) {
      if (waveform.current?.regions) {
        const regionsCopy = [...waveform.current?.regions?.getRegions()]
        regionsCopy.map(itm => {
          const { labels } = itm;
          if (labels && labels.length) {
            const condition = store.labelsData?.some(d => d.value == labels[0]);
            itm.updateColor(rgba('#2b2b2b'));
            if(condition) setTimeout(() => itm.updateColor(store.annotationStore?.getLabelColor(labels[0]) || ""), 20);
          }
        })
      }

    }
  }, [labelDataUpdated])

  /**
 * Adds an event listener for the ';' key press.
 * @param {Function} callback - The function to be called when the ';' key is pressed.
 */
function addSemicolonKeyListener(callback:any) {
  document.addEventListener('keydown', function(event) {
      // Check if the key pressed is ';' (key code 186 on most keyboards)
      if (event.key === ';' || event.keyCode === 186) {
          callback(event);
      }
  });
}

  useEffect(() => {
    if (chartRegionCb) {
      addRegionFromChart();
    }
  }, [chartRegionCb]);

  useEffect(() => {
    if (chartRegionUpdateCb) {
      updateRegionFromChart();
    }
  }, [chartRegionUpdateCb]);

  useEffect(() => {
    const hotkeys = Hotkey('Audio', 'Audio Segmentation');

    waveform.current?.load();


    const updateBeforeRegionDraw = (regions: Regions) => {
      const regionColor = item.getRegionColor();
      const regionLabels = item.activeState?.selectedValues();

      if (regionColor && regionLabels) {
        regions.regionDrawableTarget();
        regions.setDrawingColor(regionColor);
        regions.setLabels(regionLabels);
      }
    };

    const updateAfterRegionDraw = (regions: Regions) => {
      regions.resetDrawableTarget();
      regions.resetDrawingColor();
      regions.resetLabels();
    };

    const createRegion = (region: Region | Segment) => {
      item.addRegion(region);
    };

    const selectRegion = (region: Region | Segment, event: MouseEvent) => {
      const growSelection = event?.metaKey || event?.ctrlKey;

      if (!growSelection || (!region.selected && !region.isRegion)) item.annotation.regionStore.unselectAll();

      // to select or unselect region
      const itemRegion = item.regs.find((obj: any) => obj.id === region.id);

      itemRegion && item.annotation.regionStore.toggleSelection(itemRegion, region.selected);

      // to select or unselect unlabeled segments
      const targetInWave = item._ws.regions.findRegion(region.id);

      if (targetInWave) {
        targetInWave.handleSelected(region.selected);
        if(region.selected) {
          store.pushToSelectedSegments(targetInWave);
        }
        else store.removeFromSelectedSegments(targetInWave)
      }

      // deselect all other segments if not changing multiselection
      if (!growSelection) {
        item._ws.regions.regions.forEach((obj: any) => {
          if (obj.id !== region.id) {
            obj.handleSelected(false);
          }
        });
      }
    };

    const updateRegion = (region: Region | Segment) => {
      item.updateRegion(region);
    };

    const drawRegionWithKey = () => {
      const existingSeek = seekStart.get();
      const seekTime = Number(waveform?.current?.getCurrentTime()) ?? 0;
      if(keyRegionLabel.get().length == 0) keyRegionLabel.set(store.selectedLabels?.map(itm => itm.value));
        if(existingSeek == -1){
        seekStart.set(seekTime);
        setRegionStart(seekTime);
      } else {
        if(seekTime == existingSeek || seekTime < existingSeek) {
        // if(seekTime < existingSeek) {
          // Reset seek variable and return
          seekStart.reset();
          setRegionStart(-1);
          setIsRegionRecording(seekStart.get() >-1);
          // store?.removeFromSelectedLabels(keyRegionLabel.get()[0]);
          if(keyRegionLabel.get().length > 1) {
            store?.annotationStore?.completeToggleLabelSelectByValue(keyRegionLabel.get()[0]);
            store?.removeFromSelectedLabels(keyRegionLabel.get()[0]);
          }
          else store.setSelectedLabels?.([]);
          keyRegionLabel.reset();
          return;
        }
        // store?.annotationStore?.toggleLabelSelectByValue(keyRegionLabel.get()[0]);
        // save current seek value as region end
        //Create new region
        const seekTimeEnd = Number(waveform?.current?.getCurrentTime()) ?? 0;
        const labels = keyRegionLabel.get().length ? [keyRegionLabel.get()[0]] : item.activeState?.selectedValues();
        store?.annotationStore?.unSelectLabelAll();
        store?.annotationStore?.toggleLabelSelectByValue(labels[0]);
        // waveform.current?.regions?.addRegionKey(
        //    existingSeek,
        //    seekTimeEnd,
        //   labels
        // );
        const newRegion = new Region(
          {
            start:existingSeek,
            end:seekTimeEnd,
            labels:labels,
            color: waveform.current?.regions.drawingColor?.toString(),
          },
          waveform.current as Waveform,
          waveform.current?.visualizer as Visualizer,
          waveform.current?.regions as Regions
          );
          // if (keyRegionLabel.get().length) newRegion.update({ labels });
          waveform.current?.regions.addRegionKey(newRegion);
          
          // selectRegion(newRegion, null as unknown as MouseEvent);
          // store?.annotationStore?.toggleLabelSelectByValue(labels[0]);
          setTimeout(() => {
            // store?.annotationStore?.toggleLabelSelectByValue(labels[0]);
            
            // Reset seek value
        seekStart.reset();
        setRegionStart(-1);
        keyRegionLabel.reset();
        setIsRegionRecording(seekStart.get() >-1)
          }, 100);
          // store?.annotationStore?.toggleLabelSelectByValue(labels[0]);
            store?.removeFromSelectedLabels(labels[0]);
            store?.annotationStore?.completeToggleLabelSelectByValue(labels[0]);
        // Reset seek value
        seekStart.reset();
        setRegionStart(-1);
        keyRegionLabel.reset();
        store?.annotationStore?.toggleLabelSelectForHotKey();
      }
      setIsRegionRecording(seekStart.get() >-1)
    };

    waveform.current?.on('beforeRegionsDraw', updateBeforeRegionDraw);
    waveform.current?.on('afterRegionsDraw', updateAfterRegionDraw);
    waveform.current?.on('regionSelected', selectRegion);
    waveform.current?.on('regionCreated', createRegion);
    waveform.current?.on('regionUpdatedEnd', updateRegion);

    hotkeys.addNamed('region:delete', () => {
      waveform.current?.regions.clearSegments(true);
    });

    hotkeys.addNamed('segment:delete', () => {
      waveform.current?.regions.clearSegments(true);
    });

    hotkeys.addNamed('region:delete-all', () => {
      waveform.current?.regions.clearSegments();
    });
    hotkeys.addNamed('region:exit', () => {
      seekStart.reset();
      setRegionStart(-1);
      setIsRegionRecording(seekStart.get() >-1);
      store?.annotationStore?.completeToggleLabelSelectByValue(keyRegionLabel.get()[0]);
      store.setSelectedLabels?.([])
      keyRegionLabel.reset();
    });
    hotkeys.addNamed('region:start-stop-htk', drawRegionWithKey);
    hotkeys.addNamed('audio:half-length-forward', () => scrollHalfLength());
    hotkeys.addNamed('audio:half-length-backward', () => scrollHalfLength(true));

  //   addSemicolonKeyListener(() => {
  //     // Create a new KeyboardEvent for the 'w' key
  //     const event = new KeyboardEvent('keydown', {
  //       key: "'", // Key value for the single quote
  //       code: 'Quote', // Code value for the single quote key
  //       keyCode: 222, // Correct keyCode for the single quote (on most keyboards)
  //       which: 222, // Correct which value for the single quote
  //       bubbles: true, // Make sure the event bubbles up through the DOM
  //       cancelable: true // Allow the event to be canceled
  //     });
  
  //     // Dispatch the event on the document
  //     document.dispatchEvent(event);
  // })

    return () => {
      hotkeys.unbindAll();
    };
  }, []);

  const scrollHalfLength = (backwards=false) => {
    waveform.current?.scrollHalfVisibleTime(backwards);
  }

  return (
    <Block name="audio-tag" style={{ display: store.shouldShowAudioWave.flag ? 'block' : 'none' }}>
      {item.errors?.map((error: any, i: any) => (
        <ErrorMessage key={`err-${i}`} error={error} />
      ))}
      {isRegionRecording && <div className={'lsf-button-custom'}>Recording Region from {regionStart.toFixed(2)} seconds</div>}
      <div ref={el => (rootRef.current = el)}></div>
      <Controls
        position={controls.currentTime}
        playing={controls.playing}
        volume={controls.volume}
        speed={controls.rate}
        zoom={controls.zoom}
        duration={controls.duration}
        onPlay={() => controls.setPlaying(true)}
        onPause={() => controls.setPlaying(false)}
        allowFullscreen={false}
        onVolumeChange={vol => controls.setVolume(vol)}
        onStepBackward={() => {
          waveform.current?.seekBackward(NORMALIZED_STEP);
          waveform.current?.syncCursor();
        }}
        onStepForward={() => {
          waveform.current?.seekForward(NORMALIZED_STEP);
          waveform.current?.syncCursor();
        }}
        onPositionChange={pos => {
          waveform.current?.seek(pos);
          waveform.current?.syncCursor();
        }}
        onSpeedChange={speed => controls.setRate(speed)}
        onZoom={zoom => controls.setZoom(zoom)}
        amp={controls.amp}
        onAmpChange={amp => controls.setAmp(amp)}
        mediaType="audio"
        toggleVisibility={(layerName: string, isVisible: boolean) => {
          if (waveform.current) {
            const layer = waveform.current?.getLayer(layerName);

            if (layer) {
              layer.setVisibility(isVisible);
            }
          }
        }}
        layerVisibility={controls.layerVisibility}
      />
    </Block>
  );
}));

export const AudioUltra = observer(AudioUltraView);
