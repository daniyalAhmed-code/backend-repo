import { inject } from "mobx-react";
import { observer } from "mobx-react-lite";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FaArrowDown, FaArrowUp, FaCaretDown, FaChevronLeft, FaColumns } from "react-icons/fa";
import { Block, Elem } from "../../utils/bem";
import { FF_DEV_1170, isFF } from "../../utils/feature-flags";
import { Button } from "../Common/Button/Button";
import { FieldsButton } from "../Common/FieldsButton";
import { Icon } from "../Common/Icon/Icon";
import { Resizer } from "../Common/Resizer/Resizer";
import { Space } from "../Common/Space/Space";
import { DataView } from "../MainView";
import "./Label.styl";
import { Tooltip } from "../Common/Tooltip/Tooltip";
import { IconArrowLeft, IconArrowRight } from "../../assets/icons";
import AthleteWODInfo from "../../../../editor/src/components/AthleteWODInfo/AthleteWODInfo";
import { onSnapshot } from "mobx-state-tree";
import { Spinner } from "../Common/Spinner";
import { getApiHost } from "../../../../editor/src/utils/helpers";
import { LBL_STD_SVC, WORKOUT_SVC } from "../../../../editor/src/utils/constants";

const LabelingHeader = ({ SDK, onClick, isExplorerMode }) => {
  return (
    <Elem name="header" mod={{ labelStream: !isExplorerMode }}>
      <Space size="large">
        {SDK.interfaceEnabled("backButton") && (
          <Button
            icon={<FaChevronLeft style={{ marginRight: 4, fontSize: 16 }} />}
            type="link"
            onClick={onClick}
            style={{ fontSize: 18, padding: 0, color: "black" }}
          >
            Back
          </Button>
        )}

        {isExplorerMode ? (
          <FieldsButton
            wrapper={FieldsButton.Checkbox}
            icon={<Icon icon={FaColumns} />}
            trailingIcon={<Icon icon={FaCaretDown} />}
            title={"Fields"}
          />
        ) : null}
      </Space>
    </Elem>
  );
};

const injector = inject(({ store }) => {
  return {
    store,
    loading: store?.loadingData,
  };
});

/**
 * @param {{store: import("../../stores/AppStore").AppStore}} param1
 */
