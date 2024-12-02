/* global LSF_VERSION */

import {
  destroy,
  detach,
  flow,
  getEnv, getParent,
  getSnapshot,
  isRoot,
  types,
  walk
} from 'mobx-state-tree';

import uniqBy from 'lodash/uniqBy';
import InfoModal from '../components/Infomodal/Infomodal';
import { Hotkey } from '../core/Hotkey';
import ToolsManager from '../tools/Manager';
import Utils from '../utils';
import { guidGenerator } from '../utils/unique';
import { clamp, delay, isDefined } from '../utils/utilities';
import AnnotationStore from './Annotation/store';
import Project from './ProjectStore';
import Settings from './SettingsStore';
import Task from './TaskStore';
import { UserExtended } from './UserStore';
import { UserLabels } from './UserLabels';
import { FF_DEV_1536, FF_LSDV_4620_3_ML, FF_LSDV_4998, FF_SIMPLE_INIT, isFF } from '../utils/feature-flags';
import { CommentStore } from './Comment/CommentStore';
import { destroy as destroySharedStore } from '../mixins/SharedChoiceStore/mixin';
import { BASE_URL_VIDEO, DEV_ENV_HOST, FALLBACK_STORAGE_FILE_NAME, LBL_STD_SVC, PROD_ENV_HOST, STAGE_ENV_HOST, TEMP_WORKOUT_ID, VERSION, WORKOUT_SVC } from './../utils/constants';
import { getApiHost } from '../utils/helpers';
import { fetchAdminsList } from '../../../../RBAC';
// import { ChartRegionModel } from '../regions';

const hotkeys = Hotkey('AppStore', 'Global Hotkeys');

const tagsObj = types.model({
  id: types.integer,
  value: types.optional(types.string, '')
});

const videoOptObj = types.model({
  video: types.string,
  title: types.optional(types.string, ''),
});

const toggleBoolObj = types.model({
  flag: types.optional(types.boolean, false),
});

const userLabelObj = types.model({
  user: types.optional(types.string, ''),
  labels: types.optional(types.array(types.string), []),
})

const selectedLabelObj = types.model({
  value: types.optional(types.string, ''),
  isAborted: types.optional(types.boolean, false),
  isCompleted: types.optional(types.boolean, false),
});

