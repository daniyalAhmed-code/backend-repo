import { useCallback, useEffect, useMemo, useState } from 'react';

import { ErrorMessage } from '../../../components/ErrorMessage/ErrorMessage';
import ObjectTag from '../../../components/Tags/Object';
import { Block, Elem } from '../../../utils/bem';
import './chart.styl';
import MultiLineChart from './MultiLineChart';
import { Checkbox, InputNumber } from 'antd';
import { BASE_URL_VIDEO, TEMP_WORKOUT_ID, VIDEO_CUSTOM_ID_PREFIX, WORKOUT_SVC } from '../../../utils/constants';
import { Button } from '../../../common/Button/Button';
import { onSnapshot } from 'mobx-state-tree';
import { LsExpand, LsCollapse } from '../../../assets/icons';
import { Tooltip } from '../../../common/Tooltip/Tooltip';
import { getApiHost } from '../../../utils/helpers';

const URL = BASE_URL_VIDEO + 'get_workout_sensor_ids/'; // `https://80ssqhjxxk.execute-api.us-east-1.amazonaws.com/dev/get_workout_data/`;

// const WORKOUT_ID = TEMP_WORKOUT_ID;

const appliedOffset = (() => {
    let appliedOffset = 0;

    function setAppliedOffset(newVal) {
        appliedOffset = newVal;
    }

    function getAppliedOffset() { return appliedOffset; }

    return {
        setAppliedOffset,
        getAppliedOffset,
    };
})();

const timeLapsed = (() => {
    let timeLapsed = 0;
    let timeLapseVerCurrentStart = 0;
    let timeLapseVerLastTimeRendered = 0;
    let totalIterations = 1;
    let currentIteration = 1;
     const obj = {
        incrementInterval: function() {
            timeLapsed += (TIME_SLAB_SEC);
        },
        getTimeLapsed: function() {
            return timeLapsed;
        },
        setTimeLapsed: function(newTime) {
            timeLapsed = newTime;
        },
        resetTimeLapsed: function() {
            timeLapsed = 0;
            timeLapseVerCurrentStart = 0;
            timeLapseVerLastTimeRendered = 0;
            currentIteration = 1;
        },
        handleResumeIncrement: function() {
            //TODO handle the time to resume the chart update time,
            //when video is paused and then user plays the video.
        },
        setCurrentTime: function(newVal) { timeLapseVerCurrentStart = newVal; },
        getCurrentTime: function() { return timeLapseVerCurrentStart; },
        setLastRenderedTime: function(newVal) { timeLapseVerLastTimeRendered = newVal; },
        getLastRenderedTime: function() { return timeLapseVerLastTimeRendered; },
        setTotalIterations: function (iterations) { totalIterations = iterations; },
        getTotalIterations: function () { return totalIterations; },
        setCurrentIteration: function (iteration) { currentIteration = iteration; },
        getCurrentIteration: function () { return currentIteration; },
        incrementCurrentIteration: function () { currentIteration += 1; },
        isLastIteration: function () { return currentIteration === totalIterations; },
    }
    return obj;
})();

const currentTime = (() => {
    let currentTime = 0;
  
    function setCurrentTime(newVal) {
        currentTime = newVal;
    }
  
    function getCurrentTime() { return currentTime; }
  
    return {
        setCurrentTime,
        getCurrentTime,
    };
  })();

