import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAPI } from '../../providers/ApiProvider';
import { useProject } from '../../providers/ProjectProvider';
import { isEmptyString } from '../../utils/helpers';
import { ConfigPage } from '../CreateProject/Config/Config';
// import { Button } from '../../components';
import { modal } from '../../components/Modal/Modal';
// import { Form, Input } from '../../components/Form';
// import { Button, Modal } from 'antd';
import { Tag, Form, Input, Switch, Select, Button } from 'antd';
import Modal from 'antd/lib/modal/Modal';
import { Palette } from '../../utils/colors';
import { getApiHost } from "./../../../../../libs/editor/src/utils/helpers"
import { LBL_STD_SVC } from "./../../../../../libs/editor/src/utils/constants"

const getDefaultOptions = (config) => {
  const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(config, 'application/xml');
  const viewNode = xmlDoc.childNodes[0];
  let labelsNode = viewNode;

  if (labelsNode) {
    const labelValues = [];
    for (let j = 0; j < labelsNode.childNodes.length; j++) {
      let childNode = labelsNode.childNodes[j];
      const val = childNode?.attributes?.getNamedItem('value');
      if (val && val?.value) {
        labelValues.push(val?.value?.toString()?.toLowerCase());
      }
    }
    return labelValues;
  } else {
    console.error('Labels node not found in the XML structure.');
    return [];
  }
};

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

