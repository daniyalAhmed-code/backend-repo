import { destroy, detach, getEnv, getParent, getRoot, types, applySnapshot, getSnapshot, castToSnapshot } from 'mobx-state-tree';

import { errorBuilder } from '../../core/DataValidator/ConfigValidator';
import { DataValidator, ValidationError, VALIDATORS } from '../../core/DataValidator';
import { guidGenerator } from '../../core/Helpers';
import Registry from '../../core/Registry';
import Tree from '../../core/Tree';
import Types from '../../core/Types';
import { StoreExtender } from '../../mixins/SharedChoiceStore/extender';
import { ViewModel } from '../../tags/visual';
import Utils from '../../utils';
import { FF_DEV_1621, FF_DEV_3034, FF_DEV_3391, FF_DEV_3617, FF_SIMPLE_INIT, isFF } from '../../utils/feature-flags';
import { emailFromCreatedBy } from '../../utils/utilities';
import { Annotation } from './Annotation';
import { HistoryItem } from './HistoryItem';

const SelectedItem = types.union(Annotation, HistoryItem);

const AnnotationStoreModel = types
  .model('AnnotationStore', {
    selected: types.maybeNull(types.reference(SelectedItem)),
    selectedHistory: types.maybeNull(types.safeReference(SelectedItem)),

    root: Types.allModelsTypes(),
    names: types.map(types.reference(Types.allModelsTypes())),
    toNames: types.map(types.array(types.reference(Types.allModelsTypes()))),

    annotations: types.array(Annotation),
    predictions: types.array(Annotation),
    history: types.array(HistoryItem),

    viewingAllAnnotations: types.optional(types.boolean, false),

    validation: types.maybeNull(types.array(ValidationError)),
  })
  .volatile(() => ({
    initialized: false,
  }))
  .views(self => ({
    get store() {
      return getRoot(self);
    },

    get viewingAll() {
      return self.viewingAllAnnotations;
    },
  }))
  .actions(self => {
    function toggleViewingAll() {
      self.viewingAllAnnotations = !self.viewingAllAnnotations;

      if (self.viewingAllAnnotations) {
        if (self.selected) {
          // const comments = self.store.commentStore;

          // @todo `currentComment` is an object and saving them was not a part of original fix
          // @todo so I leave it for next fix coming soon
          // if (comments.currentComment) {
          //   // comment will save draft automatically
          //   comments.commentFormSubmit();
          // } else
          if (self.selected.type === 'annotation') {
            // save draft if there are changes waiting to be saved — it's handled inside
            self.selected.saveDraftImmediately();
          }

          self.selected.unselectAll();
          self.selected.selected = false;
        }

        self.annotations.forEach(c => {
          c.editable = false;
        });
      } else {
        selectAnnotation(self.annotations.at(isFF(FF_SIMPLE_INIT) ? -1 : 0).id, { fromViewAll: true });
      }
    }

    // @todo that's just an alias, rewrite it everywhere
    function toggleViewingAllAnnotations() {
      toggleViewingAll();
    }

    function unselectViewingAll() {
      self.viewingAllAnnotations = false;
    }

    function _unselectAll() {
      if (self.selected) {
        self.selected.unselectAll();
        self.selected.selected = false;
      }
    }

    function _selectItem(item) {
      self._unselectAll();
      item.editable = false;
      item.selected = true;
      self.selected = item;
      item.updateObjects();
    }

    function selectItem(id, list, resetHistory = true) {
      unselectViewingAll();

      self._unselectAll();

      // sad hack with pk while sdk are not using pk everywhere
      const c = list.find(c => c.id === id || c.pk === String(id)) || list[0];

      if (!c) return null;
      c.selected = true;

      if (resetHistory) {
        self.selectedHistory = null;
        self.history = [];
      }

      self.selected = c;

      c.updateObjects();
      if (c.type === 'annotation') c.setInitialValues();

      return c;
    }

    /**
     * Select annotation
     * @param {*} id
     */
    function selectAnnotation(id, options = {}) {
      if (!self.annotations.length) return null;

      const { selected } = self;
      const c = selectItem(id, self.annotations, !options.retainHistory);

      c.editable = true;
      c.setupHotKeys();

      getEnv(self).events.invoke('selectAnnotation', c, selected, options ?? {});
      if (c.pk) getParent(self).addAnnotationToTaskHistory(c.pk);
      return c;
    }

    function selectPrediction(id) {
      const p = selectItem(id, self.predictions);

      return p;
    }

    function clearDeletedParents(annotation) {
      if (!annotation?.pk) return;
      self.annotations.forEach(anno => {
        if (anno.parent_annotation && +anno.parent_annotation === +annotation.pk) {
          anno.parent_annotation = null;
        }
      });
    }

    function deleteAnnotation(annotation) {
      getEnv(self).events.invoke('deleteAnnotation', self.store, annotation);

      /**
       * MST destroy annotation
       */
      destroy(annotation);
      
      /**
       * Clear any other parent_annotations connected to this annotation
       */
      self.clearDeletedParents(annotation);

      self.selected = null;
      /**
       * Select other annotation
       */
      if (self.annotations.length > 0) {
        self.selectAnnotation(self.annotations[0].id);
      }
    }

    function showError(err) {
      if (err) self.addErrors([errorBuilder.generalError(err)]);
      // we have to return at least empty View to display interface
      return (self.root = ViewModel.create({ id: 'error' }));
    }

    function upsertToName(node) {
      const val = self.toNames.get(node.toname);

      if (val) {
        val.push(node.name);
      } else {
        self.addToName(node);
      }
    }

    function addToName(node) {
      self.toNames.set(node.toname, [node.name]);
    }

    function addName(node) {
      self.names.put(node);
    }

    function initRoot(config) {
      if (self.root) return;

      if (!config) {
        return (self.root = ViewModel.create({ id: 'empty' }));
      }

      // convert config to mst model
      let rootModel;

      try {
        rootModel = Tree.treeToModel(config, self.store);
      } catch (e) {
        console.error(e);
        return showError(e);
      }
      const modelClass = Registry.getModelByTag(rootModel.type);
      // hacky way to get all the available object tag names
      const objectTypes = Registry.objectTypes().map(type => type.name.replace('Model', '').toLowerCase());
      const objects = [];

      self.validate(VALIDATORS.CONFIG, rootModel);

      try {
        self.root = modelClass.create(rootModel);
      } catch (e) {
        console.error(e);
        return showError(e);
      }

      if (isFF(FF_DEV_3391)) {
        // initialize toName bindings [DOCS] name & toName are used to
        // connect different components to each other
        const { names, toNames } = Tree.extractNames(self.root);

        names.forEach(tag => self.names.put(tag));
        toNames.forEach((tags, name) => self.toNames.set(name, tags));

        Tree.traverseTree(self.root, node => {
          if (self.store.task && node.updateValue) node.updateValue(self.store);
        });

        self.initialized = true;

        return self.root;
      }

      // initialize toName bindings [DOCS] name & toName are used to
      // connect different components to each other
      Tree.traverseTree(self.root, node => {
        if (node?.name) {
          self.addName(node);
          if (objectTypes.includes(node.type)) objects.push(node.name);
        }

        const isControlTag = node.name && !objectTypes.includes(node.type);

        // auto-infer missed toName if there is only one object tag in the config
        if (isControlTag && !node.toname && objects.length === 1) {
          node.toname = objects[0];
        }

        if (node && node.toname) {
          self.upsertToName(node);
        }

        if (self.store.task && node.updateValue) node.updateValue(self.store);
      });

      self.initialized = true;

      return self.root;
    }

    function updateRoot(config){
      if (self.root) return;
      // convert config to mst model
      let rootModel;

      try {
        rootModel = Tree.treeToModel(config, self.store);
      } catch (e) {
        console.error(e);
        return showError(e);
      }
      const modelClass = Registry.getModelByTag(rootModel.type);
      // hacky way to get all the available object tag names
      const objectTypes = Registry.objectTypes().map(type => type.name.replace('Model', '').toLowerCase());
      const objects = [];

      self.validate(VALIDATORS.CONFIG, rootModel);

      try {
        self.root = modelClass.create(rootModel);
      } catch (e) {
        console.error(e);
        return showError(e);
      }

      if (isFF(FF_DEV_3391)) {
        // initialize toName bindings [DOCS] name & toName are used to
        // connect different components to each other
        const { names, toNames } = Tree.extractNames(self.root);

        names.forEach(tag => self.names.put(tag));
        toNames.forEach((tags, name) => self.toNames.set(name, tags));

        Tree.traverseTree(self.root, node => {
          if (self.store.task && node.updateValue) node.updateValue(self.store);
        });

        self.initialized = true;

        return self.root;
      }

      // initialize toName bindings [DOCS] name & toName are used to
      // connect different components to each other
      Tree.traverseTree(self.root, node => {
        if (node?.name) {
          self.addName(node);
          if (objectTypes.includes(node.type)) objects.push(node.name);
        }

        const isControlTag = node.name && !objectTypes.includes(node.type);

        // auto-infer missed toName if there is only one object tag in the config
        if (isControlTag && !node.toname && objects.length === 1) {
          node.toname = objects[0];
        }

        if (node && node.toname) {
          self.upsertToName(node);
        }

        if (self.store.task && node.updateValue) node.updateValue(self.store);
      });

      self.initialized = true;

      return self.root;
    }

    function unshiftProjectLabels(labelConfig){
      // convert config to mst model
      let rootModel;
      try {
        rootModel = Tree.treeToModel(labelConfig, self.store);
      } catch (e) {
        console.error(e);
        return showError(e);
      }
      const modelClass = Registry.getModelByTag(rootModel.type);
      // hacky way to get all the available object tag names
      const objectTypes = Registry.objectTypes().map(type => type.name.replace('Model', '').toLowerCase());
      const objects = [];
      rootModel.children = rootModel.children?.map(child => ({ ...child, parent: rootModel.id}))
      const lblConfigLabels = self.root.children[2];

      const existingChild = [...(lblConfigLabels.children.map(l => getSnapshot(l)))];
      const projectLblTag = getSnapshot(modelClass.create(rootModel));
      const projectLblChild = [...getSnapshot(modelClass.create(rootModel)).children, ...existingChild];

      // projectLblTag.children = projectLblChild;

      lblConfigLabels.children = [...projectLblChild];

      try {
        self.root.children[2] = lblConfigLabels;
      } catch (e) {
        console.error(e);
        err = showError(e);
        return err;
      }
      if (isFF(FF_DEV_3391)) {
        // initialize toName bindings [DOCS] name & toName are used to
        // connect different components to each other
        const { names, toNames } = Tree.extractNames(self.root);
        names.forEach(tag => self.names.put(tag));
        toNames.forEach((tags, name) => self.toNames.set(name, tags));
        Tree.traverseTree(self.root, node => {
          if (self.store.task && node.updateValue) node.updateValue(self.store);
        });
        self.initialized = true;
        return self.root;
      }
      // initialize toName bindings [DOCS] name & toName are used to
      // connect different components to each other
      Tree.traverseTree(self.root, node => {
        if (node?.name) {
          self.addName(node);
          if (objectTypes.includes(node.type)) objects.push(node.name);
        }
        const isControlTag = node.name && !objectTypes.includes(node.type);
        // auto-infer missed toName if there is only one object tag in the config
        if (isControlTag && !node.toname && objects.length === 1) {
          node.toname = objects[0];
        }
        if (node && node.toname) {
          self.upsertToName(node);
        }
        if (self.store.task && node.updateValue) node.updateValue(self.store);
      });
      // self.initialized = true;
      self.selected?.setupHotKeys?.();
      return self.root;
    }

    function updateLabels(labelConfig){
      // convert config to mst model
      let rootModel;
      try {
        rootModel = Tree.treeToModel(labelConfig, self.store);
      } catch (e) {
        console.error(e);
        return showError(e);
      }
      const modelClass = Registry.getModelByTag(rootModel.type);
      // hacky way to get all the available object tag names
      const objectTypes = Registry.objectTypes().map(type => type.name.replace('Model', '').toLowerCase());
      const objects = [];
      rootModel.children = rootModel.children?.map(child => ({ ...child, parent: rootModel.id}))
      try {
        self.root.children[2] = getSnapshot(modelClass.create(rootModel));
      } catch (e) {
        console.error(e);
        err = showError(e);
        return err;
      }
      if (isFF(FF_DEV_3391)) {
        // initialize toName bindings [DOCS] name & toName are used to
        // connect different components to each other
        const { names, toNames } = Tree.extractNames(self.root);
        names.forEach(tag => self.names.put(tag));
        toNames.forEach((tags, name) => self.toNames.set(name, tags));
        Tree.traverseTree(self.root, node => {
          if (self.store.task && node.updateValue) node.updateValue(self.store);
        });
        self.initialized = true;
        return self.root;
      }
      // initialize toName bindings [DOCS] name & toName are used to
      // connect different components to each other
      Tree.traverseTree(self.root, node => {
        if (node?.name) {
          self.addName(node);
          if (objectTypes.includes(node.type)) objects.push(node.name);
        }
        const isControlTag = node.name && !objectTypes.includes(node.type);
        // auto-infer missed toName if there is only one object tag in the config
        if (isControlTag && !node.toname && objects.length === 1) {
          node.toname = objects[0];
        }
        if (node && node.toname) {
          self.upsertToName(node);
        }
        if (self.store.task && node.updateValue) node.updateValue(self.store);
      });
      // self.initialized = true;
      self.selected.setupHotKeys();
      return self.root;
    }

    function updateVideoSrc(newSrc){
      let rootModel;
      try {
        const updatedXMLTag = `<Video name="video" value="${newSrc}" sync="audio,chart"></Video>`;
        // rootModel = Tree.treeToModel(updatedXMLTag, self.store);
        self.root.children[1].value = newSrc;
        self.root.children[1]._value = newSrc;
        return;
      } catch (e) {
        console.error(e);
        return showError(e);
      }
    }

    function updateTimeSeriesData(newSrc){
      let rootModel;
      try {
        // rootModel = Tree.treeToModel(updatedXMLTag, self.store);
        // self.root.children[1].value = newSrc;
        // self.root.children[1]._value = newSrc;
        const tsTags = Object.keys(newSrc).filter(src => src.toLocaleLowerCase() !== 'video');
        for (let i=0; i<tsTags.length; i++) {
          const rootChild = self.root.children?.find(child => child.name === tsTags[i]);
          if (rootChild) {
            rootChild.data = newSrc[tsTags[i]];
            // rootChild.dataObj = newSrc[tsTags[i]];
          }
        }
        return;
      } catch (e) {
        console.error(e);
        return showError(e);
      }
    }

    function getLabelColor(label){
      try {
        const { children } = self.root;
        const labels = children?.find(child => child.name === 'tricks');
        const selectedLabel = labels?.children?.find(lbl => lbl.value === label);
        return selectedLabel?.background ?? null;
      } catch (e) {
        console.error(e);
        return showError(e);
      }
    }

    function getLabelByValue(labelValue){
      try {
        const { children } = self.root;
        const labels = children?.find(child => child.name === 'tricks');
        const selectedLabel = labels?.children?.find(lbl => lbl.value === labelValue);
        return selectedLabel ?? null;
      } catch (e) {
        console.error(e);
        return showError(e);
      }
    }

    function toggleLabelSelectByValue (labelValue) {
      try {
        const { children } = self.root;
        const labels = children?.find(child => child.name === 'tricks');
        const selectedLabel = labels?.children?.find(lbl => lbl.value === labelValue);
        return selectedLabel?.setSelectedOnly?.(true);
      } catch (e) {
        console.error(e);
        return showError(e);
      }
    }

    function completeToggleLabelSelectByValue (labelValue) {
      try {
        const { children } = self.root;
        const labels = children?.find(child => child.name === 'tricks');
        const selectedLabel = labels?.children?.find(lbl => lbl.value === labelValue);
        return selectedLabel?.setIsHotKeySelected?.(false);
      } catch (e) {
        console.error(e);
        return showError(e);
      }
    }

    function toggleLabelSelectForHotKey () {
      try {
        const { children } = self.root;
        const labels = children?.find(child => child.name === 'tricks');
        const selectedLabel = labels?.children?.find(lbl => lbl.isHotKeySelected);
        return selectedLabel?.setSelectedOnly?.(true);
      } catch (e) {
        console.error(e);
        return showError(e);
      }
    }

    function unSelectLabelAll () {
      try {
        const { children } = self.root;
        const labels = children?.find(child => child.name === 'tricks');
        const selectedLabel = labels?.children?.forEach(lbl => lbl.setSelectedOnly?.(false));
        // return selectedLabel?.setSelectedOnly?.(false);
      } catch (e) {
        console.error(e);
        return showError(e);
      }
    }

    function unSelectLabelByValue (labelValue) {
      try {
        const { children } = self.root;
        const labels = children?.find(child => child.name === 'tricks');
        const selectedLabel = labels?.children?.find(lbl => lbl.value === labelValue);
        return selectedLabel?.setSelectedOnly?.(false);
      } catch (e) {
        console.error(e);
        return showError(e);
      }
    }

    function getSelectedLabelColor(){
      try {
        const { children } = self.root;
        const labels = children?.find(child => child.name === 'tricks');
        const selectedLabel = labels?.children?.find(lbl => lbl.selected);
        if (!selectedLabel) return null;
        return selectedLabel?.background ?? null;
      } catch (e) {
        console.error(e);
        return showError(e);
      }
    }

    function getCurrentAnnotationRegions() {
      if (self.viewingAll) {
        const selectedAnnotation = self.selected;
        const areas = selectedAnnotation?.areas?._data ? [...selectedAnnotation?.areas?._data] : [];
        const selected = selectedAnnotation?.regionStore?.selectedIds? [...selectedAnnotation?.regionStore?.selectedIds] : [];
        return areas?.map(d => ({ ...getSnapshot(d[1].value.storedValue), locked: d[1].value.storedValue?.locked, hidden: d[1].value.storedValue?.hidden, isSelected: selected.some(s => s === d[0]) }));
      } else {
        const selectedAnnotation = self.annotations.find(anno => anno.selected);
        const areas = selectedAnnotation?.trackedState?.areas?._data ? [...selectedAnnotation?.trackedState?.areas?._data] : [];
        const selected = selectedAnnotation?.regionStore?.selectedIds? [...selectedAnnotation?.regionStore?.selectedIds] : [];
        return areas?.map(d => ({ ...getSnapshot(d[1].value.storedValue), locked: d[1].value.storedValue?.locked, hidden: d[1].value.storedValue?.hidden, isSelected: selected.some(s => s === d[0]) }));
      }
    }

    function selectRegionById(regionId, isEditing = false) {
      const selected = self.selected.regionStore.selectedIds;
      const region = self.selected.regionStore.findRegion(regionId);
      const labelings = region.labeling?.from_name?.selectedLabels;
      if (selected.includes(regionId) && !isEditing) {
        self.selected.regionStore.selection.unselect(region);
        labelings?.map(lbl => {
          lbl.toggleSelected?.();
        });
      }
      else {
        self.selected.regionStore.unselectAll();
        self.selected.regionStore.selection.select(region);
      }
    }

    function updateTaskTitle() {
      const { config, taskMeta } = self.store;
      if (!self.root) initRoot(config);
      try {
        const meta = JSON.parse(taskMeta);
        const w_id = meta.workout_id;
        const athlete_name = meta.username;
        const header = self.root?.children?.find(itm => itm.type === 'header');
        // const video = self.root?.children?.find(itm => itm.name === 'video');
        // const videoUrl = video?._value;
        // const duration = (video?.length) / Number(video?.framerate) || 0;
        // const timeDate = new Date(duration * 1000000);
        const onlyTime = meta.start_time?.split('.')[0];// timeDate.toISOString().match(/T(.*?)Z/)?.[1];
        // const videoTitle = videoUrl?.split('/')?.pop() || 'video_title';
        const headerTitle = `${athlete_name ?? ''} ${onlyTime ?? ''} ${w_id ? '- ' + w_id: ''}`;
        // const headerTitle = `${athlete_name} ${onlyTime}`;
        if (header && headerTitle.trim() !== '') {
          header._value = headerTitle;
          header.value = headerTitle;
        }
      } catch(err) {
      console.error("ERROR while parsing task meta", err);
      }
    }

    function regionsStateChange() {
      self.store?.annotationRegionsStateChanged?.();
    }

    function findNonInteractivePredictionResults() {
      return self.predictions.reduce((results, prediction) => {
        return [
          ...results,
          ...prediction._initialAnnotationObj.filter(result => result.interactive_mode === false).map(r => ({ ...r })),
        ];
      }, []);
    }

    function getVideoUrl() {
      const video = self.root?.children?.find(itm => itm.name === 'video');
      const videoUrl = video?._value;
      return videoUrl;
    }

    function getAnnotationOffset(selectedPk = null) {
      const selectedOffset = self.selected.offset;
      if (!selectedOffset || selectedOffset == 0) {
        const { taskMeta } = self.store;
        const pk = (selectedPk && !isNaN(Number(selectedPk))) ? Number(selectedPk) : Number(self.selected.pk);
        const meta = JSON.parse(taskMeta);
        const annotation_offsets = meta.annotations_offset || [];
        const selectionOffset = annotation_offsets.find(o => `${o.annotation}` === `${pk}`)?.offset
        const selected_offset = ((selectionOffset !== null && selectionOffset !== undefined) && !isNaN(Number(selectionOffset))) ? selectionOffset : meta.offset;
        const returnValue =  selected_offset && !isNaN(selected_offset) ? selected_offset !== selectedOffset ? selected_offset: selectedOffset : 0;
        return returnValue
        // return selected_offset && !isNaN(selected_offset) ? selected_offset !== selectedOffset ? selected_offset: selectedOffset : 0;
      } else {
        return selectedOffset;
      }
    }

    function createItem(options) {
      const { user, config } = self.store;

      if (!self.root) initRoot(config);

      let pk = options.pk || options.id;

      if (options.type === 'annotation' && pk && isNaN(pk)) {
        /* something happened where our annotation pk was replaced with the id */
        pk = self.annotations?.[self.annotations.length - 1]?.storedValue?.pk;
      }

      //
      const node = {
        userGenerate: false,
        createdDate: Utils.UDate.currentISODate(),

        ...options,

        // id is internal so always new to prevent collisions
        id: guidGenerator(5),
        // pk and id may be missing, so undefined | string
        pk: pk && String(pk),
        root: self.root,
      };

      if (user && !('createdBy' in node)) node['createdBy'] = user.displayName;
      if (options.user) node.user = options.user;

      return node;
    }

    function addPrediction(options = {}) {
      options.editable = false;
      options.type = 'prediction';

      const item = createItem(options);

      if (isFF(FF_SIMPLE_INIT)) {
        self.predictions.push(item);

        return self.predictions.at(-1);
      }

      self.predictions.unshift(item);

      const record = self.predictions[0];

      return record;
    }

    function addAnnotation(options = {}) {
      options.type = 'annotation';

      const item = createItem(options);

      if (item.userGenerate) {
        let actual_user;

        if (isFF(FF_DEV_3034)) {
          // drafts can be created by other user, but we don't have much info
          // so parse "id", get email and find user by it
          const email = emailFromCreatedBy(item.createdBy);
          const user = email && self.store.users.find(user => user.email === email);

          if (user) actual_user = user.id;
        }
        item.completed_by = actual_user ?? getRoot(self).user?.id ?? undefined;
      }

      if (isFF(FF_SIMPLE_INIT)) {
        self.annotations.push(item);
      } else {
        self.annotations.unshift(item);
      }

      const record = self.annotations.at(isFF(FF_SIMPLE_INIT) ? -1 : 0);

      record.addVersions({
        result: options.result,
        draft: options.draft,
      });

      return record;
    }

    function createAnnotation(options = { userGenerate: true }) {
      const result = isFF(FF_DEV_1621) ? findNonInteractivePredictionResults() : [];
      const c = self.addAnnotation({ ...options, result });

      if (result && result.length) {
        const ids = {};

        // Area id is <uniq-id>#<annotation-id> to be uniq across all tree
        result.forEach(r => {
          if ('id' in r) {
            const id = r.id.replace(/#.*$/, `#${c.id}`);

            ids[r.id] = id;
            r.id = id;
          }
        });

        result.forEach(r => {
          if (r.parent_id) {
            if (ids[r.parent_id]) r.parent_id = ids[r.parent_id];
            // impossible case but to not break the app better to reset it
            else r.parent_id = null;
          }
        });

        selectAnnotation(c.id);
        c.deserializeAnnotation(result);
        // reinit will trigger `updateObjects()` so we omit it here
        c.reinitHistory();
      } else {
        c.setDefaultValues();
      }
      return c;
    }


    function addHistory(options = {}) {
      options.type = 'history';

      const item = createItem(options);

      self.history.push(item);

      const record = self.history[self.history.length - 1];

      return record;
    }

    function clearHistory() {
      self.history.forEach(item => destroy(item));
      self.history.length = 0;
    }

    function selectHistory(item) {
      self.selectedHistory = item;
      setTimeout(() => {
      // update classifications after render
        const updatedItem = item ?? self.selected;

        Array.from(updatedItem.names.values())
          .filter(t => t.isClassificationTag)
          .forEach(t => t.updateFromResult([]));

        updatedItem?.results
          .filter(r => r.area.classification)
          .forEach(r => r.from_name.updateFromResult?.(r.mainValue));
      });
    }

    function addAnnotationFromPrediction(entity) {
    // immutable work, because we'll change ids soon
      const s = entity._initialAnnotationObj.map(r => ({ ...r }));
      const c = self.addAnnotation({ userGenerate: true, result: s });

      const ids = {};

      // Area id is <uniq-id>#<annotation-id> to be uniq across all tree
      s.forEach(r => {
        if ('id' in r) {
          const id = r.id.replace(/#.*$/, `#${c.id}`);

          ids[r.id] = id;
          r.id = id;
        }
      });

      s.forEach(r => {
        if (r.parent_id) {
          if (ids[r.parent_id]) r.parent_id = ids[r.parent_id];
          // impossible case but to not break the app better to reset it
          else r.parent_id = null;
        }
      });

      selectAnnotation(c.id);
      c.deserializeAnnotation(s);
      // reinit will trigger `updateObjects()` so we omit it here
      c.reinitHistory();

      // parent link for the new annotations
      if (entity.pk) {
        if (entity.type === 'prediction') {
          c.parent_prediction = parseInt(entity.pk);
        }
        else if (entity.type === 'annotation') {
          c.parent_annotation = parseInt(entity.pk);
        }
      }

      return c;
    }

    /** ERRORS HANDLING */
    const handleErrors = errors => {
      self.addErrors(errors);
    };

    const addErrors = errors => {
      const ids = [];

      const newErrors = [...(self.validation ?? []), ...errors].reduce((res, error) => {
        const id = error.identifier;

        if (ids.indexOf(id) < 0) {
          ids.push(id);
          res.push(error);
        }

        return res;
      }, []);

      self.validation = newErrors;
    };

    const afterCreate = () => {
      self._validator = new DataValidator();
      self._validator.addErrorCallback(handleErrors);
      updateTaskTitle();
      // const authEMail = self.store?.user?.email;
      // if (!(self.selected?.user?.email === authEMail)) {
      //   const { annotations } = self;
      //   const authAnnotation = annotations.find(a => a.user?.email === authEMail);
      //   // if (authAnnotation) selectAnnotation(authAnnotation.id);
      // }
    };

    const beforeDestroy = () => {
      self._validator.removeErrorCallback(handleErrors);
    };

    const validate = (validatorName, data) => {
      return self._validator.validate(validatorName, data);
    };

    const resetAnnotations = () => {
      self.selected = null;
      self.selectedHistory = null;
      self.annotations = [];
      self.predictions = [];
      self.history = [];
    };

    return {
      afterCreate,
      beforeDestroy,

      toggleViewingAllAnnotations,

      initRoot,
      addToName,
      addName,
      upsertToName,
      updateRoot,
      updateLabels,
      unshiftProjectLabels,
      updateVideoSrc,
      updateTimeSeriesData,

      regionsStateChange,

      getVideoUrl,

      updateTaskTitle,
      getAnnotationOffset,

      getLabelColor,
      getLabelByValue,
      toggleLabelSelectByValue,
      completeToggleLabelSelectByValue,
      unSelectLabelAll,
      unSelectLabelByValue,
      toggleLabelSelectForHotKey,
      getSelectedLabelColor,
      getCurrentAnnotationRegions,
      selectRegionById,

      addPrediction,
      addAnnotation,
      createAnnotation,
      addAnnotationFromPrediction,
      addHistory,
      clearHistory,
      selectHistory,

      addErrors,
      validate,

      selectAnnotation,
      selectPrediction,

      _selectItem,
      _unselectAll,

      deleteAnnotation,
      clearDeletedParents,
      resetAnnotations,
    };
  });

export default types.compose('AnnotationStore',
  AnnotationStoreModel,
  ...(isFF(FF_DEV_3617) ? [StoreExtender] : []),
);