const ApiChartView = ({ item, store }) => {
    /**
     * Actual Chart Comp
     */

    const WORKOUT_ID = store?.workoutId?.length ? store.workoutId : TEMP_WORKOUT_ID;

    const durationFormatted = useMemo(() => {
        return Math.max((item.totalDuration - 1) / 24, 0);
    }, [item.totalDuration]);

    if (!item._value) return null;

    const shouldShowOffset = window.localStorage.getItem('showOffset')?.toLocaleLowerCase() === 'true';

    const [loading, setLoading] = useState(true);
    const [loadingVideoChange, setLoadingVideoChange] = useState(false);
    const [errMsg, setErrMsg] = useState('');
    // const [offset, setOffset] = useState(0);
    const [offset, setOffset] = useState(0);
    const [videoElemUp, setVideoElemUp] = useState(false);
    const [taskMetaUpdated, setTaskMetaUpdated] = useState('');
    const [offsetCollapsed, setOffsetCollapsed] = useState(shouldShowOffset);

    onSnapshot(store.videoRefChange, snap => {
        setVideoElemUp(true);
    });

    onSnapshot(store.metaUpdated, snap => {
        setTaskMetaUpdated(snap.updatedAt);
    });

    const lazyLoadFromCDN = (callback) => {
        const mathJax = document.createElement('script');
        mathJax.setAttribute('src', 'https://cdn.jsdelivr.net/npm/chart.js@4.4.2/dist/chart.umd.min.js');
        mathJax.addEventListener('load', () => callback());
        document.head.appendChild(mathJax);
    }

    const [apiData, setApiData] = useState({});
    const [chartsData, setChartsData] = useState({});
    const [toRenderGyro, setToRenderGyro] = useState([]);
    const [toRenderAcc, setToRenderAcc] = useState([]);
    const [offsetUpdated, setOffsetUpdated] = useState(Date.now())

     /**
     * Following state holds the url for current video. It needs to be updated whenever user switches between video options.
     * This will be passed as dependency to Effect responsible for video event listening.
     */
     const [currentUrl, setCurrentUrl] = useState(item._value);

     const getSensorDataById = async (sensorId) => {
        const base_host = getApiHost(store.stage);
        const res = await fetch(`${base_host}${WORKOUT_SVC}get_workout_sensor_data_by_id/${sensorId}`);
        return await res.json();
     };

    //  const fetchParquetDataFile = async(url) => {
    //     const fileStr = await fetch(url);
    //  };

    const fetchParquetDataFile = async (url, key) => {
        
        try {
            const response = await fetch(url);
    
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            let data = {};
    
            data[key] = await response.json();

            return data;
            
        } catch (error) {
            console.error('Error fetching Parquet data file:', error);
        }
    };

    const fetchDataFromApi = async () => {
        setLoading(true);
        setErrMsg('');
        try {
            const base_host = getApiHost(store.stage);
            const res = await fetch(`${base_host}${WORKOUT_SVC}get_workout_sensor_ids/${store.workoutId}`);
            const { ok, status } = res;
            if (ok && (status >= 200 && status <= 400)) {
                const response = await res.json();
                const { workout_detail_ids, presigned_urls } = response;

                if (presigned_urls && presigned_urls.length) {
                    const file_promises = presigned_urls.map(obj => fetchParquetDataFile(obj[Object.keys(obj)[0]], Object.keys(obj)[0]));
                    const file_data_array = await Promise.all(file_promises);
                    const tempData = {};
                    for (let i=0; i < file_data_array?.length; i++) {
                        const data = file_data_array[i];
                        const dataKeys = Object.keys(data);
                        dataKeys.map(k => {
                            tempData[k] = data[k];
                            // chartsData[k] = data.data[k];
                        });
                    }
                    // for(let i=0; i< presigned_urls.length; i++) {
                    //     const key = Object.keys(presigned_urls[i])[0];
                    //     const data = await fetchParquetDataFile(presigned_urls[i][key], key);
                    //     tempData[key] = data;
                    // }
                    setApiData({ ...tempData });
                    setChartsData({ ...tempData });
                    setLoading(false);
                    return;
                }
                
                /**
                 * --------------------------------------------------------------------
                 *         Parallel Calls to API but wait on client side to resolve
                 * --------------------------------------------------------------------
                 */
                // Create an array to hold all the promises
                const promises = workout_detail_ids.map(id => getSensorDataById(id));

                // Execute all promises concurrently
                const dataArray = await Promise.all(promises);
                const tempData = {};
                for (let i=0; i < dataArray?.length; i++) {
                    const data = dataArray[i];
                    const dataKeys = Object.keys(data.data);
                    dataKeys.map(k => {
                        tempData[k] = data.data[k];
                        // chartsData[k] = data.data[k];
                    });
                }
                /**
                 *                     Parallel Calls to API logic End
                 * ---------------------------------------------------------------------
                 */

                /**
                 * --------------------------------------------------------------------
                 *        Sequential Calls to API one after the other to resolve
                 * --------------------------------------------------------------------
                 */
                // const tempData = {};
                // for (let i=0; i < workout_detail_ids?.length; i++) {
                //     const data = await getSensorDataById(workout_detail_ids[i]);
                //     const dataKeys = Object.keys(data.data);
                //     dataKeys.map(k => {
                //         tempData[k] = data.data[k];
                //         // chartsData[k] = data.data[k];
                //     });
                // }
                /**
                 *                   Sequential Calls to API logic End
                 * ---------------------------------------------------------------------
                 */


                setApiData({ ...tempData });
                setChartsData({ ...tempData });
            } else {
                const responseJson = await res.json();
                setErrMsg(responseJson?.message ?? 'Cannot fetch data for charts');
            }
            setLoading(false);
        } catch (err) {
            err.message ? setErrMsg(err.message) : setErrMsg('Cannot fetch data for charts');
            setLoading(false);
        }
    };

    useEffect(() => {
        // fetchDataFromApi();
        lazyLoadFromCDN(() => console.info('Chart Library loaded!'));
    }, []);

    useEffect(() => {
        if(store.workoutId && store.workoutId !== 'undefined') fetchDataFromApi();
    }, [store.workoutId]);
    
    useEffect(() => {
        if (taskMetaUpdated) {
            const newOffset = store.annotationStore.getAnnotationOffset();
            setOffset(newOffset);
            // appliedOffset.setAppliedOffset(newOffset);
        }
    }, [taskMetaUpdated]);

    useEffect(() => {
        const videoElem = document.getElementById(`${VIDEO_CUSTOM_ID_PREFIX}-video-element`);
        if(videoElemUp) {
            if (Object.keys(apiData).length) {
                // appliedOffset.setAppliedOffset(newOffset);
                /**TODO Find a stable way to handle Chart regions rendering */
                //Hacky way to initialize the charts so that regions get painted at least once.
                setToRenderGyro(Object.keys(apiData));
                setToRenderAcc(Object.keys(apiData));
                setTimeout(async () => {
                    const newOffset = store.annotationStore.getAnnotationOffset();
                    setOffset(newOffset);
                    const btn = document.getElementById('btn-apply-offset');
                    btn?.click?.();
                    // await applyOffset(null, true, newOffset);
                    setToRenderAcc([]);
                    setToRenderGyro([]);
                }, 100);
            }
        }
    }, [videoElemUp, apiData]);

    const [currVideoTime, setCurrVideoTIme] = useState(timeLapsed.getTimeLapsed());
    const [nearestTick, setNearestTick] = useState(null);
    useEffect(() => {
        const videoElem = document.getElementById(`${VIDEO_CUSTOM_ID_PREFIX}-video-element`);
        if (videoElem) {
            videoElem?.addEventListener('timeupdate', function(event) {
                const currentTime = videoElem?.currentTime;
                    timeLapsed.setTimeLapsed(currentTime);
                    setCurrVideoTIme(currentTime);
            });
        }

        return () => {
            videoElem?.removeEventListener?.('timeupdate');
        }
    }, [videoElemUp]);

    useEffect(() => {
        setCurrVideoTIme(timeLapsed.getTimeLapsed());
    }, [timeLapsed.getTimeLapsed()]);

    useEffect(() => {
        const tempGyroSelection = [...toRenderGyro];
        const tempAccSelection = [...toRenderAcc];
        setLoadingVideoChange(true);
        setToRenderGyro([]);
        setToRenderAcc([]);
        setTimeout(() => {
            setToRenderGyro([...tempGyroSelection]);
            setToRenderAcc([...tempAccSelection]);
            setLoadingVideoChange(false);
        }, 1230);
    }, [currentUrl]);

    onSnapshot(store.annotationStore, (snapshot) => {
        setTimeout(() => {
            setCurrentUrl(snapshot.root?.children[1]._value);
        }, 0);
    })

    const sliceDataArray = (array) => {
        const idx = array.findIndex(itm => Number(itm.timestamp) >= offset);
        const index = array[idx]?.timestamp > offset ? idx : idx + 1;
        if (index >= 0 && index < array.length) return array.slice(index);
        else return array;
    };

    const appendDataArray = (array) => {
        const defaultObj = {
            timestamp: 0,
            gyro_x: 0,
            gyro_y: 0,
            gyro_z: 0,
            accel_x: 0,
            accel_y: 0,
            accel_z: 0
        }
        const startTimeStamp = Number(array[0].timestamp);
        if (startTimeStamp <= offset) return;
        const temp = [...array]
        const tickDiff = Math.abs(startTimeStamp - Number(array[1].timestamp));
        const step = tickDiff < Math.abs(offset) ? tickDiff : Math.abs(offset) - 1;
        let i= startTimeStamp - 1;
        while (i > offset) {
            temp.unshift({ ...defaultObj, timestamp: (i) });
                i -= step;
        }
        return temp;
    };


    const applyOffset = useCallback(async (e = null, forceApply = false, forceValue=null) => {
        if (
            (forceApply && forceValue && (apiData && Object.keys(apiData).length)) ||
            ((Object.keys(apiData).length) && offset !== appliedOffset.getAppliedOffset())
        ) {
            const offsetVal = forceApply ? forceValue : offset;
            await store.saveOffset(offsetVal);
            const copyObj = {};
            const objKeys = Object.keys(apiData);
            for (let i = 0; i < objKeys.length; i++) {
                if (offsetVal >= 0) {
                    copyObj[objKeys[i]] = [...sliceDataArray([...apiData[objKeys[i]]])];
                } else {
                    copyObj[objKeys[i]] = [...appendDataArray([...apiData[objKeys[i]]])];
                }
            }
            setChartsData(copyObj);
            appliedOffset.setAppliedOffset(offsetVal);
            setOffsetUpdated(Date.now());
        }
    }, [offset]);

    const renderMultiLineChartsGyro = useCallback(() => {
        return toRenderGyro.map((itm, idx) => (
            <MultiLineChart
                key={idx + '-' + itm}
                title={itm}
                data={chartsData[itm]}
                item={item}
                type='gyro'
                offset={offset}
                offsetUpdated={offsetUpdated}
                timeToMove={currentTime.getCurrentTime()}
                setNearestTick={(tick) => setNearestTick(tick)}
                currentNearestTick={nearestTick}
            />
        ))
    }, [toRenderGyro.length, chartsData, appliedOffset.getAppliedOffset(), currentTime.getCurrentTime(), nearestTick]);

    const renderMultiLineChartsAcc = useCallback(() => {
        return toRenderAcc.map((itm, idx) => (
            <MultiLineChart
                key={idx + '-' + itm}
                title={itm}
                data={chartsData[itm]}
                item={item}
                type='accel'
                offset={offset}
                offsetUpdated={offsetUpdated}
                timeToMove={currentTime.getCurrentTime()}
                setNearestTick={(tick) => setNearestTick(tick)}
                currentNearestTick={nearestTick}
            />
        ))
    }, [toRenderAcc.length, chartsData, appliedOffset.getAppliedOffset(), currentTime.getCurrentTime(), nearestTick]);

    const onCheckboxChangeGyro = (checkedValues) => {
        setToRenderGyro([...checkedValues]);
    };

    const onCheckboxChangeAcc = (checkedValues) => {
        setToRenderAcc([...checkedValues]);
    };

    const onChangeOffset = (value) => {
        setOffset(Number(value));
    };

    const toggleOffsetCollapse = () => {
        const flag = !offsetCollapsed;
        window.localStorage.setItem('showOffset', `${flag}`);
        setOffsetCollapsed(flag);
    };

    const [timeToMove, setTImeToMove] = useState(0);

    const applyTime =(e = null, forceApply = false, forceValue=null) => {
        if (
            timeToMove > -1 && timeToMove !== (currentTime.getCurrentTime() * 1000)
        ) {
            currentTime.setCurrentTime(timeToMove / 1000)
        }
    };

    const onChangeTime = (value) => {
        setTImeToMove(value);
        // applyTime();
    };

    return (
        <ObjectTag item={item}>
            {item.errors?.map((error, i) => (
                <ErrorMessage key={`err-${i}`} error={error} />
            ))}
            {(errMsg && errMsg.trim() !== "") &&
                <ErrorMessage key={`err-Api-data-fetch`} error={errMsg} />
            }
            {(loading || loadingVideoChange) && (
                <Elem name="loading">
                    <Block name="spinner" />
                </Elem>
            )}
            <div style={{ display: 'flex', justifyContent: 'start', alignItems: 'stretch', margin: '0.45rem auto', position: 'relative' }}>
                    {
                        !offsetCollapsed ? <Tooltip title='Hide Offset'><LsCollapse onClick={toggleOffsetCollapse} style={{ position: 'absolute', top: 0, left: '-15px'}}/></Tooltip> :
                        <Tooltip mouseEnterDelay={30} title='Show Offset'><LsExpand onClick={toggleOffsetCollapse} style={{ position: 'absolute', top: 0, left: '-15px'}}/></Tooltip>
                    }
                {
                   !offsetCollapsed && <>
                    <span style={{
                    display: 'flex',
                    justifyContent: 'start',
                    alignItems: 'stretch',
                    margin: 'auto 0.45rem'
                }}>
                    <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                        <p style={{ fontWeight: 'bold', margin: '0', padding: '0' }}>Offset (in milliseconds) :&nbsp;</p>
                    </span>
                    <InputNumber
                        min={0 - Math.round(durationFormatted * 1000)}
                        max={Math.round(durationFormatted * 1000)}
                        value={offset} onChange={onChangeOffset}
                        class="[&::-webkit-inner-spin-button]:appearance-none"
                        changeOnWheel={false}
                        disabled={item.playing || item.errors?.length || loading}
                    />
                </span>
                <Button
                    style={{ height: 'inherit' }}
                    onClick={applyOffset}
                    disabled={item.playing || item.errors?.length || loading}
                    id={'btn-apply-offset'}
                >Apply Offset</Button>
                    </>
                }
            </div>
            <div style={{ display: 'flex', justifyContent: 'start', alignItems: 'stretch', margin: '0.45rem auto', position: 'relative' }}>
                        <span style={{
                        display: 'flex',
                        justifyContent: 'start',
                        alignItems: 'stretch',
                        margin: 'auto 0.45rem'
                    }}>
                        {/* <InputNumber
                            min={0}
                            max={21572}
                            value={timeToMove} onChange={onChangeTime}
                            className="[&::-webkit-inner-spin-button]:appearance-none"
                            changeOnWheel={false}
                            disabled={item.playing || item.errors?.length || loading}
                        /> */}
                    </span>
                    {/* <Button
                        style={{ height: 'inherit' }}
                        onClick={applyTime}
                        disabled={item.playing || item.errors?.length || loading}
                        id={'btn-move-cursor'}
                    >Move Cursor</Button> */}
                </div>
                <div style={{ display: 'flex', justifyContent: 'start', alignItems: 'stretch', margin: '0.45rem auto', position: 'relative' }}>
                        <span style={{
                        display: 'flex',
                        justifyContent: 'start',
                        alignItems: 'stretch',
                        margin: 'auto 0.45rem'
                    }}>
                        <span style={{ display: 'flex', justifyContent: 'center', alignItems: 'center' }} >
                            <p style={{ margin: '0', padding: '0' }}>Nearest Tick/Label (timeStamp) :&nbsp;~&nbsp;</p>
                        </span>
                        <p style={{ display: 'flex', height: '100%', justifyContent: 'center', alignItems: 'center', margin: '0', padding: '0' }}>{nearestTick}</p>
                    </span>
                </div>
            {
                (!loading && !(errMsg && errMsg.trim() !== "")) &&
                <div style={{ width: '100%', display: 'flex', alignItems: 'stretch' }}>
                    <p style={{ margin: 'auto 0.5rem', fontWeight: 'bold', }}>Gyroscope</p>
                    <Checkbox.Group options={Object.keys(apiData)} value={toRenderGyro} onChange={onCheckboxChangeGyro} />
                </div>
            }
            <Block name="api-chart" style={!(toRenderGyro.length) ? { height: 0 } : {}}>
                {
                    (!loading && !(errMsg && errMsg.trim() !== "")) &&
                    <Block name="multiline-chart">
                        {
                            renderMultiLineChartsGyro()
                        }
                    </Block>
                }
            </Block>
            {
                (!loading && !(errMsg && errMsg.trim() !== "")) &&
                <div style={{ width: '100%', display: 'flex', alignItems: 'stretch' }}>
                    <p style={{ margin: 'auto 0.5rem', fontWeight: 'bold', }}>Accelerometer</p>
                    <Checkbox.Group options={Object.keys(apiData)} value={toRenderAcc} onChange={onCheckboxChangeAcc} />
                </div>
            }
            <Block name="api-chart" style={!(toRenderAcc.length) ? { height: 0 } : {}}>
                {
                    (!loading && !(errMsg && errMsg.trim() !== "")) &&
                    <Block name="multiline-chart">
                        {
                            renderMultiLineChartsAcc()
                        }
                    </Block>
                }
            </Block>
        </ObjectTag>
    );
};

export { ApiChartView };
