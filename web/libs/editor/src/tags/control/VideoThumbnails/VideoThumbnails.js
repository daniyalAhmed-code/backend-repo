import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { inject, observer } from 'mobx-react';

import { Button } from '../../../common/Button/Button';
import ObjectTag from '../../../components/Tags/Object';
import { VideoCanvas as VideoThumbnailCanvas } from '../../../components/VideoCanvasThumbnail/VideoThumbnailCanvas';
import { Block, Elem } from '../../../utils/bem';
import { FF_DEV_2715, isFF } from '../../../utils/feature-flags';
import './VideoThumbnails.styl';
import { Hotkey } from '../../../core/Hotkey';
import { VIDEO_CUSTOM_ID_PREFIX } from './../../../utils/constants';
import { ErrorMessage } from '../../../components/ErrorMessage/ErrorMessage';
import { onSnapshot } from "mobx-state-tree";

const BASE_URL_VIDEO = '';
const isFFDev2715 = isFF(FF_DEV_2715);

const wait = (delay) => new Promise((resolve) => setTimeout(resolve, delay));


const VideoThumbnails = ({
  item,
  store,
  setPseudoLoading,
  getCurrentPosition,
  handleAfterSrcUpdate,
  showThumbnails,
  videoSize,
  rootElemWidth,
  optionsLoading
}) => {
  const shouldShow = window.localStorage.getItem('showThumbnails')?.toLocaleLowerCase() === 'true';
  const [loadingData, setLoadingData] = useState(true);
  const [error, setError] = useState('');
  const [thumbnailWidth, setThumbnailWidth] = useState(280)

  onSnapshot(store.tasksDataListOptionsLoading, snap => {
    setLoadingData(snap.flag);
    if (snap.flag && (store.tasksDataListOptionsErrMsg && store.tasksDataListOptionsErrMsg.trim() !== "")) setError('');
    else if (store.tasksDataListOptionsErrMsg.trim() !== error.trim()) setError(store.tasksDataListOptionsErrMsg);
  });

  const getSrc = (obj) => {
    if(obj.video === item._value) return item._value;
    let src = '';
    if (!obj.title || obj?.title === 'default') src =  obj?.video;
    else src =  BASE_URL_VIDEO + obj?.video;
    return src;
  };

  const updateCurrentVideoSrc = async (newSrc) => {
    if (store.tasksDataListOptions.loading) return;
    const currPos = getCurrentPosition();
    if(newSrc !== item._value) {
      const stopBtn = document.getElementById(`${VIDEO_CUSTOM_ID_PREFIX}-custom-id-for-stop-btn`);
      const btn = document.querySelector(`[data-testid="${VIDEO_CUSTOM_ID_PREFIX}-playback-button:pause"]`);
      btn?.click();
      await wait(101);
      stopBtn?.click();
      setPseudoLoading(true);
      await wait(300);
      store.updateTaskData(newSrc);
      await wait(300);
      handleAfterSrcUpdate(currPos);
      // store.reAssignConfig(config);
    }
  };

  onSnapshot(store.tasksDataListOptions, (snapshot) => {
    if (store.tasksDataListOptions.length && !store.tasksDataListOptions.some(itm => (itm.video === item._value && itm.title === 'default'))) {
      //REMOVE comment
      //For demonstration purpose, to avoid loading remote video and stop adding duplicate options comment out following line
      store.addDefaultToVideoOptions({video: item._value, title: 'default'});
    }
  });

  useEffect(() => {
    const hotkeys = Hotkey('Video', 'Video options');

    /**
     * Explanation: For some reason when video is switched using short-cut keys, instead of clicking on the thumbnail
     * the progressed seek of the video always gets set to 1st frame. Even if we try to capture the video progress in 
     * the callback of short-cut key listener, the progress is always picked up as 1st frame. That's why added functionality to
     * programmatically emit the click event of thumbnail element and preserve the video progress.
     */
    hotkeys.addNamed('media:switch-to-next', async () => {
      const length = store.tasksDataListOptions.length;
      if (length === 0) return;
      const currIdx = store.tasksDataListOptions.findIndex(itm => BASE_URL_VIDEO + (itm).video === item._value);
      if (currIdx > -1) {
        let nextIdx = currIdx + 1;
        if ((currIdx + 1) === length) nextIdx = 0;
        const thumbNailElem = document.querySelector('[custom-id="' + nextIdx + '-thumbnail-element"]');
        if (thumbNailElem) {
          thumbNailElem.click();
          return;
        }
        const newSrc = getSrc(store.tasksDataListOptions[nextIdx]);
        await updateCurrentVideoSrc(newSrc);
      } else {
        if (store.tasksDataListOptions[0].video === item._value) {
          const thumbNailElem = document.querySelector('[custom-id="' + 1 + '-thumbnail-element"]');
        if (thumbNailElem) {
          thumbNailElem.click();
          return;
        }
          const newSrc = getSrc(store.tasksDataListOptions[1]);
          await updateCurrentVideoSrc(newSrc);
        } else {
          const thumbNailElem = document.querySelector('[custom-id="' + 0 + '-thumbnail-element"]');
        if (thumbNailElem) {
          thumbNailElem.click();
          return;
        }
          const newSrc = getSrc(store.tasksDataListOptions[0]);
          await updateCurrentVideoSrc(newSrc);
        }
      }
    });

    /**
     * Explanation: For some reason when video is switched using short-cut keys, instead of clicking on the thumbnail
     * the progressed seek of the video always gets set to 1st frame. Even if we try to capture the video progress in 
     * the callback of short-cut key listener, the progress is always picked up as 1st frame. That's why added functionality to
     * programmatically emit the click event of thumbnail element and preserve the video progress.
     */
    hotkeys.addNamed('media:switch-to-prev', async () => {
      const length = store.tasksDataListOptions.length;
      if (length === 0) return;
      const currIdx = store.tasksDataListOptions.findIndex(itm => BASE_URL_VIDEO + (itm).video === item._value);
      if (currIdx > -1) {
        let prevIdx = currIdx;
        if ((currIdx) === 0) prevIdx = length - 1;
        else prevIdx = currIdx - 1;
        const thumbNailElem = document.querySelector('[custom-id="' + prevIdx + '-thumbnail-element"]');
        if (thumbNailElem) {
          thumbNailElem.click();
          return;
        }
        const newSrc = getSrc(store.tasksDataListOptions[prevIdx]);
        await updateCurrentVideoSrc(newSrc);
      } else {
        if (store.tasksDataListOptions[0].video === item._value) {
          const thumbNailElem = document.querySelector('[custom-id="' + (store.tasksDataListOptions.length - 1) + '-thumbnail-element"]');
          if (thumbNailElem) {
            thumbNailElem.click();
            return;
          }
          const newSrc = getSrc(store.tasksDataListOptions[store.tasksDataListOptions.length - 1]);
          await updateCurrentVideoSrc(newSrc);
        } else {
          const thumbNailElem = document.querySelector('[custom-id="' + 0 + '-thumbnail-element"]');
          if (thumbNailElem) {
            thumbNailElem.click();
            return;
          }
          const newSrc = getSrc(store.tasksDataListOptions[0]);
          await updateCurrentVideoSrc(newSrc);
        }
      }
    });

    return () => {
      if(hotkeys)
        hotkeys?.unbindAll?.();
    };
  }, []);

  const getVideoUpdatedConfig = (newSrc) => {
    const parser = new DOMParser();
  const xmlDoc = parser.parseFromString(store.config, 'application/xml');
  const viewNode = xmlDoc.childNodes[0];
  // Find the 'Video' node
  let VideoNode;
  let idx = -1;
  for (let i = 0; i < viewNode.childNodes.length; i++) {
    if (viewNode.childNodes[i].nodeName === 'Video') {
      VideoNode = viewNode.childNodes[i];
      idx = i;
      break;
    }
  }
};

onSnapshot(store.tasksDataListOptions, snap => {
  if (store.tasksDataListOptions.length) {
    setError('');
  } else {
    setError('');
    setTimeout(() => {
      setError(store.tasksDataListOptionsErrMsg);
    }, 10)
  }
});

useEffect(() => {
    if (store.tasksDataListOptionsErrMsg && store.tasksDataListOptionsErrMsg.trim() !== "") {
      setError(store.tasksDataListOptionsErrMsg);
    }
}, [store.tasksDataListOptionsErrMsg]);

useEffect(() => {
  if(videoSize) {
    const rootPercent = (18 * rootElemWidth) / 100;
    const calculatedWidth = rootPercent > 300 ? 300 : rootPercent < 200 ? 200 : rootPercent;
    // const calculatedWidth = rootPercent > 300 ? 300 : rootPercent;
    setThumbnailWidth(calculatedWidth);
  }
}, [videoSize, rootElemWidth])

useEffect(() => {
  setLoadingData(optionsLoading);
}, [optionsLoading])


  return (
    <ObjectTag item={item} style={{ height: '100%' }}>
      <Block name="video-segmentation">
      <div style={{
              margin: '0.45rem auto',
              height: '100%',
              position: 'relative',
              width: 'fit-content',
              transition: 'width 0.5s ease',
            }}
            id='thumbnails-elem'
          >
            {
              (error && error.trim() !== "") 
              && <ErrorMessage
                  key={`err-video-options-tasksDataListOptionsErrMsg`} 
                  error={store.tasksDataListOptionsErrMsg} 
                />
            }
            {
              loadingData ? 
              <Elem name="loading" id="video-thumbnails-loader">
                <Block name="spinner"/>
              </Elem>
              :
              <span
              style={{
                display: showThumbnails ? 'flex' : 'none',
                flexDirection: 'column',
                justifyContent: 'start',
                alignItems: 'center',
                height: '100%',
                position: 'relative',
                flexWrap: 'nowrap',
                transition: 'all 0.6s ease-in',
                maxHeight: `${ videoSize ? videoSize[1] : 220 }px`, //220,
                overflowY: 'auto',
              }}
            >
              {store.tasksDataListOptions?.map((tsk, idx) => (<span
                style={
                  {
                    margin: '0.25rem',
                    borderRadius: '10px',
                  }
                }
                key={idx}
                custom-id={`${idx}-thumbnail-element`}
                onClick={async () => {
                  const src = getSrc(tsk);
                  // const config = getVideoUpdatedConfig(src)
                  await updateCurrentVideoSrc(src);
                }}
              >
                <VideoThumbnailCanvas
                  ref={null}
                  src={getSrc(tsk)}
                  title={tsk?.title}
                  width={thumbnailWidth}
                  height={170}
                  muted={true}
                  zoom={0.5}
                  isCurrent={getSrc(tsk) === item._value}
                />
              </span>))}
            </span>
            }
            {/* <Button
              disabled={store.tasksDataListOptions.length === 0 || (store.tasksDataListOptionsErrMsg && tasksDataListOptionsErrMsg.trim() !== "")}
              style={
                {
                  position: 'absolute',
                  top: '0.02rem',
                  right: '0.025rem',
                }
              }
              onClick={toggleThumbnails}
            >{
            store.tasksDataListOptions.length === 0 ? 'No video options to show'
            :
            showThumbnails ? 'Hide' : 'Show video options'
            }</Button> */}
      </div>
      </Block>
    </ObjectTag>
  );
};

export { VideoThumbnails };
