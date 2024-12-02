import React, { useEffect, useState } from 'react';
import { inject, observer } from 'mobx-react';
import { applyAction, cast, getSnapshot, onSnapshot, types } from 'mobx-state-tree';

import { defaultStyle } from '../../../core/Constants';
import { customTypes } from '../../../core/CustomTypes';
import { guidGenerator } from '../../../core/Helpers';
import Registry from '../../../core/Registry';
import Tree from '../../../core/Tree';
import Types from '../../../core/Types';
import { AnnotationMixin } from '../../../mixins/AnnotationMixin';
import DynamicChildrenMixin from '../../../mixins/DynamicChildrenMixin';
import LabelMixin from '../../../mixins/LabelMixin';
import SelectedModelMixin from '../../../mixins/SelectedModel';
import { Block } from '../../../utils/bem';
import ControlBase from '../Base';
import '../Label';
import './Labels.styl';
import { Button, Select, Switch } from 'antd';
import { InstructionsModal } from '../../../components/InstructionsModal/InstructionsModal';

/**
 * The `Labels` tag provides a set of labels for labeling regions in tasks for machine learning and data science projects. Use the `Labels` tag to create a set of labels that can be assigned to identified region and specify the values of labels to assign to regions.
 *
 * All types of Labels can have dynamic value to load labels from task. This task data should contain a list of options to create underlying `<Label>`s. All the parameters from options will be transferred to corresponding tags.
 *
 * The Labels tag can be used with audio and text data types. Other data types have type-specific Labels tags.
 * @example
 * <!--Basic labeling configuration to apply labels to a passage of text -->
 * <View>
 *   <Labels name="type" toName="txt-1">
 *     <Label alias="B" value="Brand" />
 *     <Label alias="P" value="Product" />
 *   </Labels>
 *   <Text name="txt-1" value="$text" />
 * </View>
 *
 * @example <caption>This part of config with dynamic labels</caption>
 * <Labels name="product" toName="shelf" value="$brands" />
 * <!-- {
 *   "data": {
 *     "brands": [
 *       { "value": "Big brand" },
 *       { "value": "Another brand", "background": "orange" },
 *       { "value": "Local brand" },
 *       { "value": "Green brand", "alias": "Eco", showalias: true }
 *     ]
 *   }
 * } -->
 * @example <caption>is equivalent to this config</caption>
 * <Labels name="product" toName="shelf">
 *   <Label value="Big brand" />
 *   <Label value="Another brand" background="orange" />
 *   <Label value="Local brand" />
 *   <Label value="Green brand" alias="Eco" showAlias="true" />
 * </Labels>
 * @name Labels
 * @meta_title Labels Tag for Labeling Regions
 * @meta_description Customize Label Studio by using the Labels tag to provide a set of labels for labeling regions in tasks for machine learning and data science projects.
 * @param {string} name                      - Name of the element
 * @param {string} toName                    - Name of the element that you want to label
 * @param {single|multiple=} [choice=single] - Configure whether you can select one or multiple labels for a region
 * @param {number} [maxUsages]               - Maximum number of times a label can be used per task
 * @param {boolean} [showInline=true]        - Whether to show labels in the same visual line
 * @param {float=} [opacity=0.6]             - Opacity of rectangle highlighting the label
 * @param {string=} [fillColor]              - Rectangle fill color in hexadecimal
 * @param {string=} [strokeColor=#f48a42]    - Stroke color in hexadecimal
 * @param {number=} [strokeWidth=1]          - Width of the stroke
 * @param {string} [value]                   - Task data field containing a list of dynamically loaded labels (see example below)
 */
