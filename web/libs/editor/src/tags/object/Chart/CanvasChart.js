import { useEffect, useRef, useState } from 'react';

import { Block } from '../../../utils/bem';
import ChartCursorCanvas from './ChartCursorCanvas';
import { inject, observer } from 'mobx-react';
import ChartRegionsCanvas from './ChartRegionsCanvas';
import { nanoid } from 'nanoid';
import { CHART_TIME_SLAB, VIDEO_CUSTOM_ID_PREFIX } from '../../../utils/constants';

const TIME_SLAB_SEC = CHART_TIME_SLAB / 1000;

const LINE_BORDER_WIDTH = 2;
const LINE_FILL = false;
const LINE_BORDER_JOIN_STYLE = 'bevel';
const LINE_TENSION = 1;
const LINE_POINT_RADIUS = 0;
const LINE_GRID_DISPLAY = false;
const LINE_SNAP_GAPS = true;

const LINE_BORDER_X = 'rgba(248, 153, 81, 1)';
const LINE_BORDER_Y = 'rgba(135, 187, 132, 1)';
const LINE_BORDER_Z = 'rgba(144, 180, 211, 1)';

// const chartHoverCorsairPlugin = {
//     id: 'corsair',
//     defaults: {
//         width: 1,
//         color: '#FF4949',
//         dash: [3, 3],
//     },
//     afterInit: (chart, args, opts) => {
//       chart.corsair = {
//         x: 0,
//         y: 0,
//       }
//     },
//     afterEvent: (chart, args) => {
//       const {inChartArea} = args
//       const {type,x,y} = args.event

//       chart.corsair = {x, y, draw: inChartArea}
//       chart.draw()
//     },
//     beforeDatasetsDraw: (chart, args, opts) => {
//       const {ctx} = chart
//       const {top, bottom, left, right} = chart.chartArea
//       const {x, y, draw} = chart.corsair
//       if (!draw) return

//       ctx.save()
      
//       ctx.beginPath()
//       ctx.lineWidth = opts.width
//       ctx.strokeStyle = opts.color
//       ctx.setLineDash(opts.dash)
//       ctx.moveTo(x, bottom)
//       ctx.lineTo(x, top)
//       ctx.moveTo(left, y)
//       ctx.lineTo(right, y)
//       ctx.stroke()
      
//       ctx.restore()
//     }
//   };


const chartHoverCorsairPlugin = {
    id: 'corsair',
    defaults: {
      width: 1,
      color: '#000',
      zIndex: 10, // Example: Set a zIndex to bring the line to front
    },
    afterInit: (chart, args, opts) => {
      chart.corsair = {
        x: null, // Initialize x coordinate as null
        y: 0,
        draw: false,
      };
    },
    setCursorX: (chart, x) => {
      chart.corsair.x = x;
      chart.corsair.draw = true;
      chart.draw();
    },
    afterDraw: (chart, args, opts) => {
      const { ctx } = chart;
      const { top, bottom } = chart.chartArea;
      const { x, draw } = chart.corsair;
  
      if (!draw || x === null) return;
  
      ctx.save();

      // Adjust the zIndex if specified in defaults
    if (opts.zIndex) {
        ctx.canvas.style.zIndex = opts.zIndex;
      }
  
      ctx.beginPath();
      ctx.lineWidth = opts.width;
      ctx.strokeStyle = opts.color;
      ctx.moveTo(x, bottom - 2);
      ctx.lineTo(x, top - 8); // Draw only the vertical line
      ctx.stroke();
  
      ctx.restore();

      // Reset canvas zIndex after drawing
    if (opts.zIndex) {
        ctx.canvas.style.zIndex = 'initial';
      }
    }
  };
  
  

const formatTimeStamps = (timeInMilliSeconds) => {
    const sign = timeInMilliSeconds < 0 ? 1: 0;
    const timeDate = new Date(Math.abs(timeInMilliSeconds));
    // const timeStampStr = `${sign ? '-' + timeDate.toISOString().match(/T(.*?)Z/)?.[1]?.split('.')[0] : timeDate.toISOString().match(/T(.*?)Z/)?.[1]?.split('.')[0]}`;
    const timeStampStr = `${sign ? '-' + timeDate.toISOString().match(/T(.*?)Z/)?.[1] : timeDate.toISOString().match(/T(.*?)Z/)?.[1]}`;
    return timeStampStr;
};