export const ProjectLabelsSettings = () => {
  const { project, fetchProject } = useProject();
  const [config, setConfig] = useState('');
  const [essentialDataChanged, setEssentialDataChanged] = useState(false);
  const api = useAPI();

  const [labelInput, setLabelInput] = useState('');
  const [addedLabels, setAddedLabels] = useState([]);
  const [formErr, setFormErr] = useState(null);
  const [apiErr, setApiErr] = useState(null);

  const [labelOptions, setLabelOptions] = useState([]);
  const [labelOptErrMsg, setLabelOptErrMsg] = useState("");
  const [labelsSelection, setLabelsSelection] = useState([]);
  const [labelLoading, setLabelLoading] = useState(false);

  const [selectExercises, setSelectExercises] = useState(false);
  const [exercisesOptions, setExercisesOptions] = useState([]);
  const [exerciseSelection, setExerciseSelection] = useState([]);

  const [hasUserCleared, setHasUserCleared] = useState(false);

  const [loading, setLoading] = useState(false);

  const fetchLabelOptions = async() => {
    if(!project || isNaN(project.id)) return;
    setLabelLoading(true);
    try{
      const base_host = getApiHost('');
      const res = await fetch(`${base_host}${LBL_STD_SVC}`+`exercise/${project.id}`);
      const data = await res.json();
      const uniqueSet = new Set([...data.body]);
      setLabelOptions([...Array.from(uniqueSet)]);
    }
    catch(err){
      console.error('ERROR:', err);
      setLabelOptErrMsg(err?.message ?? `${err}`);
    }
    finally{
      setLabelLoading(false);
    }
  };

  useEffect(() => {
    if (project && project.id && !labelOptions.length) {
      fetchLabelOptions();
    }
  }, [project]);

  useEffect(() => {
    if(project && project.project_level_labels) {
      const labels = getDefaultOptions(project.project_level_labels);
      setAddedLabels(labels);
      // const uniqueSet = new Set([...labels]);
      setLabelsSelection([...labels]);
    }
  }, [project])

  const handleInsertLabel = (e) => {
    e.preventDefault();
    setFormErr(null);
    if (!labelInput) return;
    if (addedLabels.includes(labelInput.toLocaleLowerCase())) {
      setFormErr(`The value '${labelInput}' is already added as a label.`);
      return;
    }
    const temp = [...addedLabels, labelInput.toLowerCase()];
    setAddedLabels([...temp]);
    setLabelInput('');
  };

  const removeLabel = (idx) => () => {
    const item = addedLabels[idx];
    if (!item) return;
    const temp = [...addedLabels];
    temp.splice(idx, 1);
    setAddedLabels([...temp]);
  };

  const palette = Palette();

  const saveConfig = useCallback(
    async (config, rootConfig) => {
      setLoading(true);
      // const rootConfig = getUpdatedRootConfig(config);
      const res = await api.callApi('updateProjectRaw', {
        params: {
          pk: project.id,
        },
        body: {
          project_level_labels: config,
          label_config: rootConfig,
        },
      });

      if (res.ok) {
        await fetchProject();
        setLoading(false);
        return true;
      }

      const error = await res.json();

      await fetchProject();
      setLoading(false);
      return error;
    },
    [project, config]
  );

  const projectAlreadySetUp = useMemo(() => {
    if (project.label_config) {
      const hasConfig = !isEmptyString(project.label_config);
      const configIsEmpty =
        project.label_config.replace(/\s/g, '') === '<View></View>';
      const hasTasks = project.task_number > 0;

      // console.log({ hasConfig, configIsEmpty, hasTasks, project });
      return hasConfig && !configIsEmpty && hasTasks;
    }
    return false;
  }, [project]);

  const onSave = useCallback(async () => {
    return saveConfig();
  }, [essentialDataChanged, saveConfig]);

  const getUpdatedConfigLbl = (labels) => {
    // return `<Label key="${labels[labels.length -1].id}" value="${labels[labels.length -1].value}"/>`;
    if (labels.length < 1)
      return `<Labels name="tricks" toName="audio" choice="single">
    <Label value='' />
    </Labels>`;
    return `<Labels name="tricks" toName="audio" choice="single">
        ${labels.map((label) => `<Label key="${label?.id}" value="${label.value??label}"/>`)}
      </Labels>`;
  };

  const handleUpdate = useCallback(async () => {
    setApiErr(null);
    const configUp = getUpdatedConfigLbl(addedLabels);
    setAddedLabels([]);
    setConfig(configUp);
    const saved = await saveConfig(configUp);
    if (saved !== true) {
      setApiErr(saved?.message ?? `${saved}`);
    }
  });

  const onValidate = useCallback((validation) => {
    setEssentialDataChanged(validation.config_essential_data_has_changed);
  }, []);

  if (!project.id) return null;

  const CloseIcon = ({ onClick }) => (
    <span
      onClick={onClick}
      role="img"
      aria-label="close"
      tabindex="-1"
      class="anticon anticon-close ant-tag-close-icon"
      style={{
        cursor: 'pointer',
        marginInline: '5px',
        width: '30px',
        height: '30px',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
      }}
    >
      <svg
        fill-rule="evenodd"
        viewBox="64 64 896 896"
        focusable="false"
        data-icon="close"
        width="1em"
        height="1em"
        fill="currentColor"
        aria-hidden="true"
      >
        <path d="M799.86 166.31c.02 0 .04.02.08.06l57.69 57.7c.04.03.05.05.06.08a.12.12 0 010 .06c0 .03-.02.05-.06.09L569.93 512l287.7 287.7c.04.04.05.06.06.09a.12.12 0 010 .07c0 .02-.02.04-.06.08l-57.7 57.69c-.03.04-.05.05-.07.06a.12.12 0 01-.07 0c-.03 0-.05-.02-.09-.06L512 569.93l-287.7 287.7c-.04.04-.06.05-.09.06a.12.12 0 01-.07 0c-.02 0-.04-.02-.08-.06l-57.69-57.7c-.04-.03-.05-.05-.06-.07a.12.12 0 010-.07c0-.03.02-.05.06-.09L454.07 512l-287.7-287.7c-.04-.04-.05-.06-.06-.09a.12.12 0 010-.07c0-.02.02-.04.06-.08l57.7-57.69c.03-.04.05-.05.07-.06a.12.12 0 01.07 0c.03 0 .05.02.09.06L512 454.07l287.7-287.7c.04-.04.06-.05.09-.06a.12.12 0 01.07 0z"></path>
      </svg>
    </span>
  );

  function hexToRgba(hex, opacity = 0.6475) {
    // Remove the '#' if it's there
    hex = hex.replace('#', '');

    // Ensure the hex color is 6 characters long (not 3 characters like #FFF)
    if (hex.length === 3) {
      hex = hex
        .split('')
        .map(function (char) {
          return char + char;
        })
        .join('');
    }

    // Extract the red, green, and blue components from the hex string
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Return the rgba value with the specified opacity
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
  }




  const getLabelSelectOptions = (data, isExerciseOnly=false) => {
    if (isExerciseOnly) {
      const uniqueExercise = getExercisesOptions(data);
      return uniqueExercise.map((item, idx) => ({ key: `${item}-${idx}`, value: item?.toLowerCase(), label: `${item}` }));
    }
    return data.map((item, idx) => ({ key: `${item.id}-${idx}`, value: item.value?.toLowerCase(), label: `${item.value}` }));
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

  const handleDiscardSelection = () =>{
    // store.setShowLabelsModal(false);
    // updateLabelsWithPreExistingVal(store.userLabel)
    // setLabelsSelection([]);
  };

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

    const newConfigLbl = getUpdatedConfigLbl(labels);
    setConfig(newConfigLbl);
    const saved = await saveConfig(newConfigLbl);
    if(saved !== true){
      setApiErr(saved?.message ?? `${saved}`);
    }
  };
  const handleApplySelection = async() => {
    const labels = [];
    for(let i=0; i< labelsSelection.length; i++){
      const item = labelOptions.find(itm => itm.value.toLowerCase() === labelsSelection[i] );
      if (item)
      labels.push({id:item.id, value:item.value});
    }

    const newConfigLbl = getUpdatedConfigLbl(labels);
    setConfig(newConfigLbl);
    const rootConfig = getUpdatedRootConfig(newConfigLbl);
    const saved = await saveConfig(newConfigLbl, rootConfig);
    if(saved !== true){
      setApiErr(saved?.message ?? `${saved}`);
    }
  };

  return (
    <div>
      <h1>Project level Labels</h1>
      <div>
        <div style={{ display: 'flex', alignItems: 'stretch', gap: '10px' }}>
          <div
            style={{
              width: '49%',
              borderRadius: '8px',
              border: '1px solid #DFDFDF',
              padding: '15px',
            }}
          >
            <h3 style={{ padding: 0, margin: 0 }}>Current Selected Labels</h3>
            <div
              style={{
                display: 'flex',
                alignItems: 'baseline',
                flexWrap: 'wrap',
                gap: '10px',
                height: 'fit-content',
                maxHeight: '75vh',
                overflowY: 'auto',
                margin: '8px auto',
              }}
            >
              {addedLabels.map((lbl, idx) => (
                <span
                  key={lbl + '_' + idx}
                  style={{
                    backgroundColor: hexToRgba(palette.next().value),
                    fontWeight: 'bold',
                    padding: '2px 4px',
                    // paddingLeft: '15px',
                    display: 'flex',
                    alignItems: 'center',
                    borderRadius: '3px',
                  }}
                >
                  {lbl} 
                  {/* <CloseIcon onClick={removeLabel(idx)} /> */}
                </span>
              ))}
            </div>
          </div>
          {/* <Form
            style={{
              width: '49%',
              display: 'flex',
              flexDirection: 'column',
              rowGap: '5px',
              justifyContent: 'flex-start',
              borderRadius: '8px',
              border: '1px solid #DFDFDF',
              padding: '15px',
            }}
          >
            <Input
              type="text"
              value={labelInput}
              name="Label Input"
              placeholder="Insert Project level Label"
              onChange={(e) => setLabelInput(e.target.value)}
            />
            {formErr && (
              <span
                style={{ fontSize: '10px', color: 'red', display: 'block' }}
              >
                {formErr}
              </span>
            )}
            <Button
              look="primary"
              onClick={handleInsertLabel}
              style={{
                marginTop: '10px',
                marginBottom: '10px',
                alignSelf: 'flex-end',
              }}
              disabled={loading}
            >
              Add
            </Button>
          </Form> */}
          <div
          style={{
            width: '49%',
            display: 'flex',
            flexDirection: 'column',
            rowGap: '5px',
            justifyContent: 'flex-start',
            borderRadius: '8px',
            border: '1px solid #DFDFDF',
            padding: '15px',
          }}
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
                  <div
                    style={{
                      width: '100%',
                      display: 'flex',
                      justifyContent: 'center',
                    }}
                  >
                    <Switch
                      checkedChildren={'Select Exercises'}
                      unCheckedChildren={'Select Single Labels'}
                      checked={selectExercises}
                      onChange={() => setSelectExercises(!selectExercises)}
                    />
                  </div>
                  {selectExercises ? (
                    <div>
                      <label>Select exercises:</label>
                      <p
                        style={{
                          color: '#BFBFBF',
                          fontSize: '12px',
                          margin: 0,
                          padding: 0,
                        }}
                      >
                        You may select an exercise and all its variant labels
                        shall be auto-selected
                      </p>
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
                  ) : (
                    <div>
                      <label>Select labels to apply:</label>
                      <p
                        style={{
                          color: '#BFBFBF',
                          fontSize: '12px',
                          margin: 0,
                          padding: 0,
                        }}
                      >
                        You may chooses individual labels (selective exercise
                        variants)
                      </p>
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
                  )}
                </div>
              )}
              <div style={customStyles.modalActionContainer}>
                {/* <Button
                  danger
                  style={customStyles.actionBtn}
                  onClick={handleDiscardSelection}
                >
                  Discard selection
                </Button> */}
                <Button
                  type="primary"
                  style={customStyles.actionBtn}
                  disabled={labelLoading || labelOptErrMsg?.trim() != ''}
                  onClick={
                    selectExercises
                      ? handleApplyExerciseSelection
                      : handleApplySelection
                  }
                >
                  Apply selection
                </Button>
              </div>
            </div>
          </div>
        </div>
        {/* <Button
          style={{ marginTop: '15px' }}
          onClick={handleUpdate}
          disabled={loading}
        >
          Update Labels
        </Button> */}
        {apiErr && (
          <span
            style={{
              fontSize: '10px',
              color: 'red',
              display: 'block',
              margin: '10px',
            }}
          >
            {apiErr}
          </span>
        )}
      </div>
    </div>
  );
};

ProjectLabelsSettings.title = 'Project Labels Settings';
ProjectLabelsSettings.path = '/ProjectLabels';