export default types
  .model('AppStore', {
    /**
     * XML config
     */
    config: types.string,

    /**
     * Custom array
     */
    labelsData: types.array(tagsObj),
    labelOptions: types.array(tagsObj),
    labelOptLoading: types.optional(toggleBoolObj, getSnapshot(toggleBoolObj.create())),
    labelOptErrMsg: types.maybeNull(types.string),
    showLabelsModal: types.maybeNull(toggleBoolObj),
    /**
     * Task with data, id and project
     */
    task: types.maybeNull(Task),

    taskData: types.maybeNull(types.string, ''),

    taskDataFlag: types.maybeNull(toggleBoolObj),
    
    prevTask: types.maybeNull(types.string),
    nextTask: types.maybeNull(types.string),
    tasksDataList: types.array(types.maybe(types.string)),
    tasksDataListOptions: types.array(types.maybe(videoOptObj)),
    tasksDataListOptionsLoading: types.maybeNull(toggleBoolObj),
    tasksDataListOptionsErrMsg: types.maybeNull(types.string),
    showVideoOptions: types.maybeNull(toggleBoolObj),
    defaultThumbnailIndex: types.optional(types.number, 0),

    shouldShowAudioWave: types.maybeNull(toggleBoolObj),

    workoutId: types.optional(types.string, ''),
    storage_filename: types.optional(types.string, ''),

    project: types.maybeNull(Project),


    userLabel: types.maybeNull(types.array(userLabelObj), []),

    /**
     * History of task {taskId, annotationId}:
    */
    taskHistory: types.array(types.model({
      taskId: types.number,
      annotationId: types.maybeNull(types.string),
    }), []),

    /**
     * Configure the visual UI shown to the user
     */
    interfaces: types.array(types.string),

    /**
     * Flag for labeling of tasks
     */
    explore: types.optional(types.boolean, false),

    /**
     * Annotations Store
     */
    annotationStore: types.optional(AnnotationStore, {
      annotations: [],
      predictions: [],
      history: [],
    }),

    /**
     * Comments Store
     */
    commentStore: types.optional(CommentStore, {
      comments: [],
    }),

    /**
     * User of Label Studio
     */
    user: types.optional(types.maybeNull(types.safeReference(UserExtended)), null),

    /**
     * Debug for development environment
     */
    debug: window.HTX_DEBUG === true,

    /**
     * Settings of Label Studio
     */
    settings: types.optional(Settings, {}),

    /**
     * Data of description flag
     */
    description: types.maybeNull(types.string),
    // apiCalls: types.optional(types.boolean, true),

    /**
     * Flag for settings
     */
    showingSettings: types.optional(types.boolean, false),
    /**
     * Flag
     * Description of task in Label Studio
     */
    showingDescription: types.optional(types.boolean, false),
    /**
     * Loading of Label Studio
     */
    isLoading: types.optional(types.boolean, true),
    /**
     * Submitting task; used to prevent from duplicating requests
     */
    isSubmitting: false,
    /**
     * Flag for disable task in Label Studio
     */
    noTask: types.optional(types.boolean, false),
    /**
     * Flag for no access to specific task
     */
    noAccess: types.optional(types.boolean, false),
    /**
     * Finish of labeling
     */
    labeledSuccess: types.optional(types.boolean, false),

    /**
     * Show or hide comments section
     */
    showComments: false,

    /**
     * Dynamic preannotations
     */
    _autoAnnotation: false,

    /**
     * Auto accept suggested annotations
     */
    _autoAcceptSuggestions: false,

    /**
     * Indicator for suggestions awaiting
     */
    awaitingSuggestions: false,

    users: types.optional(types.array(UserExtended), []),

    userLabels: isFF(FF_DEV_1536) ? types.optional(UserLabels, { controls: {} }) : types.undefined,

    queueTotal: types.optional(types.number, 0),

    queuePosition: types.optional(types.number, 0),
    /**Start Seek position used to create regions on audio with hotkey */
    htkRegionStart: types.optional(types.number, 0),

    /*** Chart Regions */
    // chartRegions: types.maybe(types.array(ChartRegionModel), []),

    shouldDrawChartRegion: types.maybeNull(toggleBoolObj),

    chartRegionToDraw: types.maybe(types.model({ start: types.number, end: types.number }), {}),

    shouldEditChartRegion: types.maybeNull(toggleBoolObj),
    annotationRegionsStateChange: types.maybeNull(toggleBoolObj),
    videoRefChange: types.maybeNull(toggleBoolObj),

    chartRegionToEdit: types.maybe(types.model({ start: types.number, end: types.number, id: types.string }), {}),

    offset: types.optional(types.number, 0),
    currentAnnotationOffset: types.optional(types.number, 0),
    taskMeta: types.optional(types.string, JSON.stringify({})),
    metaUpdated: types.optional(types.model({ updatedAt: types.string }), { updatedAt: 'a' }),

    selectedLabels: types.optional(types.array(selectedLabelObj), []),

    selectedSegments: types.optional(types.array(types.string), [],),

    stage: types.optional(types.string, 'dev'),
    adminsList: types.optional(types.array(types.string), []),
    adminsListLoading: types.optional(toggleBoolObj, getSnapshot(toggleBoolObj.create())),
    hasAdminAccess: types.maybeNull(types.boolean, false),
    projectLabels: types.optional(types.string, ''),
    shouldUpdateProjectLabels: types.maybeNull(toggleBoolObj),
  })
  .preProcessSnapshot((sn) => {
    // This should only be handled if the sn.user value is an object, and converted to a reference id for other
    // entities.
    if (typeof sn.user !== 'number') {
      const currentUser = sn.user ?? window.APP_SETTINGS?.user ?? null;

      // This should never be null, but just incase the app user is missing from constructor or the window
      if (currentUser) {
        sn.user = currentUser.id;

        sn.users = sn.users?.length ? [
          currentUser,
          ...sn.users.filter(({ id }) => id !== currentUser.id),
        ] : [currentUser];
      }

    }
    return {
      ...sn,
      _autoAnnotation: localStorage.getItem('autoAnnotation') === 'true',
      _autoAcceptSuggestions: localStorage.getItem('autoAcceptSuggestions') === 'true',
    };
  })
  .volatile(() => ({
    version: typeof LSF_VERSION === 'string' ? LSF_VERSION : '0.0.0',
    initialized: false,
    hydrated: false,
    suggestionsRequest: null,
    // @todo should be removed along with the FF; it's used to detect FF in other parts
    simpleInit: isFF(FF_SIMPLE_INIT),
  }))
  .views(self => ({
    get events() {
      return getEnv(self).events;
    },
    get hasSegmentation() {
      // not an object and not a classification
      const isSegmentation = t => !t.getAvailableStates && !t.perRegionVisible;

      return Array.from(self.annotationStore.names.values()).some(isSegmentation);
    },
    get canGoNextTask() {
      const hasHistory = self.task && self.taskHistory && self.taskHistory.length > 1;

      if (hasHistory) {
        const lastTaskId = self.taskHistory[self.taskHistory.length - 1].taskId;

        return self.task.id !== lastTaskId;
      }
      return false;
    },
    get canGoPrevTask() {
      const hasHistory = self.task && self.taskHistory && self.taskHistory.length > 1;

      if (hasHistory) {
        const firstTaskId = self.taskHistory[0].taskId;

        return self.task.id !== firstTaskId;
      }
      return false;
    },
    get forceAutoAnnotation() {
      return getEnv(self).forceAutoAnnotation;
    },
    get forceAutoAcceptSuggestions() {
      return getEnv(self).forceAutoAcceptSuggestions;
    },
    get autoAnnotation() {
      return self.forceAutoAnnotation || self._autoAnnotation;
    },
    get autoAcceptSuggestions() {
      return self.forceAutoAcceptSuggestions || self._autoAcceptSuggestions;
    },
  }))
  .actions(self => ({
    fetchTimeSeriesData: flow(function* fetchTimeSeriesData() {
      const selfData = JSON.parse(self.taskData);
        const initialData = {
          ...selfData,
          ts_foot: {
            time: [0],
            gyro_x: [0],
            gyro_y: [0],
            gyro_z: [0],
            accel_x: [0],
            accel_y: [0],
            accel_z: [0],
          },
          ts_wrist: {
            time: [0],
            gyro_x: [0],
            gyro_y: [0],
            gyro_z: [0],
            accel_x: [0],
            accel_y: [0],
            accel_z: [0],
          }
        };
      try {
        const response = yield fetch(BASE_URL_VIDEO+'get_workout_data/'+self.workoutId+'/reformatted');
        const data = yield response.json();
        const data_foot = { ...data.data.foot_right }
        initialData.ts_foot = data_foot;
      } catch (error) {
        console.error('Error fetching time series data:', error);
      }
      self.taskData = JSON.stringify(initialData);
      self.annotationStore.updateTimeSeriesData(initialData);
      self.taskDataFlag.flag = !self.taskDataFlag.flag;
      self.task.updateData(JSON.stringify(initialData));
      return self;
    }),
  }))
  .actions(self => {
    let appControls;

    function changeHtkRegionStart(val){
      self.htkRegionStart = val;
    }

    function updateTasksDataList(srcData){
      self.tasksDataList = [...srcData];
      return self;
    }

    function setAdminsList(newList) {
      self.adminsList = newList;
    }

    function setAdminsListLoading(newVal=false) {
      self.adminsListLoading.flag = newVal;
      setFlags({ isLoading: newVal });
    }

    function setWorkoutId(id){
      self.workoutId = id;
    }

    function setEnvironment(env) {
      self.stage = env;
    }

    function setShowLabelsModal(value = false) {
      self.showLabelsModal.flag = value;
    }

    const fetchLabelOptions = flow(function* (){
      self.labelOptions = [];
      self.labelOptLoading.flag = true;
      self.labelOptErrMsg = "";
      try {
        // ... yield can be used in async/await style
        const base_host = getApiHost('dev');
        const resp = yield fetch(`${base_host}${LBL_STD_SVC}`+`exercise/${self.project.id}`);
        // const resp = yield fetch('https://mobile.highqfit.com/labelstudio_svc/exercise/2');
        const { ok, status } = resp;
        if (ok && (status >=200 && status <=400)) {
          const data = yield resp.json();
          self.labelOptions = data.body;
        } else {
          const jsonRes = yield resp.json();
          self.labelOptErrMsg = jsonRes?.message ?? "Unable to fetch video options";
        }
    } catch (error) {
        // ... including try/catch error handling
        console.error("Failed to fetch projects", error)
        self.labelOptErrMsg = "Unable to fetch Labels"
    }
    self.labelOptLoading.flag = false;
    return self.labelOptions.length;
    })

    function setShouldShowAudioWave(value = true) {
      self.shouldShowAudioWave.flag = value;
    }

    function setShowVideoOptions(value = false){
      self.showVideoOptions.flag = value;
      window.localStorage.setItem('showThumbnails', `${value}`);
    }

    const fetchVideoOptions = flow(function* (workoutId){
      self.tasksDataListOptions = [];
      self.tasksDataListOptionsLoading.flag = true;
      self.tasksDataListOptionsErrMsg = "";
      let _videoName = '';
      try {
        if (self.taskMeta) {
          const meta = JSON.parse(self.taskMeta);
          _videoName = meta.video_name;
        }
      } catch(err) {
        console.error("ERROR while getting video name from meta", err);
      }
      const videoName = self.storage_filename ? self.storage_filename.split('/')[2] : _videoName;
      try {
        const base_host = getApiHost(self.stage);
        // ... yield can be used in async/await style
        const resp = yield fetch(`${base_host}${WORKOUT_SVC}` + 'get_workout_videos_urls/' + workoutId + `${videoName ? '?exclude_videos=' + videoName: ''}`);
        const { ok, status } = resp;
        if (ok && (status >=200 && status <=400)) {
          const data = yield resp.json();
          data?.default_video_index ? self.defaultThumbnailIndex = data.default_video_index : self.defaultThumbnailIndex = 0;
          data?.urls ? self.tasksDataListOptions = [...data.urls] : self.tasksDataListOptions = [];
        } else {
          const jsonRes = yield resp.json();
          self.tasksDataListOptionsErrMsg = jsonRes?.message ?? "Unable to fetch video options";
        }
        // self.tasksDataListOptions.unshift({ video : JSON.parse(self.task.data).video, title: 'default'});
    } catch (error) {
        // ... including try/catch error handling
        console.error("Failed to fetch video options", error);
        self.tasksDataListOptionsErrMsg = error.message ?? "Unable to fetch video options";
    }
    self.tasksDataListOptionsLoading.flag = false;
    // console.log(self.tasksDataListOptionsErrMsg);
    return self.tasksDataListOptions.length;
    })

    function unshiftVideoOptions(firstOption){
      self.tasksDataListOptions.unshift(firstOption);
      return self.tasksDataListOptions.length;
    };

    function addDefaultToVideoOptions(firstOption){
      self.tasksDataListOptions.splice(self.defaultThumbnailIndex, 0, firstOption);
      return self.tasksDataListOptions.length;
    };

    // function setChartRegions(chartRegions) {
    //   console.log('new chart regions received', chartRegions);
    //   self.chartRegions = chartRegions;
    // };

    function setChartRegionDrawFlag(flag = false) {
      self.shouldDrawChartRegion.flag = flag;
    }

    function setChartRegionToDraw(newChartRegion) {
      self.chartRegionToDraw = newChartRegion;
    }

    function resetChartRegionToDraw() {
      self.chartRegionToDraw = { start: -1, end: -1 };
      self.setChartRegionDrawFlag();
    }

    function setChartRegionEditFlag(flag = false) {
      self.shouldEditChartRegion.flag = flag;
    }

    function annotationRegionsStateChanged() {
      self.annotationRegionsStateChange.flag = !self.annotationRegionsStateChange.flag;
    }

    function videoRefChanged() {
      self.videoRefChange.flag = !self.videoRefChange.flag;
    }

    function setChartRegionToEdit(newChartRegion) {
      self.chartRegionToEdit = newChartRegion;
    }

    function resetChartRegionToEdit() {
      self.chartRegionToEdit = { start: -1, end: -1, id: '' };
      self.setChartRegionEditFlag();
    }

    function addLabel(labels = []){
      if(labels.length > 0){
        self.labelsData = labels;
      }
      else {
        self.labelsData = [];
      }
    }

    function setUserLabel(userLabels) {
      self.userLabel = userLabels;
    };

    function setAppControls(controls) {
      appControls = controls;
    }

    function setSelectedLabels (selectedLabels) {
      self.selectedLabels = [...selectedLabels];
    }

    function pushToSelectedLabels (newSelection) {
      if (self.selectedLabels.some(itm => itm.value === newSelection.value)) {
        return;
      }
      return self.selectedLabels.push({...newSelection});
      // self.selectedLabels.push({...newSelection});
      // return self.selectedLabels;
    }

    function removeFromSelectedLabels(labelValue) {
      const temp = self.selectedLabels.filter(itm => itm.value !== labelValue);
      return self.selectedLabels = [...temp];
    }

    function updateInSelectedLabelsByValue(labelValue, updatedLabel) {
      const temp = self.selectedLabels;
      const idx = temp.findIndex(itm => itm.value === labelValue);
      if(idx > -1) {
        temp[idx] = updatedLabel;
        return self.selectedLabels = [...temp];
      }
    }

    function pushToSelectedSegments(segment) {
      try{
        const converted = JSON.stringify(segment);
        //Converting the string to a JSON so that we don't have an error in Removing function.
        JSON.parse(converted);
        self.selectedSegments.push(converted);
      }
      catch(err) {
        console.error('Unable to stringify Segment', err);
      }
    }

    function removeFromSelectedSegments(id) {
      const idx = self.selectedSegments.findIndex(itm => JSON.parse(itm).id === id);
      if (idx > -1) {
        self.selectedSegments.splice(idx, 1);
      }
    }

    function clearApp() {
      appControls?.clear();
    }

    function renderApp() {
      appControls?.render();
    }
    /**
     * Update settings display state
     */
    function toggleSettings() {
      self.showingSettings = !self.showingSettings;
    }

    /**
     * Update description display state
     */
    function toggleDescription() {
      self.showingDescription = !self.showingDescription;
    }

    function setFlags(flags) {
      const names = [
        'showingSettings',
        'showingDescription',
        'isLoading',
        'isSubmitting',
        'noTask',
        'noAccess',
        'labeledSuccess',
        'awaitingSuggestions',
      ];

      for (const n of names) if (n in flags) self[n] = flags[n];
    }

    /**
     * Check for interfaces
     * @param {string} name
     * @returns {string | undefined}
     */
    function hasInterface(...names) {
      return self.interfaces.find(i => names.includes(i)) !== undefined;
    }

    function addInterface(name) {
      return self.interfaces.push(name);
    }

    function toggleInterface(name, value) {
      const index = self.interfaces.indexOf(name);
      const newValue = value ?? (index < 0);

      if (newValue) {
        if (index < 0) self.interfaces.push(name);
      } else {
        if (index < 0) return;
        self.interfaces.splice(index, 1);
      }
    }

    function toggleComments(state) {
      return (self.showComments = state);
    }

    /**
     * Function
     */
    function afterCreate() {
      ToolsManager.setRoot(self);

      // important thing to detect Area atomatically: it hasn't access to store, only via global
      window.Htx = self;

      self.attachHotkeys();

      getEnv(self).events.invoke('labelStudioLoad', self);
      self.tasksDataListOptionsLoading = toggleBoolObj.create();
      self.annotationRegionsStateChange = toggleBoolObj.create();
      self.shouldUpdateProjectLabels = toggleBoolObj.create();
      self.videoRefChange = toggleBoolObj.create();
      self.metaUpdated = { updatedAt: 'aa' };
      if (!self.showLabelsModal) self.showLabelsModal = toggleBoolObj.create();
      if (!self.showVideoOptions) self.showVideoOptions = toggleBoolObj.create();
      if (!self.shouldShowAudioWave) self.shouldShowAudioWave = toggleBoolObj.create();
      if (!self.taskDataFlag) self.taskDataFlag = toggleBoolObj.create();
      if (!self.shouldDrawChartRegion) self.shouldDrawChartRegion = toggleBoolObj.create();
      if (!self.shouldEditChartRegion) self.shouldEditChartRegion = toggleBoolObj.create();
      self.shouldShowAudioWave.flag = true;
      const shouldShow = window.localStorage.getItem('showThumbnails')?.toLocaleLowerCase() === 'true';
      if (self.showVideoOptions) self.showVideoOptions.flag = shouldShow;
      console.info('LSF VERSION:', VERSION);
      if (!self.workoutId) self.workoutId = TEMP_WORKOUT_ID;
      if(!self.adminsList.length) {
        self.adminsListLoading.flag = true;
        // setFlags({ isLoading: true });
        // setAdminsList
        //fetchAdminsList(setAdminsListLoading, setAdminsList);
      }
      // self.annotationStore.unshiftProjectLabels(self.projectLabels);
    }

    function attachHotkeys() {
      // Unbind previous keys in case LS was re-initialized
      hotkeys.unbindAll();

      /**
       * Hotkey for submit
       */
      if (self.hasInterface('submit', 'update', 'review')) {
        hotkeys.addNamed('annotation:submit', () => {
          const annotationStore = self.annotationStore;

          if (annotationStore.viewingAll) return;

          const entity = annotationStore.selected;

          entity?.submissionInProgress();

          if (self.hasInterface('review')) {
            self.acceptAnnotation();
          } else if (!isDefined(entity.pk) && self.hasInterface('submit')) {
            self.submitAnnotation();
          } else if (self.hasInterface('update')) {
            self.updateAnnotation();
          }
        });
      }

      /**
       * Hotkey for skip task
       */
      if (self.hasInterface('skip', 'review')) {
        hotkeys.addNamed('annotation:skip', () => {
          if (self.annotationStore.viewingAll) return;

          const entity = self.annotationStore.selected;

          entity?.submissionInProgress();

          if (self.hasInterface('review')) {
            self.rejectAnnotation();
          } else {
            self.skipTask();
          }
        });
      }

      /**
       * Hotkey for delete
       */
      hotkeys.addNamed('region:delete-all', () => {
        const { selected } = self.annotationStore;

        if (window.confirm(getEnv(self).messages.CONFIRM_TO_DELETE_ALL_REGIONS)) {
          selected.deleteAllRegions();
        }
      });

      // create relation
      hotkeys.addNamed('region:relation', () => {
        const c = self.annotationStore.selected;

        if (c && c.highlightedNode && !c.relationMode) {
          c.startRelationMode(c.highlightedNode);
        }
      });

      // Focus fist focusable perregion when region is selected
      hotkeys.addNamed('region:focus', (e) => {
        e.preventDefault();
        const c = self.annotationStore.selected;

        if (c && c.highlightedNode && !c.relationMode) {
          c.highlightedNode.requestPerRegionFocus();
        }
      });

      // unselect region
      hotkeys.addNamed('region:unselect', function() {
        const c = self.annotationStore.selected;

        if (c && !c.relationMode && !c.isDrawing) {
          self.annotationStore.history.forEach(obj => {
            obj.unselectAll();
          });

          c.unselectAll();
        }
      });

      hotkeys.addNamed('region:visibility', function() {
        const c = self.annotationStore.selected;

        if (c && !c.relationMode) {
          c.hideSelectedRegions();
        }
      });

      hotkeys.addNamed('annotation:undo', function() {
        const annotation = self.annotationStore.selected;

        if (!annotation.isDrawing) annotation.undo();
      });

      hotkeys.addNamed('annotation:redo', function() {
        const annotation = self.annotationStore.selected;

        if (!annotation.isDrawing) annotation.redo();
      });

      hotkeys.addNamed('region:exit', () => {
        const c = self.annotationStore.selected;

        if (c && c.relationMode) {
          c.stopRelationMode();
        } else if (!c.isDrawing) {
          c.unselectAll();
        }
      });

      hotkeys.addNamed('region:delete', () => {
        const c = self.annotationStore.selected;

        if (c) {
          c.deleteSelectedRegions();
        }
      });

      hotkeys.addNamed('region:cycle', () => {
        const c = self.annotationStore.selected;

        c && c.regionStore.selectNext();
      });

      // duplicate selected regions
      hotkeys.addNamed('region:duplicate', (e) => {
        const { selected } = self.annotationStore;
        const { serializedSelection } = selected || {};

        if (!serializedSelection?.length) return;
        e.preventDefault();
        const results = selected.appendResults(serializedSelection);

        selected.selectAreas(results);
      });
    }

    function setTaskHistory(taskHistory) {
      self.taskHistory = taskHistory;
    }

    /**
     *
     * @param {*} taskObject
     * @param {*[]} taskHistory
     */
    function assignTask(taskObject) {
      if (taskObject && !Utils.Checkers.isString(taskObject.data)) {
        taskObject = {
          ...taskObject,
          data: JSON.stringify(taskObject.data),
        };
      }
      self.task = Task.create(taskObject);

      if (!self.taskHistory.some((x) => x.taskId === self.task.id)) {
        self.taskHistory.push({
          taskId: self.task.id,
          annotationId: null,
        });
      }
    }

    function assignConfig(config) {
      const cs = self.annotationStore;

      self.config = config;
      cs.initRoot(self.config);
      // cs.unshiftProjectLabels(self.projectLabels);
    }

    function reAssignConfig(config){
      destroy(self.annotationStore.root);
      const cs = self.annotationStore;
      
      self.config = config;
      cs.initRoot(self.config)
    }

    async function reAssignConfigLbl(config){
      // destroy(self.annotationStore.root);
      const cs = self.annotationStore;
      
      // self.config = config;
      cs.updateLabels(config);
      // self.attachHotkeys();
    }

    async function saveNewConfig(rootConfig){
      if(rootConfig && rootConfig.trim() !== ""){
        return await getEnv(self).events.invoke('updateProject',rootConfig);
        
      }
    }

    async function saveOffset(newOffset) {
      if (!isNaN(Number(newOffset))) {
        // self.offset = newOffset;
        self.currentAnnotationOffset = newOffset;
        const selectedAnn = (self.annotationStore.selected.pk && !isNaN(Number(self.annotationStore.selected.pk))) ? Number(self.annotationStore.selected.pk) : null;
        // return await getEnv(self).events.invoke('updateOffset', newOffset, selectedAnn);
        return self.currentAnnotationOffset;
      }
    }

    function getCurrentAnnotationOffset() {
      return self.currentAnnotationOffset;
    }

    async function saveOffsetOnAnnotationSubmit(pk = -1, offsetVal) {
      const selectedAnn = (self.annotationStore.selected.pk && !isNaN(Number(self.annotationStore.selected.pk))) ? Number(self.annotationStore.selected.pk) : null;
      const ann_id = (pk && pk > -1) ? pk : selectedAnn;
      const offset = (offsetVal !== null && offsetVal !== undefined) ? offsetVal: self.currentAnnotationOffset;
      return await getEnv(self).events.invoke('updateOffset', offset, ann_id);
    }

    function updateProjectLabels(newLabels) {
      self.projectLabels = newLabels;
      self.shouldUpdateProjectLabels.flag = !self.shouldUpdateProjectLabels.flag;
    }

    function setTaskMeta(taskMeta) {
      if (typeof taskMeta !== 'string') {
        try{
          self.taskMeta = JSON.stringify(taskMeta);
          self.annotationStore.updateTaskTitle?.();
        } catch (err) {
          console.error('ERROR converting taskMeta to JSON string');
          console.error(err);
          return;
        }
      } else {
        self.taskMeta = taskMeta;
        self.annotationStore.updateTaskTitle?.();
      }
      if (Object.keys(JSON.parse(self.taskMeta)).length && JSON.parse(self.taskMeta).workout_id) {
        self.workoutId = JSON.parse(self.taskMeta).workout_id;
        self.stage = JSON.parse(self.taskMeta).environment;
      }
      self.metaUpdated = { updatedAt: `${Date.now()}` };
    }

    /* eslint-disable no-unused-vars */
    function showModal(message, type = 'warning') {
      InfoModal[type](message);

      // InfoModal.warning("You need to label at least something!");
    }
    /* eslint-enable no-unused-vars */

    function submitDraft(c, params = {}) {
      return new Promise(resolve => {
        const events = getEnv(self).events;

        if (!events.hasEvent('submitDraft')) return resolve();
        const res = events.invokeFirst('submitDraft', self, c, params);

        if (res && res.then) res.then(resolve);
        else resolve(res);
      });
    }

    // Set `isSubmitting` flag to block [Submit] and related buttons during request
    // to prevent from sending duplicating requests.
    // Better to return request's Promise from SDK to make this work perfect.
    function handleSubmittingFlag(fn, defaultMessage = 'Error during submit') {
      if (self.isSubmitting) return;
      self.setFlags({ isSubmitting: true });
      const res = fn();

      self.commentStore.setAddedCommentThisSession(false);
      // Wait for request, max 5s to not make disabled forever broken button;
      // but block for at least 0.2s to prevent from double clicking.

      Promise.race([Promise.all([res, delay(200)]), delay(5000)])
        .catch(err => {
          showModal(err?.message || err || defaultMessage);
          console.error(err);
        })
        .then(() => {
          // window.location.reload();
          self.setFlags({ isSubmitting: false });
        });
    }
    function incrementQueuePosition(number = 1) {
      self.queuePosition = clamp(self.queuePosition + number, 1, self.queueTotal);
    }

    function submitAnnotation() {
      if (self.isSubmitting) return;

      const entity = self.annotationStore.selected;
      const event = entity.exists ? 'updateAnnotation' : 'submitAnnotation';

      entity.beforeSend();

      if (!entity.validate()) return;

      entity.sendUserGenerate();
      handleSubmittingFlag(async () => {
        await getEnv(self).events.invoke(event, self, entity);
        self.incrementQueuePosition();
        // entity.dropDraft();
        // window.location.reload();
      });
      entity.dropDraft();
    }

    function updateAnnotation(extraData) {
      if (self.isSubmitting) return;

      const entity = self.annotationStore.selected;

      entity.beforeSend();

      if (!entity.validate()) return;

      handleSubmittingFlag(async () => {
        await getEnv(self).events.invoke('updateAnnotation', self, entity, extraData);
        self.incrementQueuePosition();
        // entity.dropDraft();
        // window.location.reload();
      });
      entity.dropDraft();
      !entity.sentUserGenerate && entity.sendUserGenerate();
    }

    function skipTask(extraData) {
      if (self.isSubmitting) return;
      handleSubmittingFlag(() => {
        getEnv(self).events.invoke('skipTask', self, extraData);
        self.incrementQueuePosition();
      }, 'Error during skip, try again');
    }

    function unskipTask() {
      if (self.isSubmitting) return;
      handleSubmittingFlag(() => {
        getEnv(self).events.invoke('unskipTask', self);
      }, 'Error during cancel skipping task, try again');
    }

    function acceptAnnotation() {
      if (self.isSubmitting) return;

      handleSubmittingFlag(async () => {
        const entity = self.annotationStore.selected;

        entity.beforeSend();
        if (!entity.validate()) return;

        const isDirty = entity.history.canUndo;

        entity.dropDraft();
        await getEnv(self).events.invoke('acceptAnnotation', self, { isDirty, entity });
        self.incrementQueuePosition();
      }, 'Error during accept, try again');
    }

    function rejectAnnotation({ comment = null }) {
      if (self.isSubmitting) return;

      handleSubmittingFlag(async () => {
        const entity = self.annotationStore.selected;

        entity.beforeSend();
        if (!entity.validate()) return;

        const isDirty = entity.history.canUndo;

        entity.dropDraft();
        await getEnv(self).events.invoke('rejectAnnotation', self, { isDirty, entity, comment });
        self.incrementQueuePosition(-1);

      }, 'Error during reject, try again');
    }

    /**
     * Exchange storage url for presigned url for task
     */
    async function presignUrlForProject(url) {
      // Event invocation returns array of results for all handlers.
      const urls = await self.events.invoke('presignUrlForProject', self, url);

      const presignUrl = urls?.[0];

      return presignUrl;
    }

    /**
     * Reset annotation store
     */
    function resetState() {
      // Tools are attached to the control and object tags
      // and need to be recreated when we st a new task
      ToolsManager.removeAllTools();

      // Same with hotkeys
      Hotkey.unbindAll();
      self.attachHotkeys();
      const oldAnnotationStore = self.annotationStore;

      if (oldAnnotationStore) {
        oldAnnotationStore.beforeReset?.();
        if (isFF(FF_LSDV_4998)) {
          destroySharedStore();
        }
        detach(oldAnnotationStore);
        destroy(oldAnnotationStore);
      }

      self.annotationStore = AnnotationStore.create({ annotations: [] });
      self.initialized = false;
    }

    function resetAnnotationStore() {
      const oldAnnotationStore = self.annotationStore;

      if (oldAnnotationStore) {
        oldAnnotationStore.beforeReset?.();
        oldAnnotationStore.resetAnnotations?.();
      }
    }

    /**
     * Function to initialize annotation store
     * Given annotations and predictions
     * `completions` is a fallback for old projects; they'll be saved as `annotations` anyway
     */
    function initializeStore({ annotations = [], completions = [], predictions = [], annotationHistory }) {
      const as = self.annotationStore;

      // some hacks to properly clear react and mobx structures
      as.afterReset?.();

      if (!as.initialized) {
        as.initRoot(self.config);
        if (isFF(FF_LSDV_4620_3_ML) && !appControls?.isRendered()) {
          appControls?.render();
        }
      }

      // goal here is to deserialize everything fast and select only first annotation
      // no extra processes during eserialization and further processes triggered during select
      if (self.simpleInit) {
        window.STORE_INIT_OK = false;

        // add predictions and annotations to the store;
        // `hidden` will stop them from calling any rendering helpers;
        // correct annotation will be selected at the end and everything will be called inside.
        predictions.forEach(p => {
          const obj = as.addPrediction(p);
          const results = p.result.map(r => ({ ...r, origin: 'prediction' }));

          obj.deserializeResults(results, { hidden: true });
        });

        [...completions, ...annotations].forEach((c) => {
          const obj = as.addAnnotation(c);

          obj.deserializeResults(c.draft || c.result, { hidden: true });
        });

        window.STORE_INIT_OK = true;
        // simple logging to detect if simple init is used on users' machines
        console.log('LSF: deserialization is finished');

        // next line might be unclear after removing FF_SIMPLE_INIT
        // reversing the list caused problems before when task is reloaded and list is reversed again.
        // AnnotationsCarousel has its own ordering anyway, so we just keep technical order
        // as simple as possible.
        const current = as.annotations.at(-1);
        const currentPrediction = !current && as.predictions.at(-1);

        if (current) {
          as.selectAnnotation(current.id);
          // looks like we still need it anyway, but it's fast and harmless,
          // and we only call it once on already visible annotation
          current.reinitHistory();
        } else if (currentPrediction) {
          as.selectPrediction(currentPrediction.id);
        }

        // annotation history is set when annotation is selected,
        // so no need to set it here
      } else {
        (predictions ?? []).forEach(p => {
          const obj = as.addPrediction(p);

          as.selectPrediction(obj.id);
          obj.deserializeResults(p.result.map(r => ({
            ...r,
            origin: 'prediction',
          })));
        });

        [...(completions ?? []), ...(annotations ?? [])]?.forEach((c) => {
          const obj = as.addAnnotation(c);

          as.selectAnnotation(obj.id);
          obj.deserializeResults(c.draft || c.result);
          obj.reinitHistory();
        });

        const current = as.annotations.at(-1);

        if (current) current.setInitialValues();

        self.setHistory(annotationHistory);
      }

      if (!self.initialized) {
        self.initialized = true;
        getEnv(self).events.invoke('storageInitialized', self);
      }
    }

    function setHistory(history = []) {
      const as = self.annotationStore;

      as.clearHistory();

      // always check that history is for correct and submitted annotation
      if (!history.length || !as.selected?.pk) return;
      if (Number(as.selected.pk) !== Number(history[0].annotation_id)) return;

      (history ?? []).forEach(item => {
        const obj = as.addHistory(item);

        obj.deserializeResults(item.result ?? [], { hidden: true });
      });
    }

    const setAutoAnnotation = (value) => {
      self._autoAnnotation = value;
      localStorage.setItem('autoAnnotation', value);
    };

    const setAutoAcceptSuggestions = (value) => {
      self._autoAcceptSuggestions = value;
      localStorage.setItem('autoAcceptSuggestions', value);
    };

    const loadSuggestions = flow(function* (request, dataParser) {
      const requestId = guidGenerator();

      self.suggestionsRequest = requestId;

      self.setFlags({ awaitingSuggestions: true });
      const response = yield request;

      if (requestId === self.suggestionsRequest) {
        self.annotationStore.selected.setSuggestions(dataParser(response));
        self.setFlags({ awaitingSuggestions: false });
      }
    });

    function addAnnotationToTaskHistory(annotationId) {
      const taskIndex = self.taskHistory.findIndex(({ taskId }) => taskId === self.task.id);

      if (taskIndex >= 0) {
        self.taskHistory[taskIndex].annotationId = annotationId;
      }
    }

    async function postponeTask() {
      const annotation = self.annotationStore.selected;

      // save draft before postponing; this can be new draft with FF_DEV_4174 off
      // or annotation created from prediction
      await annotation.saveDraft({ was_postponed: true });
      await getEnv(self).events.invoke('nextTask');
      self.incrementQueuePosition();

    }

    function nextTask() {

      if (self.canGoNextTask) {
        const { taskId, annotationId } = self.taskHistory[self.taskHistory.findIndex((x) => x.taskId === self.task.id) + 1];

        getEnv(self).events.invoke('nextTask', taskId, annotationId);
        self.incrementQueuePosition();

      }

    }

    function prevTask(e, shouldGoBack = false) {
      const length = shouldGoBack ? self.taskHistory.length - 1 : self.taskHistory.findIndex((x) => x.taskId === self.task.id) - 1;

      if (self.canGoPrevTask || shouldGoBack) {
        const { taskId, annotationId } = self.taskHistory[length];

        getEnv(self).events.invoke('prevTask', taskId, annotationId);
        self.incrementQueuePosition(-1);

      }
    }

    function setUsers(users) {
      self.users.replace(users);
    }

    function mergeUsers(users) {
      self.setUsers(uniqBy([...getSnapshot(self.users), ...users], 'id'));
    }

    function updateTaskData(newData) {
      // const res = self.task.updateData(JSON.stringify({ video: newData}));
      // reAssignConfig(self.config);
      self.annotationStore.updateVideoSrc(newData);
      
    }

    return {
      setAdminsList,
      setAdminsListLoading,
      setWorkoutId,
      setEnvironment,
      setShowLabelsModal,
      fetchLabelOptions,
      setShowVideoOptions,
      fetchVideoOptions,
      addLabel,
      setUserLabel,
      changeHtkRegionStart,
      saveNewConfig,
      updateTaskData,
      updateTasksDataList,
      unshiftVideoOptions,
      addDefaultToVideoOptions,
      setShouldShowAudioWave,

      setSelectedLabels,
      pushToSelectedLabels,
      removeFromSelectedLabels,
      updateInSelectedLabelsByValue,

      pushToSelectedSegments,
      removeFromSelectedSegments,

      saveOffset,
      getCurrentAnnotationOffset,
      saveOffsetOnAnnotationSubmit,
      updateProjectLabels,

      setTaskMeta,

      // setChartRegions,
      setChartRegionDrawFlag,
      setChartRegionToDraw,
      resetChartRegionToDraw,
      setChartRegionEditFlag,
      setChartRegionToEdit,
      resetChartRegionToEdit,

      annotationRegionsStateChanged,

      videoRefChanged,

      setFlags,
      addInterface,
      hasInterface,
      toggleInterface,

      afterCreate,
      assignTask,
      assignConfig,
      reAssignConfig,
      reAssignConfigLbl,
      resetState,
      resetAnnotationStore,
      initializeStore,
      setHistory,
      attachHotkeys,

      skipTask,
      unskipTask,
      setTaskHistory,
      submitDraft,
      submitAnnotation,
      updateAnnotation,
      acceptAnnotation,
      rejectAnnotation,
      presignUrlForProject,
      setUsers,
      mergeUsers,

      showModal,
      toggleComments,
      toggleSettings,
      toggleDescription,

      setAutoAnnotation,
      setAutoAcceptSuggestions,
      loadSuggestions,

      addAnnotationToTaskHistory,
      nextTask,
      prevTask,
      postponeTask,
      incrementQueuePosition,
      beforeDestroy() {
        ToolsManager.removeAllTools();
        appControls = null;
      },

      setAppControls,
      clearApp,
      renderApp,
      selfDestroy() {
        const children = [];

        walk(self, (node) => {
          if (!isRoot(node) && getParent(node) === self) children.push(node);
        });

        let node;

        while ((node = children.shift())) {
          try {
            destroy(node);
          } catch (e) {
            console.log('Problem: ', e);
          }
        }
      },
    };
  });
