import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { IconZoomIn } from '../../../assets/icons';
import { Button } from '../../../common/Button/Button';
import { Dropdown } from '../../../common/Dropdown/Dropdown';
import { Menu } from '../../../common/Menu/Menu';
import { ErrorMessage } from '../../../components/ErrorMessage/ErrorMessage';
import ObjectTag from '../../../components/Tags/Object';
import { Timeline } from '../../../components/Timeline/Timeline';
import { clampZoom, VideoCanvas } from '../../../components/VideoCanvas/VideoCanvas';
import { MAX_ZOOM_WHEEL, MIN_ZOOM_WHEEL, ZOOM_STEP, ZOOM_STEP_WHEEL } from '../../../components/VideoCanvas/VideoConstants';
import { defaultStyle } from '../../../core/Constants';
import { useFullscreen } from '../../../hooks/useFullscreen';
import { useToggle } from '../../../hooks/useToggle';
import { Block, Elem } from '../../../utils/bem';
import { FF_DEV_2715, isFF } from '../../../utils/feature-flags';
import ResizeObserver from '../../../utils/resize-observer';
import { clamp, isDefined } from '../../../utils/utilities';
import './Video.styl';
import { VideoRegions } from './VideoRegions';
import { VideoThumbnails } from '../../control/VideoThumbnails/VideoThumbnails';
import { VIDEO_CUSTOM_ID_PREFIX, TEMP_WORKOUT_ID } from './../../../utils/constants';
import { onSnapshot } from 'mobx-state-tree';
import { AudioHiddenIcon, AudioVisibleIcon, LabelsIcon, VideoOptionsIcon } from '../../../utils/custom-icons';
import { Tooltip } from '../../../common/Tooltip/Tooltip';
import { difference } from 'd3';
import { Switch } from 'antd';

const isFFDev2715 = isFF(FF_DEV_2715);

// const WORKOUT_ID = TEMP_WORKOUT_ID; // '749cfcdc-3b07-4f04-a04c-5c9d2c3d4bb5'; // 'e80c0e88-8618-42c7-99a5-389f0c50ffd7';

function useZoom(videoDimensions, canvasDimentions, shouldClampPan) {
  const [zoomState, setZoomState] = useState({ zoom: 1, pan: { x: 0, y: 0 } });
  const data = useRef({});

  data.current.video = videoDimensions;
  data.current.canvas = canvasDimentions;
  data.current.shouldClampPan = shouldClampPan;

  const clampPan = useCallback((pan, zoom) => {
    if (!shouldClampPan) {
      return pan;
    }
    const xMinMax = clamp((data.current.video.width * zoom - data.current.canvas.width) / 2, 0, Infinity);
    const yMinMax = clamp((data.current.video.height * zoom - data.current.canvas.height) / 2, 0, Infinity);

    return {
      x: clamp(pan.x, -xMinMax, xMinMax),
      y: clamp(pan.y, -yMinMax, yMinMax),
    };
  }, []);

  const setZoomAndPan = useCallback((value) => {
    return setZoomState((prevState) => {
      const nextState = (value instanceof Function) ? value(prevState) : value;
      const { zoom: prevZoom, pan: prevPan } = prevState;
      const nextZoom = clampZoom(nextState.zoom);

      if (nextZoom === prevZoom) {
        return prevState;
      }

      if (nextZoom === nextState.zoom) {
        return {
          zoom: nextState.zoom,
          pan: clampPan(nextState.pan, nextState.zoom),
        };
      }

      const scale = (nextZoom - prevZoom) / (nextState.zoom - prevZoom);
      const nextPan = {
        x: prevPan.x + (nextState.pan.x - prevPan.x) * scale,
        y: prevPan.y + (nextState.pan.y - prevPan.y) * scale,
      };

      return {
        pan: clampPan(nextPan, nextZoom),
        zoom: nextZoom,
      };
    });
  }, []);

  const setZoom = useCallback((value) => {
    return setZoomState(({ zoom, pan }) => {
      const nextZoom = clampZoom((value instanceof Function) ? value(zoom) : value);

      return {
        zoom: nextZoom,
        pan: {
          x: pan.x / zoom * nextZoom,
          y: pan.y / zoom * nextZoom,
        },
      };
    });
  }, []);

  const setPan = useCallback((pan) => {
    return setZoomState((currentState) => {
      pan = (pan instanceof Function) ? pan(currentState.pan) : pan;
      return {
        ...currentState,
        pan,
      };
    });
  }, []);

  return [zoomState, { setZoomAndPan, setZoom, setPan }];
}

