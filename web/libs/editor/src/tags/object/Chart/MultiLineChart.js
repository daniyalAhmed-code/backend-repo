import { useCallback, useEffect, useMemo, useState } from 'react';

import { ErrorMessage } from '../../../components/ErrorMessage/ErrorMessage';
import { Block } from '../../../utils/bem';
import './chart.styl';
import CanvasChart from './CanvasChart';
import { inject, observer } from 'mobx-react';
import { VIDEO_CUSTOM_ID_PREFIX, CHART_TIME_SLAB } from '../../../utils/constants';
import { onSnapshot } from 'mobx-state-tree';

const frameRate = 1000;

const TIME_SLAB_SEC = CHART_TIME_SLAB / 1000;


const MultiLineChart = inject('store')(observer(({ store, data, title, item, type, offset, offsetUpdated, timeToMove, setNearestTick, currentNearestTick }) => {
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
    /**
     * Actual Chart Comp
     */
    const defaultObj = type === 'gyro' ? {
        timestamp: 0,
        gyro_x: 0,
        gyro_y: 0,
        gyro_z: 0
    } : {
        timestamp: 0,
        accel_x: 0,
        accel_y: 0,
        accel_z: 0
    }
    const durationFormatted = useMemo(() => {
        return Math.max((item.totalDuration - 1) / 24, 0);
    }, [item.totalDuration, frameRate]);

    if (!item._value) return null;

    const [currentStart, setCurrentStart] = useState(0);
    const [currentTimePosition, setCurrentTimePosition] = useState(item.playedTime);
    const [lastTimeRendered, setLastTimeRendered] = useState(0);

    const [chartData, _setChartData] = useState([]);

    const setChartData = useCallback((newData, forceReCalculate = false) => {
        if (forceReCalculate) {
            _setChartData([...newData]);
            return;
        }
        if (newData.length !== chartData.length) _setChartData([...newData]);
    },[chartData]);

    const getTimeLapsedCalculated = () => {
        const currentIteration  = timeLapsed.getCurrentIteration();
        if (currentIteration <= 1) return 0;
        return ((currentIteration - 1) * TIME_SLAB_SEC) + 1;
    };

    const getStart = () => {
        const currentIteration  = timeLapsed.getCurrentIteration();
        if (currentIteration <= 1) {
            return 0;
        }
        return ((currentIteration - 1) * TIME_SLAB_SEC) + 1;
    };

    const _updateChartData = (timeLapsedParam, isSeeked = false, forceReCalculate = false) => {
        isSeeked ? setCurrentTimePosition(timeLapsedParam) : setCurrentTimePosition(0);
        const time = getTimeLapsedCalculated();
        const start = getStart();
        const startDiff = Math.abs(start - Number(data[0].timestamp));
        const end = Math.round(time + (TIME_SLAB_SEC)) > durationFormatted ? 
        Math.round(durationFormatted)
        :
        Math.round(time + (TIME_SLAB_SEC));
        const startIdx = data.findIndex(itm => Number(itm.timestamp) >= (((start - 1)  * 1000) + (offset + startDiff)));
        const lessEntries = Number(data[data.length -1].timestamp) < (end * 1000) && startIdx >= 0;
        const endIdx = lessEntries ? data.length -1 : data.findIndex(itm => Number(itm.timestamp) >= (end * 1000));
        const temp = endIdx > 0 ? data.slice(startIdx, endIdx) : [
            {
                ...defaultObj,
                timestamp: Math.round(time * 1000),
            },
            {
                ...defaultObj,
                timestamp: Math.round(end * 1000),
            }
        ];
        if (startIdx <= 0 && (temp[0].timestamp > offset) && offset !== 0) {
            const startTimeStamp = Number(temp[0].timestamp);
            const tickDiff = Math.abs(startTimeStamp - Number(temp[1].timestamp));
            const step = tickDiff < Math.abs(offset) ? tickDiff : Math.abs(offset) - 1;
            let i= startTimeStamp - 1;
            while (i > offset) {
                temp.unshift({ ...defaultObj, timestamp: (i) });
                    i -= step;
            }
        }
        if (timeLapsed.isLastIteration() && (temp[temp.length -1]?.timestamp < (end * 1000))) {
            const step = Number(data[endIdx].timestamp) - Number(data[endIdx - 1].timestamp);
            const diffTime = (timeLapsed.getCurrentIteration() * CHART_TIME_SLAB);
            const startMs = Number(temp[temp.length -1]?.timestamp) + step || (start * 1000) + offset + step;
            let i=startMs;
            while ( i <= diffTime) {
                temp.push({ ...defaultObj, timestamp: (i) });
                i += step;
            }
        }
        // console.groupCollapsed('*-*-*-RenderingDataLogs');
        // console.log('*-*-*-start-*-*-*',start);
        // console.log('*-*-*-((start - 1)  * 1000) + offset)-*-*-*',(((start)  * 1000) + offset));
        // console.log('*-*-*-startDiff-*-*-*',startDiff);
        // console.log('*-*-*-offset-*-*-*',offset);
        // console.log('*-*-*-startIdx-*-*-*',startIdx);
        // console.log('*-*-*-time-*-*-*',time);
        // console.log('*-*-*-StartIndexObj-*-*-*',data[startIdx]);
        // console.log('*-*-*-data-*-*-*',data);
        // console.groupEnd();
        const shouldUpdateAnyway = forceReCalculate || (start !== timeLapsed.getLastRenderedTime());
        setChartData([...temp], (forceReCalculate || shouldUpdateAnyway));
        setCurrentStart(end);
        setLastTimeRendered(time);
        timeLapsed.setCurrentTime(end);
        timeLapsed.setLastRenderedTime(time);
    };

    const updateChartData = (timeLapsedParam, isSeeked = false, forceReCalculate = false) => {
        const iteration = timeLapsedParam < TIME_SLAB_SEC ? 1 : Math.round(Math.ceil(timeLapsedParam / (TIME_SLAB_SEC)));
        const condition = !forceReCalculate && iteration === timeLapsed.getCurrentIteration();
        if (!forceReCalculate && iteration === timeLapsed.getCurrentIteration()) return;
        timeLapsed.setCurrentIteration(iteration);
        _updateChartData(timeLapsedParam, isSeeked, forceReCalculate);
    };

    const updateChartDataOnPlay = (timeLapsedParam, seeked = false) => {
        timeLapsed.setTimeLapsed(timeLapsedParam);
        updateChartData(timeLapsedParam, seeked);
    };

    useEffect(() => {
        const videoElement = document.getElementById(`${VIDEO_CUSTOM_ID_PREFIX}-video-element`);
        videoElement?.addEventListener('timeupdate', function(event) {
            const currentTime = videoElement?.currentTime;
            if (currentTime == 0) {
                timeLapsed.setTimeLapsed(currentTime);
                _updateChartData(currentTime, true);
                return;
            }
            updateChartDataOnPlay(currentTime, videoElement?.paused);
        });

        videoElement?.addEventListener('ended', function(event) {
            timeLapsed.resetTimeLapsed();
        });

        return () => {
            videoElement?.removeEventListener?.('timeupdate');
            videoElement?.removeEventListener?.('ended');
        };
    }, [offset]);

    // useEffect(() => {
    //     const videoElement = document.getElementById(`${VIDEO_CUSTOM_ID_PREFIX}-video-element`);
    //     if (videoElement) {
    //         const currentTime = videoElement?.currentTime;
    //         _updateChartData(currentTime, true);
    //     }
    // }, [offsetUpdated]);

    useEffect(() => {
        if (Math.round(item.playedTime) == 0) _updateChartData(item.playedTime, true);
        else {
            const iteration = item.playedTime < TIME_SLAB_SEC ? 1 : Math.round(Math.ceil(item.playedTime / (TIME_SLAB_SEC)));
            const condition = iteration === timeLapsed.getCurrentIteration();
            if (!condition) timeLapsed.setCurrentIteration(iteration);
            updateChartData(item.playedTime, true);
        }
    }, [item.playedTime]);

    useEffect(() => {
            const iteration = timeToMove < TIME_SLAB_SEC ? 1 : Math.round(Math.ceil(timeToMove / (TIME_SLAB_SEC)));
            const condition = iteration === timeLapsed.getCurrentIteration();
            if (!condition) timeLapsed.setCurrentIteration(iteration);
            updateChartData(timeToMove, true);
    }, [timeToMove]);

    useEffect(() => {
        const totalIterations = Math.round(Math.ceil(durationFormatted / (TIME_SLAB_SEC)));
        timeLapsed.setTotalIterations(totalIterations);
        const videoElement = document.getElementById(`${VIDEO_CUSTOM_ID_PREFIX}-video-element`);
        const currentTime = videoElement?.currentTime ?? timeLapsed.getLastRenderedTime();
        updateChartData(currentTime, true, true);

        return () => {
            timeLapsed.resetTimeLapsed();
        };
    }, [data])

    return (
            <Block name="chart" id={`chart-block-${title}-${type}`}>
                {item.errors?.map((error, i) => (
                    <ErrorMessage key={`err-${i}`} error={error} />
                ))}
                <Block name="multiline-chart">
                    <CanvasChart
                        chartData={chartData}
                        totalSeconds={durationFormatted}
                        end={currentStart > 0 ? currentStart : (TIME_SLAB_SEC)}
                        currentTime={timeLapsed.getTimeLapsed()}
                        title={title}
                        type={type}
                        playing={item.playing}
                        item={item}
                        store={store}
                        currentSlab={timeLapsed.getCurrentIteration()}
                        timeToMove={timeToMove}
                        setNearestTick={setNearestTick}
                        offset={offset}
                        currentNearestTick={currentNearestTick}
                    />
                    <div
                        style={
                            {
                                width: '100%',
                                textAlign: 'center',
                                borderBottom: '2px double #BFBFBF',
                                marginBottom: '0.5rem'
                            }
                        }
                    >
                        {title} - chart
                    </div>
                </Block>
            </Block>
    );
}));

export default MultiLineChart;
