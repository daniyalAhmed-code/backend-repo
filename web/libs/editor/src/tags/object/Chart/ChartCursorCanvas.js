import { useCallback, useEffect, useState } from 'react';

import { CHART_TIME_SLAB, VIDEO_CUSTOM_ID_PREFIX } from '../../../utils/constants';

const COMMON_DIVIDER = 100;

const TIME_SLAB_SEC = CHART_TIME_SLAB / 1000;

const ChartCursorCanvas = ({
    renderedChart,
    canvasWidth,
    canvasHeight,
    title,
    totalSeconds,
    type,
    timeToMove,
    chartData,
    getLinePixelPosition,
    offset
}) => {
    
    const [height, setHeight] = useState(canvasHeight);

    const timeLapsed = (() => {
        let timeLapsed = 0;
        let currentStart = 0;
        let lastTimeRendered = 0;
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
                currentStart = 0;
                lastTimeRendered = 0;
                currentIteration = 1;
            },
            handleResumeIncrement: function() {
                //TODO handle the time to resume the chart update time,
                //when video is paused and then user plays the video.
            },
            setCurrentTime: function(newVal) { currentStart = newVal; },
            getCurrentTime: function() { return currentStart; },
            setLastRenderedTime: function(newVal) { lastTimeRendered = newVal; },
            getLastRenderedTime: function() { return lastTimeRendered; },
            setTotalIterations: function (iterations) { totalIterations = iterations; },
            getTotalIterations: function () { return totalIterations; },
            setCurrentIteration: function (iteration) { currentIteration = iteration; },
            getCurrentIteration: function () { return currentIteration; },
            incrementCurrentIteration: function () { currentIteration += 1; },
            isLastIteration: function () { return currentIteration === totalIterations; },
        }
        return obj;
    })();

    const offSet= (() => {
        let off_set = 0;
        return {
            setOffset: function setOffset(val) { off_set = val; },
            getOffset: function getOffset() { return off_set; }
        };
    })();

    const dataArray = (() => {
        let data = [];
        return {
            setData :function setData(newArr) { data = [...newArr]; },
            getData: function getData() { return data; },
        };
    })();

    useEffect(() => {
        offSet.setOffset(offset);
    }, [offset]);

    useEffect(() => {
        dataArray.setData(chartData);
    }, [chartData]);

    const convertTimeToPx = (time, canvas) => {
        // const canvas = canvasRef.current;
        // return ((time % (TIME_SLAB_SEC)) / (TIME_SLAB_SEC)) * (canvas.width);
        if (!canvas) return 0;
        const currentIteration = timeLapsed.getCurrentIteration();
        const px = ((time - (currentIteration - 1) * TIME_SLAB_SEC) / TIME_SLAB_SEC) * canvas.width;
        return px;
    };

    const formatTimeStamps = (timeInMilliSeconds) => {
        const sign = timeInMilliSeconds < 0 ? 1: 0;
        const timeDate = new Date(Math.abs(timeInMilliSeconds));
        // const timeStampStr = `${sign ? '-' + timeDate.toISOString().match(/T(.*?)Z/)?.[1]?.split('.')[0] : timeDate.toISOString().match(/T(.*?)Z/)?.[1]?.split('.')[0]}`;
        const timeStampStr = `${sign ? '-' + timeDate.toISOString().match(/T(.*?)Z/)?.[1] : timeDate.toISOString().match(/T(.*?)Z/)?.[1]}`;
        return timeStampStr;
    };

    const drawCursor = (overrideTime = null, offsetParam) => {
        if (renderedChart && renderedChart !== undefined) {
            const currentTimeLapsed = (overrideTime !== null && !isNaN(Number(overrideTime))) ? overrideTime :  timeLapsed.getCurrentTime();

            const off_set = offsetParam;

            const calcTime = ((currentTimeLapsed * 1000) + off_set );

            // console.log('*-*-*-*-*-*-calcTime-*-*-*-*-*-*-*-*', calcTime);

            const valueTick = dataArray.getData().find((v) => (Number(v.timestamp) >= (calcTime)));
            let tickPos = -1;
            if(valueTick) tickPos = getLinePixelPosition(Number(valueTick.timestamp));
        }
    };

    useEffect(() => {
        const videoElement = document.getElementById(`${VIDEO_CUSTOM_ID_PREFIX}-video-element`);
        const totalIteration = Math.round(Math.ceil(totalSeconds / (TIME_SLAB_SEC)));
        timeLapsed.setTotalIterations(totalIteration);
        if (!isNaN(Number(videoElement?.currentTime))) {
            timeLapsed.setTimeLapsed(videoElement?.currentTime);
            timeLapsed.setLastRenderedTime(videoElement?.currentTime);
            // drawCursor(null, offset);
        }
        videoElement?.addEventListener('timeupdate', function(event) {
            const currentTime = videoElement?.currentTime;
                const iteration = currentTime == 0 ? 1 : Math.round(Math.ceil(currentTime / (TIME_SLAB_SEC)));
                if (Math.abs(currentTime + timeLapsed.getTimeLapsed()) >= (TIME_SLAB_SEC * (iteration - 1))) {
                    const time = currentTime % TIME_SLAB_SEC;
                    timeLapsed.setTimeLapsed(time);    
                    timeLapsed.setLastRenderedTime(currentTime);
                    timeLapsed.setCurrentTime(currentTime);
                    // timeLapsed.incrementCurrentIteration();
                }
                else {
                    const diff = (currentTime - timeLapsed.getLastRenderedTime());
                    timeLapsed.setTimeLapsed(timeLapsed.getTimeLapsed() + diff);
                    timeLapsed.setLastRenderedTime(currentTime);
                }
                if (iteration !== timeLapsed.getCurrentIteration()) timeLapsed.setCurrentIteration(iteration);
                drawCursor(null, offset);
                return;
        });

        videoElement?.addEventListener('ended', function(event) {
            timeLapsed.resetTimeLapsed();
        });

        return () => {
            videoElement?.removeEventListener?.('timeupdate');
            videoElement?.removeEventListener?.('ended');
        }
    }, [chartData, offset]);

    useEffect(() => {
        const iteration = timeToMove < TIME_SLAB_SEC ? 1 : Math.round(Math.ceil(timeToMove / (TIME_SLAB_SEC)));
        const condition = iteration === timeLapsed.getCurrentIteration();
        if (!condition) timeLapsed.setCurrentIteration(iteration);
        drawCursor(timeToMove, offset);
    }, [timeToMove]);

    useEffect(() => {
        setHeight(renderedChart?.scales?.y?.height + 7);
    //     const canvasEl = document.getElementById(`${type}-${title}-chart-canvas-cursor`);
    //     if (canvasEl) {
    //         canvasEl.style.height = renderedChart?.scales?.y?.height + 7;
    //         canvasEl.style.width = canvasWidth;
    //     }
        // drawCursor();
    }, [renderedChart?.scales?.y?.height, canvasWidth]);

    return (
        <div style={
            {
                width: canvasWidth,
                height: height,
                position: 'absolute',
                left: renderedChart.scales.x._margins.left,
                top:36,
                overflow: 'hidden',
                border: '1px solid black',
                pointerEvents: 'none',
            }
        }>
            {/* {<canvas width={canvasWidth} height={canvasHeight} style={{ width: canvasWidth, height: height, pointerEvents: 'none' }} id={`${type}-${title}-chart-canvas-cursor`} />} */}
        </div>
    );
};

export default ChartCursorCanvas;
