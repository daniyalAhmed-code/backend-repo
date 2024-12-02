import { useEffect, useRef, useState } from 'react';

import { CHART_TIME_SLAB, VIDEO_CUSTOM_ID_PREFIX } from '../../../utils/constants';
import {  onSnapshot } from 'mobx-state-tree';
import { Tooltip } from '../../../lib/AudioUltra/Tooltip/Tooltip';

const TIME_SLAB_SEC = CHART_TIME_SLAB / 1000;

const REGION_DEFAULT_COLOR = '#afafaf';
// Function to convert hex color to RGBA with specified opacity
const hexToRGBA = (hex = REGION_DEFAULT_COLOR, opacity = 1) => {
    const hexValue = hex.replace('#', '');
    const r = parseInt(hexValue.substring(0, 2), 16);
    const g = parseInt(hexValue.substring(2, 4), 16);
    const b = parseInt(hexValue.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${opacity})`;
};

const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));

const timeLapsed = (() => {
    let totalIterations = 1;
    let currentIteration = 1;
    const obj = {
        resetTimeLapsed: function () {
            currentIteration = 1;
        },
        setTotalIterations: function (iterations) { totalIterations = iterations; },
        getTotalIterations: function () { return totalIterations; },
        setCurrentIteration: function (iteration) { currentIteration = iteration; },
        getCurrentIteration: function () { return currentIteration; },
        incrementCurrentIteration: function () { currentIteration += 1; },
        isLastIteration: function () { return currentIteration === totalIterations; },
    }
    return obj;
})();

const REGION_EDGE = {
    START: 'start',
    END: 'end'
};

Object.freeze(REGION_EDGE);


const ChartRegionsCanvas = ({
    renderedChart,
    canvasWidth,
    canvasHeight,
    title,
    type,
    store,
}) => {
    const toolTip = new Tooltip();
    const canvasRef = useRef(null);
    const [height, setHeight] = useState(canvasHeight);
    const [regions, setRegions] = useState([]);
    const [isDrawing, setIsDrawing] = useState(false);
    const [drawingRegion, setDrawingRegion] = useState(null);
    const [regionsListUpdated, setRegionsListUpdated] = useState('');
    const [regionFound, setRegionFound] = useState(null);
    const [findingCursorEvent, setFindingCursorEvent] = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [editingEdge, setEditingEdge] = useState('');
    const [editingRegion, setEditingRegion] = useState(null);
    const [editingIndex, setEditingIndex] = useState(-1);

    const getAreaColorByLabel = (results) => {
        let color = REGION_DEFAULT_COLOR;
        if (results && results.length) {
            const obj = results[0];
            const label = obj.value[obj.type][0];
            const labelColor = store.annotationStore.getLabelColor(label);
            if (labelColor) color = labelColor;
        }
        return color;
    };

    const convertTimeToPx = (time) => {
        // const canvas = canvasRef.current;
        // return ((time % (TIME_SLAB_SEC)) / (TIME_SLAB_SEC)) * (canvas.width);
        const currentIteration = timeLapsed.getCurrentIteration();
        const canvas = canvasRef.current;
        const px = ((time - (currentIteration - 1) * TIME_SLAB_SEC) / TIME_SLAB_SEC) * canvas.width;
        return px;
    };

    const convertPxToSec = (px) => {
        const currentIteration = timeLapsed.getCurrentIteration();
        const canvas = canvasRef.current;
        const time = ((px / canvas.width) * TIME_SLAB_SEC) + ((currentIteration - 1) * TIME_SLAB_SEC);
        return time;
    };

    const getConvertedRegionSecToPx = (currentSlab = timeLapsed.getCurrentIteration()) => {
        const storeRegions = store.annotationStore.getCurrentAnnotationRegions();// store.chartRegions?.map(r => getSnapshot(r));
        const canvas = canvasRef.current;
        const tempRegions = [];
        for (let i = 0; i < storeRegions?.length; i++) {
            const start = convertTimeToPx(storeRegions[i].start);
            const end = convertTimeToPx(storeRegions[i].end);
            const singleReg = { ...storeRegions[i], startX: start, startY: 0, endX: end, endY: canvas.height, color: getAreaColorByLabel(storeRegions[i].results) };
            tempRegions.push(singleReg);
        }
        return tempRegions;
    };

    const doesFallInCurrentSlab = (start, end) => {
        const currentSlab = timeLapsed.getCurrentIteration();
        const prevSlabStart = (currentSlab - 2) * TIME_SLAB_SEC;
        const slabStart = (currentSlab - 1) * TIME_SLAB_SEC;
        const prevSlabEnd = (currentSlab - 1) * TIME_SLAB_SEC;
        const slabEnd = currentSlab * TIME_SLAB_SEC;
        const nextSlabEnd = (currentSlab + 1) * TIME_SLAB_SEC;
        let flag = false;
        if (end > start) {
            if ((start >= slabStart && end <= slabEnd)) {
                flag = true;
            }
            else if (start < slabStart && end <= slabEnd) {
                flag = true;
            }
            else if (start >= slabStart && end > slabEnd) {
                flag = true;
            }
            if ((end <= slabEnd && start < prevSlabStart) || (end <= prevSlabEnd)) flag = false;
            else if (start >= slabStart && end > nextSlabEnd) flag = false;
        } else {
            flag = false;
        }
        return flag;
    };

    const drawRegions = (regionsToDraw) => {
        const currentSlab = timeLapsed.getCurrentIteration();
        const minTime = (currentSlab - 1) * TIME_SLAB_SEC;
        const maxTime = currentSlab * TIME_SLAB_SEC;
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        if (canvas && ctx) {
            ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

            regionsToDraw.forEach(region => {
                if ((doesFallInCurrentSlab(region.start, region.end) && !region.hidden) || (isDrawing && region.start != region.end)) {
                    if (minTime <= region.start && region.start < maxTime) {
                        ctx.fillStyle = hexToRGBA(region.color, region.isSelected ? 0.6 : 0.3);
                        // drawSingleRegion(region);
                        const { startX, startY, endX, endY } = region;
                        const width = endX - startX;
                        const height = endY - startY;
                        // ctx.fillRect(startX, startY, width, height);

                        // Draw the main region
                        ctx.fillRect(startX, startY, width, height);

                        // Draw left border
                        ctx.fillStyle = region.isSelected ? 'rgba(0, 0, 0, 0.85)' : hexToRGBA(region.color, 0.65); // Set border color
                        ctx.fillRect(startX, startY, 2, height); // Draw left border

                        // Draw right border
                        ctx.fillRect(endX - 2, startY, 2, height); // Draw right border

                        ctx.fillStyle = hexToRGBA(region.color, region.isSelected ? 0.6 : 0.3); // Reset fill style
                    } else if (minTime <= region.start && region.end > maxTime) {
                        ctx.fillStyle = hexToRGBA(region.color, region.isSelected ? 0.6 : 0.3);
                        // drawSingleRegion(region);
                        const { startX, startY, endY } = region;
                        const endX = canvas.width;
                        const width = endX - startX;
                        const height = endY - startY;
                        // ctx.fillRect(startX, startY, width, height);

                        // Draw the main region
                        ctx.fillRect(startX, startY, width, height);

                        // Draw left border
                        ctx.fillStyle = region.isSelected ? 'rgba(0, 0, 0, 0.85)' : hexToRGBA(region.color, 0.65); // Set border color
                        ctx.fillRect(startX, startY, 2, height); // Draw left border

                        // Draw right border
                        ctx.fillRect(endX - 2, startY, 2, height); // Draw right border

                        ctx.fillStyle = hexToRGBA(region.color, region.isSelected ? 0.6 : 0.3); // Reset fill style
                    }
                    else if (minTime > region.start && region.end < maxTime) {
                        ctx.fillStyle = hexToRGBA(region.color, region.isSelected ? 0.6 : 0.3);
                        // drawSingleRegion(region);
                        const { endX, startY, endY } = region;
                        const startX = 0;
                        const width = endX - startX;
                        const height = endY - startY;
                        // ctx.fillRect(startX, startY, width, height);

                        // Draw the main region
                        ctx.fillRect(startX, startY, width, height);

                        // Draw left border
                        ctx.fillStyle = region.isSelected ? 'rgba(0, 0, 0, 0.85)' : hexToRGBA(region.color, 0.65); // Set border color
                        ctx.fillRect(startX, startY, 2, height); // Draw left border

                        // Draw right border
                        ctx.fillRect(endX - 2, startY, 2, height); // Draw right border

                        ctx.fillStyle = hexToRGBA(region.color, region.isSelected ? 0.6 : 0.3); // Reset fill style
                    }
                }
            });
        }
    };

    /**
     * Effects
     */

    useEffect(() => {
        const videoElement = document.getElementById(`${VIDEO_CUSTOM_ID_PREFIX}-video-element`);
        videoElement?.addEventListener('timeupdate', function (event) {
            const currentTime = videoElement?.currentTime;
            const iteration = currentTime < TIME_SLAB_SEC ? 1 : Math.round(Math.ceil(currentTime / (TIME_SLAB_SEC)));
            if (iteration !== timeLapsed.getCurrentIteration()) timeLapsed.setCurrentIteration(iteration);
        });

        // videoElement.addEventListener('ended', function(event) {
        //     timeLapsed.resetTimeLapsed();
        // });

        return () => {
            videoElement?.removeEventListener?.('timeupdate');
            // videoElement?.removeEventListener?.('ended');
            toolTip.destroy();
        };
    }, []);

    onSnapshot(store.annotationStore.annotations, snap => {
        if (snap) {
            setRegionsListUpdated(`${Date.now()}`);
        }
    });

    onSnapshot(store.annotationRegionsStateChange, snap => {
            setRegionsListUpdated(`${Date.now()}`);
    });

    onSnapshot(store.labelsData, (snp) => {
        setRegionsListUpdated(Date.now());
      });

    useEffect(() => {
        setRegions([...getConvertedRegionSecToPx()]);
    }, [regionsListUpdated]);

    useEffect(() => {
        const calcRegions = getConvertedRegionSecToPx();
        setRegions([...calcRegions]);
        setTimeout(() => {
            setRegions([...calcRegions]);
        }, 10)
    }, [timeLapsed.getCurrentIteration()]);

    useEffect(() => {
        const regionsCalc = getConvertedRegionSecToPx();
        drawRegions([...regionsCalc]);
    }, [canvasWidth, canvasRef?.current?.clientHeight]);

    useEffect(() => {
        // if (regions.length) {
        //     drawRegions([...regions]);
        // };
        drawRegions([...regions]);
    }, [regions]);

    useEffect(() => {
        setHeight(renderedChart?.scales?.y?.height + 7);
    }, [renderedChart?.scales?.y?.height]);

    useEffect(() => {
        const canvas = canvasRef.current;
        const selectRegion = () => {
            if (regionFound) {
                store.annotationStore.selectRegionById(regionFound.id, isEditing);
                toolTip.hide();
            }
        };

        const handleResize = () => {
            if (editingEdge) {
                setIsEditing(true);
            } else {
                setIsEditing(false);
            }
        };

        if (regionFound) {
            // canvas.style.cursor = 'grab'; // Change cursor to grab
            canvas.addEventListener('click', selectRegion);
            if (findingCursorEvent) {
                const offsetX = findingCursorEvent.layerX;
                const isOnEdge = offsetX - regionFound.startX <= 2 || regionFound.endX - offsetX <= 2;
                if (isOnEdge) {
                    canvas.style.cursor = 'w-resize';
                    setEditingEdge(offsetX - regionFound.startX <= 2 ? REGION_EDGE.START : REGION_EDGE.END);
                    setIsEditing(isOnEdge);
                    // canvas.addEventListener('mousedown', handleResize);
                    // canvas.removeEventListener('click', selectRegion);
                }
                else {
                    canvas.style.cursor = 'grab';
                    // canvas.removeEventListener('mousedown', handleResize);
                    setEditingEdge('');
                    setIsEditing(false);
                    // canvas.addEventListener('click', selectRegion);
                }
            }
        } else {
            canvas.style.cursor = 'crosshair'; // Reset cursor
            canvas.removeEventListener('click', selectRegion);
        }

        return () => {
            canvas.removeEventListener('click', selectRegion);
            canvas.removeEventListener('mousedown', handleResize);
            toolTip.hide();
        };
    }, [regionFound]);

    useEffect(() => {
        const canvas = canvasRef.current;

        const handleMouseDown = (event) => {
            if (!isEditing) {
                setIsDrawing(true);
                const regionColor = store.annotationStore.getSelectedLabelColor() ?? REGION_DEFAULT_COLOR;
                const rect = canvas.getBoundingClientRect();
                const startX = event.clientX - rect.left;
                const startY = 0;
                const endY = canvas.height;
                const start = convertPxToSec(startX);

                canvas.addEventListener('mousemove', handleMouseMove);
                canvas.addEventListener('mouseup', handleMouseUp);

                const newRegion = { start, startX, startY, endX: startX, endY, color: regionColor };
                setDrawingRegion({ ...newRegion });
            }
        };

        const handleMouseMove = (event) => {
            const mouseX = event.offsetX;
            const mousePxTime = convertPxToSec(mouseX);
            const timeDate = new Date(mousePxTime * 1000);
            const onlyTime = timeDate.toISOString().match(/T(.*?)Z/)?.[1];
            toolTip.show(event.pageX, event.pageY + 16, `${onlyTime}`)
            if (!isDrawing && !isEditing) {

                // Check if the cursor is within any drawn region
                const region = getConvertedRegionSecToPx()?.find(region => (mousePxTime >= region.start && mousePxTime <= region.end));

                if (region) {
                    setRegionFound({ ...region });
                    setFindingCursorEvent(event);
                }
                else {
                    setRegionFound(null);
                    setFindingCursorEvent(null)
                }

            } else if (isEditing) {
                if (regionFound.locked) return;
                const rect = canvas.getBoundingClientRect();
                const regionIdx = getConvertedRegionSecToPx()?.findIndex(r => r.id === regionFound.id);
                setEditingIndex(regionIdx);
                switch (editingEdge) {
                    case REGION_EDGE.START: {
                        const startX = event.clientX - rect.left;
                        const updatedRegion = { ...regionFound, startX };
                        setEditingRegion({ ...updatedRegion });
                        break;
                    }
                    case REGION_EDGE.END: {
                        const endX = event.clientX - rect.left;
                        const updatedRegion = { ...regionFound, endX };
                        setEditingRegion({ ...updatedRegion });
                        break;
                    }
                    default: {
                        setEditingEdge('');
                        setIsEditing(false);
                    }
                }
            } else if (isDrawing) {
                const rect = canvas.getBoundingClientRect();
                const endX = event.clientX - rect.left;

                const updatedRegion = { ...drawingRegion };
                if (updatedRegion && Object.keys(updatedRegion).length) {
                    updatedRegion.endX = endX;
                }

                setDrawingRegion({ ...updatedRegion });
            }
        };

        const handleMouseUp = () => {
            setIsDrawing(false);
            setIsEditing(false);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
        };

        const handleMouseOut = () => {
            toolTip.hide();
        };

        canvas.addEventListener('mousedown', handleMouseDown);
        canvas.addEventListener('mousemove', handleMouseMove);
        canvas.addEventListener('mouseup', handleMouseUp);
        canvas.addEventListener('mouseout', handleMouseOut);

        return () => {
            canvas.removeEventListener('mousedown', handleMouseDown);
            canvas.removeEventListener('mousemove', handleMouseMove);
            canvas.removeEventListener('mouseup', handleMouseUp);
            canvas.removeEventListener('mouseout', handleMouseOut);
            toolTip.hide();
        };
    }, [drawingRegion]);

    useEffect(() => {
        if (isDrawing) {
            drawRegions([...regions, { ...drawingRegion }]);
        } else if (!isEditing && !isDrawing && drawingRegion && Object.keys(drawingRegion).length) {
            if (Math.abs(drawingRegion.startX - drawingRegion.endX) < 2) {
                setDrawingRegion(null);
                return;
            }
            const start = convertPxToSec(drawingRegion.startX);
            const end = convertPxToSec(drawingRegion.endX);
            store.setChartRegionToDraw({ start, end });
            store.setChartRegionDrawFlag(true);
            setDrawingRegion(null);
        }
        if (isEditing) {
            if (editingIndex > -1 && editingRegion) {
                const updatedRegions = [...regions.slice(0, editingIndex), { ...editingRegion }, ...(regions.slice(editingIndex + 1))];
                drawRegions(updatedRegions);
            }
        } else if (!isDrawing && !isEditing && editingRegion && Object.keys(editingRegion).length) {
            if (editingRegion.startX > editingRegion.endX) {
                const newEndX = editingRegion.startX;
                editingRegion.startX = editingRegion.endX;
                editingRegion.endX = newEndX;
            }
            const start = convertPxToSec(editingRegion.startX);
            const end = convertPxToSec(editingRegion.endX);
            store.setChartRegionToEdit({ start, end, id: editingRegion.id });
            store.setChartRegionEditFlag(true);
            setEditingRegion(null);
            setEditingEdge('');
            setEditingIndex(-1);
        }
    }, [isDrawing, drawingRegion, isEditing, editingRegion]);

    /********* Effects End ***********/

    return (
        <div style={{
            width: canvasWidth,
            height: height,
            position: 'absolute',
            left: renderedChart.scales.x._margins.left,
            top: 36,
            overflow: 'hidden',
            // border: '1px solid black',
            // backgroundColor: 'rgba(0, 1, 0, 0.25)',
            pointerEvents: 'auto',
        }}>
            <canvas
                ref={canvasRef}
                style={{ width: canvasWidth, height: height, pointerEvents: 'auto', cursor: 'crosshair' }}
                id={`${type}-${title}-chart-canvas-regions`}
                width={canvasWidth}
                height={height}
            />
        </div>
    );
};

export default ChartRegionsCanvas;