const CanvasChart = inject('store')(observer(({
    chartData,
    totalSeconds,
    end,
    currentTime,
    title,
    type,
    item,
    store,
    currentSlab,
    timeToMove,
    setNearestTick,
    offset,
    currentNearestTick
}) => {
    /**
     * Actual Chart Comp
     */
    const id = nanoid();

    const CHART_PLUGIN = [chartHoverCorsairPlugin];

    const CHART_OPTIONS = {
        maintainAspectRatio: false,
        scales: {
            x: {
                grid: {
                    display: LINE_GRID_DISPLAY,
                    // tickBorderDash: [10,1]
                },
                ticks: {
                    //   // For a category axis, the val is the index so the lookup via getLabelForValue is needed
                      callback: function(val, index) {
                        const timeStamp = (Number(this.getLabelForValue(val)));
                        const label = timeStamp ? `${formatTimeStamps(timeStamp)}` : this.getLabelForValue(val);
                        return label;
                        // Hide every 2nd tick label
                        // return index % 2 === 0 ? this.getLabelForValue(val) : '';
                      },
                    // sampleSize: 20,
                    maxTicksLimit: TIME_SLAB_SEC //- 1, //9
                },
            },
            y: {
                grid: {
                    display: LINE_GRID_DISPLAY,
                },
            },
        },
    }

    function getLinePixelPosition(dataValue) {
        if (renderedChart && renderedChart !== null){

            const index = renderedChart.data.labels.indexOf(`${(dataValue)}`);
            
            if (index !== -1) {
              // Get the pixel position of the matching data point
            //   const dataIndex = renderedChart.data.datasets[0].index; 
              const meta = renderedChart.getDatasetMeta(0);
              const pixelPosition = meta.data[index]?.x;
            const zIndex = 10; // Specify the zIndex to bring the line to front
            chartHoverCorsairPlugin.defaults.zIndex = zIndex;
            chartHoverCorsairPlugin.setCursorX(renderedChart, pixelPosition);
            setNearestTick?.(dataValue);
              return pixelPosition;
            }
        }
        
        // Handle case where dataValue is not found
        console.error(`Data value ${dataValue} not found in chart data.`);
        return null;
      }

      useEffect(() => {
        if (!isNaN(Number(currentNearestTick)) && (renderedChart && renderedChart !== null)) {
            const videoElement = document.getElementById(`${VIDEO_CUSTOM_ID_PREFIX}-video-element`);
            const currentTimeLapsed = videoElement?.currentTime ?? 0;

            const calcTime = ((currentTimeLapsed * 1000) + offset );
            const valueTick = chartData.find((v) => (Number(v.timestamp) >= (calcTime)));
            // getLinePixelPosition(newTickTimeStamp);
            if (!isNaN(Number(valueTick?.timestamp))) {
                /**
                 * TODO; Following needs to be refactored, as it is a redundant call for same parameters.
                 * Currently it needs to be called twice to move the IMU progress cursor onto the correct calculated timestamp tick, upon offset change.
                 */
                getLinePixelPosition(Number(valueTick?.timestamp));
                setTimeout(() => {
                    getLinePixelPosition(Number(valueTick?.timestamp));
                }, 10);
            }
        }
      }, [offset]);

    const chartRef = useRef(null);

    const [renderedChart, setRenderedChart] = useState(null);
    const [totalWidth, setTotalWidth] = useState(400);

    const reFormatData = () => {
        const mapData = [...chartData];
        if (mapData.length) {
            if (Number(mapData[mapData.length - 1]?.timestamp) < end * 1000) {
                mapData.push({
                    timestamp: `${end * 1000}`,
                    gyro_x: '0',
                    gyro_y: '0',
                    gyro_z: '0'
                })
            }
        }
        const timestamps = mapData.map(entry => entry.timestamp);
        switch(type){
            case 'gyro':
                {
                    const gyroX = mapData.map(entry => parseFloat(entry.gyro_x));
                    const gyroY = mapData.map(entry => parseFloat(entry.gyro_y));
                    const gyroZ = mapData.map(entry => parseFloat(entry.gyro_z));
                    return {
                        timestamps,
                        gyroX,
                        gyroY,
                        gyroZ
                    };
                }
            case 'accel':
                {
                    const accelX = mapData.map(entry => parseFloat(entry.accel_x));
                    const accelY = mapData.map(entry => parseFloat(entry.accel_y));
                    const accelZ = mapData.map(entry => parseFloat(entry.accel_z));
                    return {
                        timestamps,
                        accelX,
                        accelY,
                        accelZ
                    };
                }
            default:
                {
                    const gyroX = mapData.map(entry => parseFloat(entry.gyro_x));
                    const gyroY = mapData.map(entry => parseFloat(entry.gyro_y));
                    const gyroZ = mapData.map(entry => parseFloat(entry.gyro_z));
                    return {
                        timestamps,
                        gyroX,
                        gyroY,
                        gyroZ
                    };
            }
        }
    };

    const getChartDataObject = () => {
        const {
            timestamps,
            gyroX,
            gyroY,
            gyroZ,
            accelX,
            accelY,
            accelZ,
        } = reFormatData();
        switch(type){
            case 'accel': {
                return {
                    labels: timestamps,
                    datasets: [
                        {
                            label: 'accel_x',
                            data: accelX,
                            borderColor: LINE_BORDER_X,
                            borderWidth: LINE_BORDER_WIDTH,
                            fill: LINE_FILL,
                            borderJoinStyle: LINE_BORDER_JOIN_STYLE,
                            tension: LINE_TENSION,
                            pointRadius: LINE_POINT_RADIUS,
                            spanGaps: LINE_SNAP_GAPS,
                        },
                        {
                            label: 'accel_y',
                            data: accelY,
                            borderColor: LINE_BORDER_Y,
                            borderWidth: LINE_BORDER_WIDTH,
                            fill: LINE_FILL,
                            borderJoinStyle: LINE_BORDER_JOIN_STYLE,
                            tension: LINE_TENSION,
                            pointRadius: LINE_POINT_RADIUS,
                            spanGaps: LINE_SNAP_GAPS,
                        },
                        {
                            label: 'accel_z',
                            data: accelZ,
                            borderColor: LINE_BORDER_Z,
                            borderWidth: LINE_BORDER_WIDTH,
                            fill: LINE_FILL,
                            borderJoinStyle: LINE_BORDER_JOIN_STYLE,
                            tension: LINE_TENSION,
                            pointRadius: LINE_POINT_RADIUS,
                            spanGaps: LINE_SNAP_GAPS,
                        }
                    ]
                }
            }
            case 'gyro': {
                return {
                    labels: timestamps,
                    datasets: [
                        {
                            label: 'gyro_x',
                            data: gyroX,
                            borderColor: LINE_BORDER_X,
                            borderWidth: LINE_BORDER_WIDTH,
                            fill: LINE_FILL,
                            borderJoinStyle: LINE_BORDER_JOIN_STYLE,
                            tension: LINE_TENSION,
                            pointRadius: LINE_POINT_RADIUS,
                            spanGaps: LINE_SNAP_GAPS,
                        },
                        {
                            label: 'gyro_y',
                            data: gyroY,
                            borderColor: LINE_BORDER_Y,
                            borderWidth: LINE_BORDER_WIDTH,
                            fill: LINE_FILL,
                            borderJoinStyle: LINE_BORDER_JOIN_STYLE,
                            tension: LINE_TENSION,
                            pointRadius: LINE_POINT_RADIUS,
                            spanGaps: LINE_SNAP_GAPS,
                        },
                        {
                            label: 'gyro_z',
                            data: gyroZ,
                            borderColor: LINE_BORDER_Z,
                            borderWidth: LINE_BORDER_WIDTH,
                            fill: LINE_FILL,
                            borderJoinStyle: LINE_BORDER_JOIN_STYLE,
                            tension: LINE_TENSION,
                            pointRadius: LINE_POINT_RADIUS,
                            spanGaps: LINE_SNAP_GAPS,
                        }
                    ]
                }
            }
            default: {
                return {
                    labels: timestamps,
                    datasets: [
                        {
                            label: 'gyro_x',
                            data: gyroX,
                            borderColor: LINE_BORDER_X,
                            borderWidth: LINE_BORDER_WIDTH,
                            fill: LINE_FILL,
                            borderJoinStyle: LINE_BORDER_JOIN_STYLE,
                            tension: LINE_TENSION,
                            pointRadius: LINE_POINT_RADIUS,
                            spanGaps: LINE_SNAP_GAPS,
                        },
                        {
                            label: 'gyro_y',
                            data: gyroY,
                            borderColor: LINE_BORDER_Y,
                            borderWidth: LINE_BORDER_WIDTH,
                            fill: LINE_FILL,
                            borderJoinStyle: LINE_BORDER_JOIN_STYLE,
                            tension: LINE_TENSION,
                            pointRadius: LINE_POINT_RADIUS,
                            spanGaps: LINE_SNAP_GAPS,
                        },
                        {
                            label: 'gyro_z',
                            data: gyroZ,
                            borderColor: LINE_BORDER_Z,
                            borderWidth: LINE_BORDER_WIDTH,
                            fill: LINE_FILL,
                            borderJoinStyle: LINE_BORDER_JOIN_STYLE,
                            tension: LINE_TENSION,
                            pointRadius: LINE_POINT_RADIUS,
                            spanGaps: LINE_SNAP_GAPS,
                        }
                    ]
                }
            }
        }
    };

    const renderChart = (ctx) => {
        const chartData = getChartDataObject();
        return new window.Chart(ctx, {
            type: 'line',
            title: {
                display: true,
                text: title
            },
            data: chartData,
            options: CHART_OPTIONS,
            plugins: CHART_PLUGIN,
        });
    };

    const updateChart = () => {
        const chartData = getChartDataObject();
        renderedChart.data = chartData;
        renderedChart.options = {
            ...CHART_OPTIONS
        }
        renderChart.plugins = CHART_PLUGIN;
        renderedChart.update();
        // if (!isNaN(Number(currentNearestTick))) getLinePixelPosition(currentNearestTick);
    };

    useEffect(() => {
        if (renderedChart && renderedChart !== null) updateChart();
    }, [chartData]);

    useEffect(() => {
        const canvasEl = document.getElementById(`chart-canvas-${title}-${type}-${id}`);
        const ctx = canvasEl?.getContext('2d');//chartRef.current.getContext('2d');
        if (!canvasEl){
            const newCanV = document.createElement('canvas');
            newCanV.id = `chart-canvas-${title}-${type}`;
            document.body.appendChild(newCanV);
            if (window.Chart) setRenderedChart(renderChart(newCanV.getContext('2d')));
        }
        else if (window.Chart && ctx) {
            setRenderedChart(renderChart(ctx));
        }
        return () => {
            canvasEl?.remove?.();
        };
    }, []);
    
    let timeLapsed = 0;
    useEffect(() => {
        timeLapsed = 0;
    }, [item.playedTime, chartData]);

    return (
        <Block name="multiline-chart-canvas">
            <canvas height={200} ref={chartRef} id={`chart-canvas-${title}-${type}-${id}`} />
            {
                (renderedChart && renderedChart !== undefined)
                &&
                <ChartRegionsCanvas
                    canvasWidth={renderedChart?.scales?.x?.width}
                    rightOffset={renderedChart?.scales?.x?.left}
                    canvasHeight={renderedChart?.scales?.y?.height}
                    renderedChart={renderedChart}
                    currentTime={currentTime}
                    totalSeconds={totalSeconds}
                    totalWidth={totalWidth}
                    title={title}
                    type={type}
                    store={store}
                    currentSlab={currentSlab}
                />
            }
            {
                (renderedChart && renderedChart !== undefined)
                &&
                <ChartCursorCanvas
                    canvasWidth={renderedChart?.scales?.x?.width}
                    rightOffset={renderedChart?.scales?.x?.left}
                    canvasHeight={renderedChart?.scales?.y?.height}
                    renderedChart={renderedChart}
                    currentTime={currentTime}
                    totalSeconds={totalSeconds}
                    totalWidth={totalWidth}
                    title={title}
                    type={type}
                    timeToMove={timeToMove}
                    chartData={chartData}
                    getLinePixelPosition={getLinePixelPosition}
                    offset={offset}
                />
            }
        </Block>
    );
}));

export default CanvasChart;