const TagAttrs = types.model({
  toname: types.maybeNull(types.string),

  choice: types.optional(types.enumeration(['single', 'multiple']), 'single'),
  maxusages: types.maybeNull(types.string),
  showinline: types.optional(types.boolean, true),

  // TODO this will move away from here
  groupdepth: types.maybeNull(types.string),

  opacity: types.optional(customTypes.range(), '0.2'),
  fillcolor: types.optional(customTypes.color, '#f48a42'),

  strokewidth: types.optional(types.string, '1'),
  strokecolor: types.optional(customTypes.color, '#f48a42'),
  fillopacity: types.maybeNull(customTypes.range()),
  allowempty: types.optional(types.boolean, false),

  value: types.optional(types.string, ''),
});

/**
 * @param {boolean} showinline
 * @param {identifier} id
 * @param {string} pid
 */
const ModelAttrs = types.model({
  pid: types.optional(types.string, guidGenerator),
  type: 'labels',
  children: Types.unionArray(['label', 'header', 'view', 'text', 'hypertext', 'richtext']),

  visible: types.optional(types.boolean, true),
});

const Model = LabelMixin.views(self => ({
  get shouldBeUnselected() {
    return self.choice === 'single';
  },
  get defaultChildType() {
    return 'label';
  },
  get isLabeling() {
    return true;
  },
})).actions(self => ({
  afterCreate() {
    if (self.allowempty) {
      let empty = self.findLabel(null);

      if (!empty) {
        const emptyParams = {
          value: null,
          type: 'label',
          background: defaultStyle.fillcolor,
        };

        if (self.children) {
          self.children.unshift(emptyParams);
        } else {
          self.children = cast([emptyParams]);
        }
        empty = self.children[0];
      }
      empty.setEmpty();
    }
  },
}));

const LabelsModel = types.compose(
  'LabelsModel',
  ControlBase,
  ModelAttrs,
  TagAttrs,
  AnnotationMixin,
  DynamicChildrenMixin,
  Model,
  SelectedModelMixin.props({ _child: 'LabelModel' }),
);

const customStyles = {
  flexRow: {
    display: "flex",
    justifyContent:'space-between',
    alignItems:'flex-start'
  },
  labelBtnContainer:{ minWidth:'40px', margin:'1rem' },
  refreshBtnContainer:{ 
    width:'100%', 
    margin:'0.15rem auto', 
    display: "flex",
    justifyContent:'end', 
  },
  flexCol: {
    display: "flex",
    flexDirection: "column",
    justifyContent:'space-between',
    alignItems:'center',
    height: "100%",
    minHeight: "20rem"
  },
  formSelect: {
    padding: "1px",
    margin : "1rem auto",
  },
  modalActionContainer: {
    display: "flex",
    alignItems: "center",
    justifyContent : "end",
    width: "100%",
    margin: "1rem",
    padding: "2px",
    // marginTop: "6rem",
  },
  actionBtn: {
    margin: "auto 0.5rem",
  },
}

const dummyData = [
    { id: 1, value: 'air_squat.down' },
    { id: 2, value: 'air_squat.up' },
    { id: 3, value: 'push_press.down' },
    { id: 4, value: 'push_press.up' },
    { id: 5, value: 'power_clean.up' },
    { id: 6, value: 'power_clean.down' },
];

const getDefaultOptions = (config) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(config, 'application/xml');
  const viewNode = xmlDoc.childNodes[0];
  // Find the 'Labels' node
  let labelsNode = viewNode.nodeName == 'Labels' ? viewNode : '';  
  for (let i = 0; i < viewNode.childNodes.length; i++) {
    if (viewNode.childNodes[i].nodeName === 'Labels') {
      labelsNode = viewNode.childNodes[i];
      break;
    }
  }

  // Check if 'Labels' node is found
  if (labelsNode) {
    const labelValues = [];
    // Iterate over the children of 'Labels'
    for (let j = 0; j < labelsNode.childNodes.length; j++) {
      let childNode = labelsNode.childNodes[j];
      const val = childNode?.attributes?.getNamedItem('value');
      if(val && val?.value){
        labelValues.push(val?.value?.toString()?.toLowerCase())
      }
    }
    return labelValues;
  } else {
    console.error('Labels node not found in the XML structure.');
    return [];
  }
};