const HtxVideoView = ({ item, store }) => {
  if (!item._value) return null;

  const WORKOUT_ID = store?.workoutId?.length ? store?.workoutId : TEMP_WORKOUT_ID;

  const [loadingThumbnails, setLoadingThumbnails] = useState(store.tasksDataListOptionsLoading.flag);

  const [tagHeight, setTagHeight] = useState(600);
  const [originalVideoRatio, setOriginalVideoRatio] = useState(1);
  const [isAudioVisible, setIsAudioVisible] = useState(store.shouldShowAudioWave.flag);
  const [showThumbnails, setShowThumbnails] = useState(store.showVideoOptions.flag);
  const [labelLoading, setLabelLoading] = useState(false);

  const limitCanvasDrawingBoundaries = !store.settings.videoDrawOutside;
  const videoBlockRef = useRef();
  const stageRef = useRef();
  const videoContainerRef = useRef();
  const mainContentRef = useRef();
  const [loaded, setLoaded] = useState(false);
  const [videoLength, _setVideoLength] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [position, _setPosition] = useState(1);

  const [pseudoLoading, setPseudoLoading] = useState(false);

  const [videoSize, setVideoSize] = useState(null);
  const [videoDimensions, setVideoDimensions] = useState({ width: 0, height: 0, ratio: 1 });
  const [{ zoom, pan }, { setZoomAndPan, setZoom, setPan }] = useZoom(
    videoDimensions,
    item.ref.current ? {
      width: item.ref.current.width,
      height: item.ref.current.height,
    } : { width: 0, height: 0 },
    limitCanvasDrawingBoundaries,
  );
  const [panMode, setPanMode] = useState(false);
  const [isFullScreen, enterFullscreen, exitFullscren, handleFullscreenToggle] = useToggle(false);
  const fullscreen = useFullscreen({
    onEnterFullscreen() { enterFullscreen(); },
    onExitFullscreen() { exitFullscren(); },
  });

  onSnapshot(store.tasksDataListOptionsLoading, snap => {
    setLoadingThumbnails(snap.flag);
  })

  useEffect(() => {
    if (store.workoutId && store.workoutId !== "undefined") {
      // console.info('selected task meta: ', store.taskMeta);
      store.fetchVideoOptions(store.workoutId);
    }
    // REMOVE; following lines for demo purposes to avoid remote video loading
    // if (!store.tasksDataListOptions.some(itm => (itm.video === item._value && itm.title === 'default'))) {
    //   store.unshiftVideoOptions({video: item._value, title: 'default'});
    // }
  },[store.workoutId, store.stage]);

  const getCurrentPosition = () => {
    return position;
  };
  const getCurrentVideoLength = () => {
    return videoLength;
  };

  const setPosition = useCallback((value) => {
    if (value !== position) {
      const nextPosition = clamp(value, 1, videoLength);

      _setPosition(nextPosition);
    }
  }, [position, videoLength]);

  const setVideoLength = useCallback((value) => {
    if (value !== videoLength) _setVideoLength(value);
  }, [videoLength]);

  const supportsRegions = useMemo(() => {
    return isDefined(item?.videoControl());
  }, [item]);

  useEffect(() => {
    if (item.ref.current) {
      store.videoRefChanged();
    }
  },[item.ref, item.ref.current]);

  useEffect(() => {
    const container = videoContainerRef.current;

    const cancelWheel = (e) => {
      if (!e.shiftKey) return;
      e.preventDefault();
    };

    container.addEventListener('wheel', cancelWheel);

    return () => container.removeEventListener('wheel', cancelWheel);
  }, []);

  useEffect(() => {
    const onResize = () => {
      const block = videoContainerRef.current;

      if (block) {
        setVideoSize([
          block.clientWidth,
          block.clientHeight,
        ]);
      }
    };

    const onKeyDown = (e) => {
      if (e.code.startsWith('Shift')) {
        e.preventDefault();

        if (!panMode) {
          setPanMode(true);

          const cancelPan = (e) => {
            if (e.code.startsWith('Shift')) {
              setPanMode(false);
              document.removeEventListener('keyup', cancelPan);
            }
          };

          document.addEventListener('keyup', cancelPan);
        }
      }
    };

    document.addEventListener('keydown', onKeyDown);

    const observer = new ResizeObserver(() => onResize());
    const [vContainer, vBlock] = [videoContainerRef.current, videoBlockRef.current];

    observer.observe(vContainer);
    observer.observe(vBlock);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      observer.unobserve(vContainer);
      observer.unobserve(vBlock);
      observer.disconnect();
    };
  }, []);

  useEffect(() => {
    const fullscreenElement = fullscreen.getElement();

    if (isFullScreen && !fullscreenElement) {
      fullscreen.enter(mainContentRef.current);
    } else if (!isFullScreen && fullscreenElement) {
      fullscreen.exit();
    }
  }, [isFullScreen]);

  const onZoomChange = useCallback((e) => {
    if (!e.shiftKey || !stageRef.current) return;
    // because its possible the shiftKey is the modifier, we need to check the appropriate delta
    const wheelDelta = Math.abs(e.deltaY) === 0 ? e.deltaX : e.deltaY;
    const polarity = wheelDelta > 0 ? 1 : -1;
    const stepDelta = Math.abs(wheelDelta * ZOOM_STEP_WHEEL);
    const delta = polarity * clamp(stepDelta, MIN_ZOOM_WHEEL, MAX_ZOOM_WHEEL);

    requestAnimationFrame(() => {
      setZoomAndPan(({ zoom, pan }) => {
        const nextZoom = zoom + delta;
        const scale = nextZoom / zoom;

        const pointerPos = {
          x: stageRef.current.pointerPos.x - item.ref.current.width / 2,
          y: stageRef.current.pointerPos.y - item.ref.current.height / 2,
        };

        return {
          zoom: nextZoom,
          pan: {
            x: pan.x * scale + (pointerPos.x * (1 - scale)),
            y: pan.y * scale + (pointerPos.y * (1 - scale)),
          },
        };
      });
    });
  }, []);

  const handlePan = useCallback((e) => {
    if (!panMode) return;

    const startX = e.pageX;
    const startY = e.pageY;

    const onMouseMove = (e) => {
      const position = item.ref.current.adjustPan(
        pan.x + (e.pageX - startX),
        pan.y + (e.pageY - startY),
      );

      requestAnimationFrame(() => {
        setPan(position);
      });
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  }, [panMode, pan]);

  const zoomIn = useCallback(() => {
    setZoom(zoom => zoom + ZOOM_STEP);
  }, []);

  const zoomOut = useCallback(() => {
    setZoom(zoom => zoom - ZOOM_STEP);
  }, []);

  const zoomToFit = useCallback(() => {
    setZoomAndPan({
      zoom: originalVideoRatio, // item.ref.current.videoDimensions.ratio,
      pan: { x: 0, y: 0 },
    });
  }, [originalVideoRatio]);

  const zoomReset = useCallback(() => {
    setZoomAndPan({
      zoom: 1,
      pan: { x: 0, y: 0 },
    });
  }, []);

  // VIDEO EVENT HANDLERS
  const handleFrameChange = useCallback((position, length) => {
    setPosition(position);
    setVideoLength(length);
    item.setOnlyFrame(position);
  }, [item, setPosition, setVideoLength]);

  const handleVideoLoad = useCallback(({ length, videoDimensions }) => {
    setLoaded(true);
    setZoom(videoDimensions.ratio);
    setVideoDimensions(videoDimensions);
    setVideoLength(length);
    item.setOnlyFrame(1);
    item.setLength(length);
    item.setReady(true);
  }, [item, setVideoLength]);

  const handleVideoResize = useCallback((videoDimensions) => {
    setVideoDimensions(videoDimensions);
  }, []);

  const handleVideoEnded = useCallback(() => {
    setPlaying(false);
    setPosition(videoLength);
  }, [videoLength, setPosition, setPlaying]);

  // TIMELINE EVENT HANDLERS
  const handlePlay = useCallback(() => {
    setPlaying((_playing) => {
      // Audio v3 & Syncable
      if (isFFDev2715) {
        if (!item.ref.current.playing) {
          // @todo item.ref.current.playing? could be buffering and other states
          item.ref.current.play();
          item.triggerSyncPlay();
        }
        return true;
      }
      // Audio v1,v2
      else {
        if (_playing === false) {
          item.ref.current.play();
          item.triggerSyncPlay();
          return true;
        }
        return _playing;
      }
    });
  }, []);

  const handlePause = useCallback(() => {
    setPlaying((_playing) => {
      // Audio v3 & Syncable
      if (isFFDev2715) {
        if (item.ref.current.playing) {
          item.ref.current.pause();
          item.triggerSyncPause();
        }
        return false;
      }
      // Audio v1,v2
      else {
        if (_playing === true) {
          item.ref.current.pause();
          item.triggerSyncPause();
          return false;
        }
        return _playing;
      }
    });
  }, []);

  const handleSelectRegion = useCallback((_, id, select) => {
    const region = item.findRegion(id);
    const selected = region?.selected || region?.inSelection;

    if (!region || (isDefined(select) && selected === select)) return;

    region.onClickRegion();
  }, [item]);

  const handleAction = useCallback((_, action, data) => {
    const regions = item.regs.filter(reg => reg.selected || reg.inSelection);

    regions.forEach(region => {
      switch (action) {
        case 'lifespan_add':
        case 'lifespan_remove':
          region.toggleLifespan(data.frame);
          break;
        case 'keypoint_add':
          region.addKeypoint(data.frame);
          break;
        case 'keypoint_remove':
          region.removeKeypoint(data.frame);
          break;
        default:
          console.warn('unknown action');
      }
    });
  }, [item.regs]);

  const handleTimelinePositionChange = useCallback((newPosition, updateAnyways = false) => {
    if (updateAnyways || position !== newPosition) {
      item.setFrame(newPosition);
      setPosition(newPosition);
    }
  }, [item, position]);

  useEffect(() => () => {
    item.ref.current = null;
  }, []);

  const regions = item.regs.map(reg => {
    const color = reg.style?.fillcolor ?? reg.tag?.fillcolor ?? defaultStyle.fillcolor;
    const label = reg.labels.join(', ') || 'Empty';
    const sequence = reg.sequence.map(s => ({
      frame: s.frame,
      enabled: s.enabled,
    }));

    return {
      id: reg.cleanId,
      label,
      color,
      visible: !reg.hidden,
      selected: reg.selected || reg.inSelection,
      sequence,
    };
  });


  const handleAfterSrcUpdate = (updatePos) => {
    setTimeout(() => {
      const vdoLength = getCurrentVideoLength();
      const clampedValue = clamp(updatePos, 1, vdoLength);
      handleTimelinePositionChange(clampedValue, true);
      setPseudoLoading(false);
    }, 500);
  };

  useEffect(() => {
    if (!isNaN(Number(item.ref?.current?.videoDimensions?.ratio)) && !(originalVideoRatio < 1)) {
      setOriginalVideoRatio(item.ref.current.videoDimensions.ratio ?? 1);
    }
  }, [item.ref?.current]);

  useEffect(() => {
    if (zoomCanvas && item?.ref?.current?.videoDimensions) setTagHeight(isNaN(Number(item?.ref?.current?.videoDimensions.height) * (zoom)) ? 600 : Number(item?.ref?.current?.videoDimensions?.height)  * (zoom));
  }, [zoom]);

  onSnapshot(store.showVideoOptions, (sna) => {
    setShowThumbnails(sna.flag);
  });

  onSnapshot(store.shouldShowAudioWave, (snap) => {
    setIsAudioVisible(snap.flag);
  });

  onSnapshot(store.labelOptLoading, snap => {
    setLabelLoading(snap.flag);
  });

  // useEffect(()=> {
  //   console.log('Offset changed Video', store.offset)
  // }, [store.offset]);

  useEffect(()=> {
    try {
      if (store.taskMeta && Object.keys(JSON.parse(store.taskMeta)).length) {
        if (JSON.parse(store.taskMeta)?.workout_id && JSON.parse(store.taskMeta)?.workout_id !== WORKOUT_ID) {
          fetchVideoOptions(JSON.parse(store.taskMeta)?.workout_id);
        }
    } 
    }catch (err) {
      console.error(err);
    }
  }, [store.taskMeta]);

  const [calculatedWidth, setCalculatedWidth] = useState(null);
  const CANVAS_WIDTH_FACTOR = 225;
  const [rootElemWidth, setRootElemWidth] = useState(0);

  useEffect(() => {
    const rootEl = document.getElementById('htx-video-root-el');
        const containerWidth = rootEl?.clientWidth;
        if ((!isNaN(Number(containerWidth))) && rootElemWidth !== containerWidth) setRootElemWidth(containerWidth);
    if (videoDimensions && videoDimensions.width > 0) {
      if (showThumbnails) {
        const widthCalc = ( videoDimensions.width >= containerWidth ? containerWidth - (CANVAS_WIDTH_FACTOR + 70) : (containerWidth - CANVAS_WIDTH_FACTOR));
        if (calculatedWidth !== widthCalc) setCalculatedWidth(widthCalc);
      } else {
        const remainingWidth = containerWidth - calculatedWidth;
        const difference = remainingWidth > 0 ? remainingWidth :  (CANVAS_WIDTH_FACTOR);
        const newWidth = containerWidth ?? (videoDimensions.width + difference);
        if (calculatedWidth !== videoDimensions.width) setCalculatedWidth(newWidth);
      }
    } else {
      if (containerWidth) setCalculatedWidth(containerWidth - (CANVAS_WIDTH_FACTOR + 75));
    }
  }, [showThumbnails, videoSize]);

  const [zoomCanvas, setZoomCanvas] = useState(false);


  return (
    <ObjectTag item={item} style={{ width: '100%' }}>
      {/* <div id="htx-video-root-el" style={{ width: '100%', minHeight: `${ videoSize ? 50 : 50 }px` }}> */}
      <div id="htx-video-root-el" style={{ width: '100%', minHeight: `${ videoSize ? videoSize[1] : 50 }px` }}>
      <Block name="video-segmentation" ref={mainContentRef} mod={{ fullscreen: isFullScreen }}>
        {item.errors?.map((error, i) => (
          <ErrorMessage key={`err-${i}`} error={error} />
        ))}

  
        {/* <div style={{ width: '100%',display: `${ Number(tagHeight) && (videoSize && videoSize[1]) ? 'flex' : 'block'}`, justifyContent: 'center', alignItems: 'stretch', flexDirection: 'row-reverse', minHeight: `${ videoSize ? 50 : 50 }px` }}> */}
        <div style={{ width: '100%',display: `${ Number(tagHeight) && (videoSize && videoSize[1]) ? 'flex' : 'block'}`, justifyContent: 'center', alignItems: 'stretch', flexDirection: 'row-reverse', minHeight: `${ videoSize ? videoSize[1] : 50 }px` }}>
          <Block name="video" mod={{ fullscreen: isFullScreen }} ref={videoBlockRef}>
            <Elem
              name="main"
              ref={videoContainerRef}
              // style={{ height: Number(item.height) }}
              style={{ height: Number(tagHeight)}}
              onMouseDown={handlePan}
              onWheel={onZoomChange}
            >
              {videoSize && (
                <>
                  {loaded && supportsRegions && (
                    <VideoRegions
                      item={item}
                      zoom={zoom}
                      pan={pan}
                      locked={panMode}
                      regions={item.regs}
                      width={calculatedWidth ?? videoSize[0] + CANVAS_WIDTH_FACTOR}
                      // width={videoSize[0]}
                      // width={width}
                      height={videoSize[1]}
                      // height={height}
                      workingArea={videoDimensions}
                      allowRegionsOutsideWorkingArea={!limitCanvasDrawingBoundaries}
                      stageRef={stageRef}
                    />
                  )}
                  <VideoCanvas
                    ref={item.ref}
                    src={item._value}
                    width={calculatedWidth ?? videoSize[0]}
                    // width={videoSize[0]}
                    // width={item.width}
                    height={videoSize[1]}
                    // height={item.height}
                    muted={true}
                    zoom={zoom}
                    pan={pan}
                    speed={item.speed}
                    framerate={item.framerate}
                    allowInteractions={false}
                    allowPanOffscreen={!zoomCanvas && !limitCanvasDrawingBoundaries}
                    onFrameChange={handleFrameChange}
                    onLoad={handleVideoLoad}
                    onResize={handleVideoResize}
                    // onClick={togglePlaying}
                    onEnded={handleVideoEnded}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onSeeked={item.handleSeek}
                    pseudoLoading={pseudoLoading}
                    setPseudoLoading={setPseudoLoading}
                    customIdPrefix={VIDEO_CUSTOM_ID_PREFIX}
                  />
                </>
              )}
            </Elem>
          </Block>
          <div id="thumbnails-options">
            <VideoThumbnails
              item={item}
              store={store}
              setPseudoLoading={setPseudoLoading}
              getCurrentPosition={getCurrentPosition}
              handleAfterSrcUpdate={handleAfterSrcUpdate}
              showThumbnails={showThumbnails}
              videoSize={videoSize}
              rootElemWidth={rootElemWidth}
              optionsLoading={loadingThumbnails}
            />
          </div>
        </div>

        {loaded && (
          <Elem
            name="timeline"
            customIdPrefix={VIDEO_CUSTOM_ID_PREFIX}
            tag={Timeline}
            playing={playing}
            length={videoLength}
            position={position}
            regions={regions}
            altHopSize={store.settings.videoHopSize}
            allowFullscreen={false}
            fullscreen={isFullScreen}
            defaultStepSize={16}
            disableView={!supportsRegions}
            framerate={item.framerate}
            controls={{ FramesControl: true }}
            customControls={[
              {
                position: 'left',
                component: () => {
                  return (
                    <Dropdown.Trigger
                      key="dd"
                      inline={isFullScreen}
                      content={(
                        <Menu size="auto" closeDropdownOnItemClick={false}>
                          <Menu.Item onClick={zoomIn}>Zoom In</Menu.Item>
                          <Menu.Item onClick={zoomOut}>Zoom Out</Menu.Item>
                          <Menu.Item onClick={zoomToFit}>Zoom To Fit</Menu.Item>
                          <Menu.Item onClick={zoomReset}>Zoom 100%</Menu.Item>
                        </Menu>
                      )}
                    >
                      <Button size="small" nopadding><IconZoomIn/></Button>
                    </Dropdown.Trigger>
                  );
                },
              },
              {
                position: 'left',
                component: () => {
                  return (
                      <Switch checkedChildren={'Zoom component'} unCheckedChildren={'Zoom video only'} checked={zoomCanvas} onChange={() => { setZoomCanvas(!zoomCanvas) }}/>
                  );
                },
              },
              // {
              //   position: 'right',
              //   component: () => {
              //     return (<Tooltip key="t-t-video-options" title={
              //       store.tasksDataListOptions.length === 0 ? 'No video options to show'
              //       :
              //       showThumbnails ? 'Hide' : 'Show video options'
              //     }>
              //       <Button
              //       key='btn-video-options-toggle'
              //       onClick={() => {
              //         store.setShowVideoOptions(!showThumbnails);
              //       }}
              //       style={{ minWidth: 'fit-content', whiteSpace: 'nowrap', margin: 'auto 0.85rem' }}
              //     >
              //       <div style={{ width: '1.5rem' }}>
              //         <VideoOptionsIcon />
              //       </div>
              //     </Button>
              //     </Tooltip>)
              //   }
              // },
              {
                position: 'left',
                component: () => {
                  return (
                    <Tooltip key="t-t-labels-btn" title={labelLoading ? 'Fetching Labels' : 'Add Labels'}>
                      <Button
                        style={{ minWidth: 'fit-content', whiteSpace: 'nowrap', marginInline: '0.85rem' }}
                        onClick={() => {
                          if (labelLoading) return;
                          store.annotationStore?.selected?.unselectAll?.();
                          store.setShowLabelsModal(true)
                        }}
                      >
                        <div style={{ width: '1.5rem', height: 'auto'}}>
                          {labelLoading ? <Block name="spinner" style={{ width: '24px', height: '24px' }}/> : <LabelsIcon />}
                        </div>
                      </Button>
                    </Tooltip>
                  )
                }
              },
              {
                position: 'right',
                component: () => {
                  return (
                    <div key="custom-btn-tray" style={{ marginInline: '25px', display:'flex', alignItems: 'center', columnGap: '16px' }}>
                      <Tooltip key="t-t-video-options" title={
                        store.tasksDataListOptions.length === 0 ? 'No video options to show'
                        :
                        showThumbnails ? 'Hide' : 'Show video options'
                      }>
                        <Button
                          key='btn-video-options-toggle'
                          onClick={() => {
                            store.setShowVideoOptions(!showThumbnails);
                          }}
                          style={{ minWidth: 'fit-content', whiteSpace: 'nowrap' }}
                        >
                          <div style={{ width: '1.5rem' }}>
                            <VideoOptionsIcon />
                          </div>
                        </Button>
                      </Tooltip>
                      <Tooltip key="t-t-toggle-audio-wave-btn" title={isAudioVisible ? 'Hide Audio' : 'Show Audio'}>
                        <Button
                          style={{ minWidth: 'fit-content', whiteSpace: 'nowrap' }}
                          onClick={() => store.setShouldShowAudioWave(!isAudioVisible)}
                        >
                          <div style={{ width: '1.5rem', height: 'auto'}}>
                            {isAudioVisible ? <AudioVisibleIcon /> : <AudioHiddenIcon />}
                          </div>
                        </Button>
                      </Tooltip>
                    </div>
                  )
                }
              },
            ]}
            onPositionChange={handleTimelinePositionChange}
            onPlay={handlePlay}
            onPause={handlePause}
            onFullscreenToggle={handleFullscreenToggle}
            onSelectRegion={handleSelectRegion}
            onAction={handleAction}
          />
        )}
      </Block>
      </div>
    </ObjectTag>
  );
};

export { HtxVideoView };