export const Labeling = injector(observer(({
  store,
  loading,
}) => {
  const shouldShowTaskTable = true; //window.localStorage.getItem('showTaskTable')?.toLocaleLowerCase() === 'true';

  const lsfRef = useRef();
  const SDK = store?.SDK;
  const view = store?.currentView;
  const { isExplorerMode } = store;

  const [collapseTable, setCollapseTable] = useState(shouldShowTaskTable);

  const toggleCollapseTaskTable = () => {
    const flag = !collapseTable;
    window.localStorage.setItem('showTaskTable', `${flag}`);
    setCollapseTable(flag);
  };

  const isLabelStream = useMemo(() => {
    return SDK.mode === 'labelstream';
  }, []);

  const closeLabeling = useCallback(() => {
    store.closeLabeling();
  }, [store]);

  const initLabeling = useCallback(() => {
    if (!SDK.lsf) SDK.initLSF(lsfRef.current);
    SDK.startLabeling();
  }, []);

  useEffect(() => {
    if (!isLabelStream) SDK.on("taskSelected", initLabeling);

    return () => {
      if (!isLabelStream) SDK.off("taskSelected", initLabeling);
    };
  }, []);

  useEffect(() => {
    if (!SDK.lsf && store.dataStore.selected || isLabelStream) {
      initLabeling();
    }
  }, []);

  useEffect(() => {
    return () => SDK.destroyLSF();
  }, []);

  const onResize = useCallback((width) => {
    view.setLabelingTableWidth(width);
    // trigger resize events inside LSF
    window.dispatchEvent(new Event("resize"));
  }, []);

  const [wodData, setWODData] = useState(null);
  const [wodDataLoading, setWODDataLoading] = useState(true);
  const [shouldFetchData, setShouldFetchData] = useState(false);
  const [prevWID, setPrevWID] = useState('');
  const [prevEnvironment, setPrevEnvironment] = useState('');

  useEffect(() => {
    if(shouldFetchData && prevWID) {
      fetchWODDetails(prevWID, prevEnvironment);
      setShouldFetchData(false)
    }
  }, [prevWID])

  const fetchWODDetails = async (w_id, environment = '') => {
    try {
      if(wodData && Object.keys(wodData).length) return;
      const base_host = getApiHost(environment);
      // console.log('+-+-+-+-Calling WOD', Date.now());
      const res = await fetch(`${base_host}${WORKOUT_SVC}` + 'get_athelete_details/' + w_id);
      const data = await res.json();
      setWODData(data);
    }
    catch(err) {
      console.error('Unable to fetch WOD details', err);
    }
    finally {
      setWODDataLoading(false);
    }
  };

  useEffect(() => {
    // console.log('+-+-+-+-+-+-+-+-store.taskStore.selected', store.taskStore.selected)
    if(store?.taskStore?.selected) {
      const taskMeta = JSON.parse(store?.taskStore?.selected?.source)?.meta;
    const { workout_id, environment } = taskMeta;
    if (workout_id && (prevWID !== workout_id && prevEnvironment !== environment)) {
      setPrevWID(workout_id);
      setPrevEnvironment(environment);
      setShouldFetchData(true);
      // fetchWODDetails(workout_id, environment);
    }
    // setShouldFetchData(false);
    }
  },[store.taskStore.selected])

  // onSnapshot(store.taskStore.selected, (snap) => {
  //   const taskMeta = JSON.parse(snap.source)?.meta;
  //   const { workout_id, environment } = taskMeta;
  //   if (workout_id && (prevWID !== workout_id && prevEnvironment !== environment)) {
  //     setPrevWID(workout_id);
  //     setPrevEnvironment(environment);
  //     setShouldFetchData(true);
  //     // fetchWODDetails(workout_id, environment);
  //   }
  //   // setShouldFetchData(false);
  // });

  const outlinerEnabled = isFF(FF_DEV_1170);

  return (
    <Block name="label-view" mod={{ loading }}>
      {SDK.interfaceEnabled('labelingHeader') && (
        <LabelingHeader
          SDK={SDK}
          onClick={closeLabeling}
          isExplorerMode={isExplorerMode}
        />
      )}

      <Elem name="content" style={{ position: 'relative' }}>
        {/* <div
          style={{
            position: 'absolute',
            top: -3,
            left: 2,
            width: 20,
            height: 20,
            border: `1px solid black`,
            borderRadius: '50%',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            cursor: 'pointer',
            backgroundColor: 'white',
            zIndex: 9999
          }}
        >
          <Tooltip title={collapseTable ? 'Show Task Table' : 'Hide Task Table'}>
            {
              collapseTable ?
              <IconArrowRight onClick={toggleCollapseTaskTable}/> :
              <IconArrowLeft onClick={toggleCollapseTaskTable}/>
            }
          </Tooltip>
        </div> */}
        <div style={{ height: '100%', backgroundColor: 'white', overflowY: 'auto' }}>
          {isExplorerMode && !collapseTable && (
            <Elem name="table" style={{ height: '60%', maxHeight: 600 }}>
              <Elem
                tag={Resizer}
                name="dataview"
                minWidth={200}
                showResizerLine={false}
                type={'quickview'}
                maxWidth={window.innerWidth * 0.35}
                initialWidth={view.labelingTableWidth} // hardcoded as in main-menu-trigger
                onResizeFinished={onResize}
                style={{ display: 'flex', flex: 1, width: '100%' }}
              >
                <DataView />
              </Elem>
            </Elem>
          )}
          <div style={{ margin: '1rem auto', position: 'relative', minWidth: '280px' }}>
            <div
              style={{
                position: 'absolute',
                top: -8,
                left: 3,
                width: 20,
                height: 20,
                border: `1px solid black`,
                borderRadius: '50%',
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                cursor: 'pointer',
                backgroundColor: 'white',
                zIndex: 9999,
              }}
            >
              <Tooltip
                title={collapseTable ? 'Show Task Table' : 'Hide Task Table'}
              >
                {collapseTable ? (
                  <FaArrowDown onClick={toggleCollapseTaskTable} />
                ) : (
                  <FaArrowUp onClick={toggleCollapseTaskTable} />
                )}
              </Tooltip>
            </div>
            {wodDataLoading ? (
              <>
                <Block name="fill-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'stretch' }}>
                  <Spinner size="large" />
                  <span style={{ paddingInline: '10px'}}>Loading WOD...</span>
                </Block>
              </>
            ) : (
              <AthleteWODInfo
                athleteName={wodData ? wodData.username : 'John Doe'}
                athleteImg={wodData ? wodData.url : ''}
                wod={
                  wodData
                    ? wodData.WOD
                    : '5 rounds for time\n 3 bar muscle up\n10 deadlifts (135/95 lbs)'
                }
              />
            )}
          </div>
        </div>

        <Elem
          name="lsf-wrapper"
          mod={{ mode: isExplorerMode ? 'explorer' : 'labeling' }}
        >
          {loading && <Elem name="waiting" mod={{ animated: true }} />}
          <Elem
            ref={lsfRef}
            id="label-studio-dm"
            name="lsf-container"
            key="label-studio"
            mod={{ outliner: outlinerEnabled }}
          />
        </Elem>
      </Elem>
    </Block>
  );
}));