const getExercisesOptions = (array) => {
  const uniqueExercises = new Set();
  array.forEach(itm => uniqueExercises.add(itm?.value?.split?.('.')[0]));
  return [...Array.from(uniqueExercises)];
};

const getExerciseOptionsFromLabels = (data) => {
  const uniqueExercises = new Set();
  data.forEach(itm => uniqueExercises.add(itm?.split?.('.')[0]));
  return [...Array.from(uniqueExercises)];
};

const HtxLabels = inject(['store'])(observer(({ item, store}) => {
  const {
    config,
    labelsData,
    addLabel,
    reAssignConfigLbl,
    saveNewConfig,
    fetchLabelOptions,
    labelOptions,
    labelOptLoading,
    labelOptErrMsg,
  } = store;

  const [openLblSelection, setOpenLblSelection] = useState(store.showLabelsModal.flag);
  const [labelsSelection, setLabelsSelection] = useState([...(labelsData).map(i => (i.value.toLowerCase()))]);
  const [tempLabelsSelection, setTempLabelsSelection] = useState([...(labelsData).map(i => (i.value.toLowerCase()))]);
  const [labelLoading, setLabelLoading] = useState(false);
  const [isInitialLabelUpdated, setIsInitialLabelUpdated] = useState(false);

  const [selectExercises, setSelectExercises] = useState(false);
  const [exercisesOptions, setExercisesOptions] = useState([]);
  const [exerciseSelection, setExerciseSelection] = useState([...getExercisesOptions(labelsData)]);

  const [hasUpdatedProjectLabels, setHasUpdatedProjectLabels] = useState(Date.now());

  const [hasUserCleared, setHasUserCleared] = useState(false);

  const projectLevelLabels = getDefaultOptions(store.projectLabels);

  useEffect(() => {
    setExercisesOptions()
  }, [labelOptions.length]);

  onSnapshot(labelOptLoading, snap => {
    setLabelLoading(snap.flag);
  });

  onSnapshot(store.showLabelsModal, snap => {
    setOpenLblSelection(snap.flag);
  });

  const GetLabelsFromExerciseSelection = (data=undefined) => {
    const labelOptionsMap = new Map();
     labelOptions.forEach(option => {
         const key = option.value.toLowerCase().split('.')[0];
         if (!labelOptionsMap.has(key)) {
             labelOptionsMap.set(key, []);
         }
         labelOptionsMap.get(key).push({ id: option.id, value: option.value });
     });

     if (data) return data.flatMap(exercise => 
      labelOptionsMap.get(exercise) || []
  );
 
     // Create labels based on exerciseSelection
     return exerciseSelection.flatMap(exercise => 
         labelOptionsMap.get(exercise) || []
     );
  };

  const getUpdatedConfigLbl = (labels) => {
    // return `<Label key="${labels[labels.length -1].id}" value="${labels[labels.length -1].value}"/>`;
    if(labels.length < 1)return `<Labels name="tricks" toName="audio" choice="single">
      <Label value='' />
    </Labels>`;
    return `<Labels name="tricks" toName="audio" choice="single">
        ${ labels.map(label => ( `<Label key="${label.id}" value="${label.value}"/>` ))}
      </Labels>`;
  };

  const getUpdatedRootConfig = lblConfig => {
    return `
    <View>
      <Header value="Video timeline segmentation via Audio sync trick"/>
      <Video name="video" value="$video" sync="audio,chart"></Video>
      ${lblConfig}
      <Audio name="audio" value="$video" sync="video,chart" zoom="true" speed="true" volume="true"/>
      <Chart name="chart" value="$video" sync="video,chart"/>
    </View>
    `;
  };

  useEffect(() => {
    fetchLabelOptions();
    updateLabelsWithPreExistingVal();
  },[]);

  onSnapshot(store.userLabel, sna => {
    updateLabelsWithPreExistingVal(sna);
  });


  onSnapshot(store.shouldUpdateProjectLabels, sna => {
    setHasUpdatedProjectLabels(Date.now());
  })

  // useEffect(() => {
  //   console.log('*-*-*-*-*-*-*-*-*-hasUpdatedProjectLabels', hasUpdatedProjectLabels);
  //   console.log('*-*-*-*-*-*-*-*-*-labels', labelsSelection);
  //   console.log('*-*-*-*-*-*-*-*-*-tempLabels', tempLabelsSelection);
  //   const projectLabels = getDefaultOptions(store.projectLabels);
  //   const defaultRegionsLabels = getAutoLabelsForRegions();
  //     const existingLabels = [];//[...labelsSelection]
  //     const temp = [...projectLabels, ...existingLabels,...defaultRegionsLabels]
  //     const uniqueSet = new Set([...temp.filter(i => Boolean(i))]);
  //     const arrayForm = Array.from(uniqueSet);
  //     setLabelsSelection([...arrayForm]);
  //     setTempLabelsSelection([...arrayForm]);//*-*-*-*-*-*-*-*-*
  //     setExerciseSelection(getExerciseOptionsFromLabels(arrayForm));
  //     const new_labels = [...arrayForm.map((itm, idx) => ({ id: idx, value: itm}))]
  //     const newConfigLbl = getUpdatedConfigLbl([...new_labels]);
  //   console.log('*-*-*-*-*-*-*-*-*-projectLabels', projectLabels);
  //   console.log('*-*-*-*-*-*-*-*-*-existingLabels', existingLabels);
  //   console.log('*-*-*-*-*-*-*-*-*-temp', temp);
  //   console.log('*-*-*-*-*-*-*-*-*-newConfigLbl', newConfigLbl);
  //   console.log('*-*-*-*-*-*-*-*-*-new_labels', new_labels);
  //     reAssignConfigLbl(newConfigLbl);
  //     addLabel([...new_labels])
  //   handleApplySelection();
  // }, [hasUpdatedProjectLabels])

  const updateLabelsWithPreExistingVal = (existingSnap = null) => {
    const uniqueLabels = new Set();
    labelsSelection.length && labelsSelection.forEach(lblItem => lblItem && uniqueLabels.add(lblItem));
    labelsData.length && labelsData.forEach(lblItem => lblItem?.value && uniqueLabels.add(lblItem?.value));
    if (existingSnap && Object.keys(existingSnap)) {
      const user = store.users.find(usr => usr.id === store.user);
      if (!user) {
          existingSnap[0]?.labels?.forEach(element => uniqueLabels.add(element));
          setLabelsSelection([...uniqueLabels]);
          setTempLabelsSelection([...uniqueLabels]);//*-*-*-*-*-*-*-*-*
          setExerciseSelection(getExerciseOptionsFromLabels(uniqueLabels));
      } else {
        const userLabels = existingSnap.find(itm => itm.user === user.email);
        if (userLabels) {
          userLabels?.labels?.forEach(element => uniqueLabels.add(element));
        }
      }
    }
    const temp = Array.from(uniqueLabels)?.map((itm, idx) => ({id: idx, value: itm}));
    const defaultRegionsLabels = isInitialLabelUpdated ? [] : getAutoLabelsForRegions();
    const filteredDefaultRegionLabels = defaultRegionsLabels.filter(i => !uniqueLabels.has(i)).filter(l => tempLabelsSelection.includes(l) &&  labelsSelection.includes(l));
    const summed = temp.length ? [...temp, ...filteredDefaultRegionLabels.map(l => ({id: Date.now() + Math.floor(Math.random() * 10), value: l}))] : [...temp];
    addLabel([...summed]);
    if(summed.length !== labelsSelection.length && summed.some(elem => !labelsSelection.includes(elem.value)) && !isInitialLabelUpdated) {
      setLabelsSelection([...summed.map(i => i.value)]);
      setTempLabelsSelection([...summed.map(i => i.value)]);
      setIsInitialLabelUpdated(true);
    }
  };

  useEffect(() => {
    if(!openLblSelection)
      updateLabelsWithPreExistingVal();
  }, [labelsSelection]);

  useEffect(() => {
    // updateLabelsWithPreExistingVal();
  }, [exerciseSelection]);

  useEffect(() => {
    if(labelsData.length < 1 && !hasUserCleared){
      const defaultLabels = getDefaultOptions(store.projectLabels);
      const defaultRegionsLabels = getAutoLabelsForRegions();
      const existingLabels = getDefaultOptions(config);
      const temp = [...defaultLabels, ...existingLabels,...defaultRegionsLabels]
      const uniqueSet = new Set([...temp.filter(i => Boolean(i))]);
      const arrayForm = Array.from(uniqueSet);
      setLabelsSelection([...arrayForm]);
      setTempLabelsSelection([...arrayForm]);//*-*-*-*-*-*-*-*-*
      setExerciseSelection(getExerciseOptionsFromLabels(arrayForm));
    }else{
      const newConfigLbl = getUpdatedConfigLbl(labelsData);
      reAssignConfigLbl(newConfigLbl);
    }
  }, [labelsData.length]);

  const getLabelSelectOptions = (data, isExerciseOnly=false) => {
    const defaultLabels = getDefaultOptions(store.projectLabels);
    if (isExerciseOnly) {
      const uniqueExercise = getExercisesOptions(data);
      return uniqueExercise.map((item, idx) => ({ key: `${item}-${idx}`, value: item?.toLowerCase(), label: `${item}`, disabled: defaultLabels.some(i => i.split('.')[0] == item) }));
    }
    const opts = data.map((item, idx) => ({ key: `${item.id}-${idx}`, value: item.value?.toLowerCase(), label: `${item.value}`, disabled: defaultLabels.includes(item.value) }));
    return opts
  };
  const handleLabelSelectionChange = (value) => {
    setHasUserCleared(!value.length);
    setLabelsSelection([...value]);
  };

  const handleLabelExerciseSelectionChange = (value) => {
    setHasUserCleared(!value.length);
    setExerciseSelection([...value]);
    setLabelsSelection(GetLabelsFromExerciseSelection(value)?.map(d => d.value));
  };


  const getAutoLabelsForRegions = () => {
    const regions = store.annotationStore?.selected?.results;
    const uniqueSet = new Set();
    regions.map(r => uniqueSet.add(r.value?.labels[0] ?? ""));
   return [...Array.from(uniqueSet)];
    
  }

  const handleAddLabel = () =>{
    // addLabel();
    store.setShowLabelsModal(true);
  };
  const handleApplyExerciseSelection = async () => {
    // const labels = [];
    // for(let i=0; i< exerciseSelection.length; i++){
    //   const items = [];
    //   for(let j = 0; j < labelOptions.length; j++){
    //     const condition = labelOptions[j].value.toLowerCase().split('.')[0] === exerciseSelection[i];
    //     if(condition) items.push(labelOptions[j]);
    //   }
    //   labels.push(...items.map(itm => ({id:itm.id, value:itm.value})));
    // }

     // Preprocess labelOptions into a map for fast lookup
    //  const labelOptionsMap = new Map();
    //  labelOptions.forEach(option => {
    //      const key = option.value.toLowerCase().split('.')[0];
    //      if (!labelOptionsMap.has(key)) {
    //          labelOptionsMap.set(key, []);
    //      }
    //      labelOptionsMap.get(key).push({ id: option.id, value: option.value });
    //  });
 
    //  // Create labels based on exerciseSelection
    //  const labels = exerciseSelection.flatMap(exercise => 
    //      labelOptionsMap.get(exercise) || []
    //  );

    const labels = GetLabelsFromExerciseSelection();

    const defaultLabels = getDefaultOptions(store.projectLabels);
    const defaultLabelsFiltered = labels.filter(lbl=> !defaultLabels.includes(lbl));
    const defaultRegionsLabels = [];//getAutoLabelsForRegions();
    const filteredRegionsLabels = defaultRegionsLabels.filter(lbl => !defaultLabelsFiltered.includes(lbl));

     
    const newConfigLbl = getUpdatedConfigLbl(defaultLabelsFiltered);
    // const saved = await saveNewConfig(getUpdatedRootConfig(newConfigLbl));
    const temp = [...defaultLabels, ...labels.map(i => i.value), ...filteredRegionsLabels];
    const uniqueTemp = new Set(temp);
    const arrOfUniques = [...Array.from(uniqueTemp)];
    const labelsToUpdate = [...arrOfUniques.map((lbl, idx) => ({ id: Date.now() + idx, value: lbl }))];
    // if(saved)
      addLabel(labelsToUpdate);
    if(labels.length < 1){
      setLabelsSelection([]);
      setTempLabelsSelection([]);//*-*-*-*-*-*-*-*-*
      const newConfigLbl = getUpdatedConfigLbl(labelsToUpdate);
      reAssignConfigLbl(newConfigLbl);
    }
    setTempLabelsSelection([ ...arrOfUniques ]);//*-*-*-*-*-*-*-*-*
    setLabelsSelection([ ...arrOfUniques ]);//*-*-*-*-*-*-*-*-*
    setExerciseSelection(getExerciseOptionsFromLabels(arrOfUniques));
    store.setShowLabelsModal(false);
  };
  const handleApplySelection = async() => {
    const labels = [];
    const defaultLabels = getDefaultOptions(store.projectLabels);
    const defaultLabelsFiltered = labelsSelection.filter(lbl=> !defaultLabels.includes(lbl));
    const defaultRegionsLabels = [];//getAutoLabelsForRegions();
    const filteredRegionsLabels = defaultRegionsLabels.filter(lbl => !defaultLabelsFiltered.includes(lbl));
    for(let i=0; i< defaultLabelsFiltered.length; i++){
      const item = labelOptions.find(itm => itm.value.toLowerCase() === defaultLabelsFiltered[i] );
      if (item)
      labels.push({id:item.id, value:item.value});
    }

    const newConfigLbl = getUpdatedConfigLbl(labels);
    // const saved = await saveNewConfig(getUpdatedRootConfig(newConfigLbl));
    const temp = [...defaultLabels, ...labels.map(i => i.value), ...filteredRegionsLabels];
    const uniqueTemp = new Set(temp);
    const arrOfUniques = [...Array.from(uniqueTemp)];
    const labelsToUpdate = [...arrOfUniques.map((lbl, idx) => ({ id: Date.now() + idx, value: lbl }))];
    // if(saved || (saved?.length && saved.includes(true)))
      addLabel(labelsToUpdate);
    if(labels.length < 1){
    const newConfigLbl = getUpdatedConfigLbl(labelsToUpdate);
      reAssignConfigLbl(newConfigLbl);
    }
    setTimeout(updateLabelsWithPreExistingVal(), 80);
    setTempLabelsSelection([ ...arrOfUniques ]);//*-*-*-*-*-*-*-*-*
    setLabelsSelection([ ...arrOfUniques ]);//*-*-*-*-*-*-*-*-*
    store.setShowLabelsModal(false);
  };
  const handleDiscardSelection = () =>{
    const defaultLabels = getDefaultOptions(store.projectLabels);
    const defaultRegionsLabels = [];//getAutoLabelsForRegions();
    const temp = [ ...defaultLabels, ...tempLabelsSelection, ...defaultRegionsLabels];
    const uniqueLabels = new Set(temp);
    setLabelsSelection([ ...uniqueLabels ]);
    store.setShowLabelsModal(false);
    // setTimeout(updateLabelsWithPreExistingVal(), 80);
    // setTimeout(updateLabelsWithPreExistingVal(store.userLabel), 150);
    // setLabelsSelection([]);
    // setTimeout(updateLabelsWithPreExistingVal(), 100);
    // setTimeout(updateLabelsWithPreExistingVal(), 120);

  };
  return (
    <div style={{ ...customStyles.flexRow, display: labelsSelection.length ? 'flex' : 'none' }}>
      <Block name="labels" mod={{ hidden: !item.visible, inline: item.showinline }}>
        {Tree.renderChildren(item, item.annotation)}
      </Block>
      <InstructionsModal
        visible={openLblSelection}
        onCancel={handleDiscardSelection}//{() => store.setShowLabelsModal(false)}
        title="Labeling Selection"
      >
        <div style={customStyles.refreshBtnContainer}>
          <Button
            type="primary"
            ghost
            onClick={() => fetchLabelOptions()}
            disabled={labelLoading}
            loading={labelLoading ?? undefined}
          >
            {labelLoading ? 'Fetching Labels' : 'Refresh Options'}
          </Button>
        </div>
        <div style={customStyles.flexCol}>
          {labelOptErrMsg?.trim() != '' ? (
            <div>
              <h5>{labelOptErrMsg}</h5>
            </div>
          ) : (
            <div style={{ width: '100%', textAlign: 'left' }}>
              <div style={{ width: '100%', display: 'flex', justifyContent: 'center' }}><Switch checkedChildren={'Select Exercises'} unCheckedChildren={'Select Single Labels'} checked={selectExercises} onChange={() => setSelectExercises(!selectExercises)} /></div>
              {
                selectExercises ?
                <div>
                <label>Select exercises:</label>
                <p style={{ color: '#BFBFBF', fontSize: '12px', margin: 0, padding: 0 }}>You may select an exercise and all its variant labels shall be auto-selected</p>
                <Select
                  disabled={labelLoading}
                  mode="multiple"
                  size={'middle'}
                  placeholder="Please select exercises"
                  onChange={handleLabelExerciseSelectionChange}
                  style={{
                    ...customStyles.formSelect,
                    width: '100%',
                  }}
                  value={exerciseSelection}
                  options={getLabelSelectOptions(labelOptions, true)}
                  listHeight={4 * 32} //convert no of rows * 32px ; default row height
                />
              </div>
              :
              <div>
                <label>Select labels to apply:</label>
                <p style={{ color: '#BFBFBF', fontSize: '12px', margin: 0, padding: 0 }}>You may chooses individual labels (selective exercise variants)</p>
                <Select
                  disabled={labelLoading}
                  mode="multiple"
                  size={'middle'}
                  placeholder="Please select labels"
                  onChange={handleLabelSelectionChange}
                  style={{
                    ...customStyles.formSelect,
                    width: '100%',
                  }}
                  value={labelsSelection}
                  options={getLabelSelectOptions(labelOptions)}
                  listHeight={4 * 32} //convert no of rows * 32px ; default row height
                />
              </div>
              }
            </div>
          )}
          <div style={customStyles.modalActionContainer}>
            <Button danger style={customStyles.actionBtn} onClick={handleDiscardSelection}>
              Discard selection
            </Button>
            <Button
              type="primary"
              style={customStyles.actionBtn}
              disabled={labelLoading || labelOptErrMsg?.trim() != ''}
              onClick={selectExercises ? handleApplyExerciseSelection : handleApplySelection}
            >
              Apply selection
            </Button>
          </div>
        </div>
      </InstructionsModal>
    </div>
  );
}));

Registry.addTag('labels', LabelsModel, HtxLabels);

export { HtxLabels, LabelsModel };
