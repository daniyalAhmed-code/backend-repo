/**
* Libraries
*/
import React, { Component, useEffect, useState } from 'react';
import { Result, Spin } from 'antd';
import { getEnv, getRoot } from 'mobx-state-tree';
import { observer, Provider } from 'mobx-react';

/**
 * Core
*/
import Tree from '../../core/Tree';
import { TreeValidation } from '../TreeValidation/TreeValidation';

/**
 * Tags
 */
import '../../tags/object';
import '../../tags/control';
import '../../tags/visual';

/**
 * Utils and common components
 */
import { Space } from '../../common/Space/Space';
import { Button } from '../../common/Button/Button';
import { Block, Elem } from '../../utils/bem';
import { FF_DEV_1170, FF_DEV_3873, FF_LSDV_4620_3_ML, FF_SIMPLE_INIT, isFF } from '../../utils/feature-flags';
import { sanitizeHtml } from '../../utils/html';
import { reactCleaner } from '../../utils/reactCleaner';
import { guidGenerator } from '../../utils/unique';
import { isDefined, sortAnnotations } from '../../utils/utilities';

/**
 * Components
 */
import { Annotation } from './Annotation';
import { AnnotationTab } from '../AnnotationTab/AnnotationTab';
import { DynamicPreannotationsControl } from '../AnnotationTab/DynamicPreannotationsControl';
import { BottomBar } from '../BottomBar/BottomBar';
import Debug from '../Debug';
import Grid from './Grid';
import { InstructionsModal } from '../InstructionsModal/InstructionsModal';
import { RelationsOverlay } from '../RelationsOverlay/RelationsOverlay';
import Segment from '../Segment/Segment';
import Settings from '../Settings/Settings';
import { SidebarTabs } from '../SidebarTabs/SidebarTabs';
import { SidePanels } from '../SidePanels/SidePanels';
import { SideTabsPanels } from '../SidePanels/TabPanels/SideTabsPanels';
import { TopBar } from '../TopBar/TopBar';
import { onSnapshot } from "mobx-state-tree"

/**
 * Styles
 */
import './App.styl';
import { observable } from 'mobx';
// import { observable } from 'mobx';

import { isAllowed } from "./../../../../../RBAC";

/**
 * App
 */
class App extends Component {

  constructor(props) {
    super(props);
    this.state = {
      adminsLoading: true,
    };
  }


  relationsRef = React.createRef();

  componentDidMount() {
    this.unsubscribe = onSnapshot(this.props.store.adminsListLoading, sna => {
      this.setState({ adminsLoading: sna.flag });
    });

    window.blur();
    document.body.focus();
  }

  componentWillUnmount() {
    // Clean up the snapshot listener
    if (this.unsubscribe) {
      this.unsubscribe();
    }
  }

  // componentDidUpdate(prevProps){
  //   console.log("current store", this.props.store, {...this.props.store}, Object.keys(this.props.store))
  //   console.log("prevProps store", prevProps.store, {...prevProps.store}, Object.keys(prevProps.store))
  //   // this.render();
  //   const store = this.props.store;
  //   const as = store.annotationStore;
  //   const root = as.selected && as.selected.root;
  //   const somView = <Annotation root={root} annotation={as.selected} />
  // }

  // shouldComponentUpdate(nextProps, nextState){
  //   console.log("-----------------------------------------------------------------------------------")
  //   console.log("current store", this.props.store, {...this.props.store}, Object.keys(this.props.store))
  //   console.log("nextProps store", nextProps.store, {...nextProps.store}, Object.keys(nextProps.store))
  //   console.log("App Component ShouldUpdate")
  //   console.log("-----------------------------------------------------------------------------------")
  //   return true
  // }

  renderSuccess() {
    return <Block name="editor"><Result status="success" title={getEnv(this.props.store).messages.DONE} /></Block>;
  }

  renderNoAnnotation() {
    return <Block name="editor"><Result status="success" title={getEnv(this.props.store).messages.NO_COMP_LEFT} /></Block>;
  }

  renderNothingToLabel(store) {
    return (
      <Block
        name="editor"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexDirection: 'column',
          paddingBottom: '30vh',
        }}
      >
        <Result status="success" title={getEnv(this.props.store).messages.NO_NEXT_TASK} />
        <Block name="sub__result">You have completed all tasks in the queue!</Block>
        <Button onClick={e => store.prevTask(e, true)} look="outlined" style={{ margin: '16px 0' }}>
          Go to Previous Task
        </Button>
      </Block>
    );
  }



  renderNoAccess() {
    return <Block name="editor"><Result status="warning" title={getEnv(this.props.store).messages.NO_ACCESS} /></Block>;
  }

  renderConfigValidationException(store) {
    return (
      <Block name="main-view">
        <Elem name="annotation">
          <TreeValidation errors={this.props.store.annotationStore.validation} />
        </Elem>
        {!isFF(FF_DEV_3873) && store.hasInterface('infobar') && (
          <Elem name="infobar">
            Task #{store.task.id}
          </Elem>
        )}
      </Block>
    );
  }

  renderLoader() {
    return <Result icon={<Spin size="large" />} />;
  }

  _renderAll(obj) {
    if (obj.length === 1) return <Segment annotation={obj[0]}>{[Tree.renderItem(obj[0].root)]}</Segment>;

    return (
      <div className="ls-renderall">
        {obj.map((c, i) => (
          <div key={`all-${i}`} className="ls-fade">
            <Segment id={`segment-for-${i}`} annotation={c}>{[Tree.renderItem(c.root)]}</Segment>
          </div>
        ))}
      </div>
    );
  }

  _renderUI(root, as, store) {
    if (as.viewingAll) return this.renderAllAnnotations();
    return (
      <Block
        id="main-view-block"
        key={(as.selectedHistory ?? as.selected)?.id}
        name="main-view"
        onScrollCapture={this._notifyScroll}
      >
        <Elem id="annotations-element" name="annotation">
          {<Annotation root={root} annotation={as.selected} store={store} />}
          {this.renderRelations(as.selected)}
        </Elem>
        {(!isFF(FF_DEV_3873)) && getRoot(as).hasInterface('infobar') && this._renderInfobar(as)}
        {as.selected.hasSuggestionsSupport && (
          <DynamicPreannotationsControl />
        )}
      </Block>
    );
  }

  _renderInfobar(as) {
    const { id, queue } = getRoot(as).task;

    return (
      <Elem id="info-bar-elem" name="infobar" tag={Space} size="small">
        <span>Task #{id}</span>

        {queue && <span>{queue}</span>}
      </Elem>
    );
  }

  renderAllAnnotations() {
    const as = this.props.store.annotationStore;
    const entities = [...as.annotations, ...as.predictions];

    if (isFF(FF_SIMPLE_INIT)) {
      // the same sorting we have in AnnotationsCarousel, so we'll see the same order in both places
      sortAnnotations(entities);
    }

    return <Grid id="all-annotations-grid" store={as} annotations={entities} root={as.root} />;
  }

  renderRelations(selectedStore) {
    const store = selectedStore.relationStore;
    const taskData = this.props.store.task?.data;

    return (
      <RelationsOverlay
        key={guidGenerator()}
        store={store}
        ref={this.relationsRef}
        tags={selectedStore.names}
        taskData={taskData}
      />
    );
  }

  render() {
    const { store } = this.props;
    const asOb = observable.box(store)?.get(store);
    const as = store.annotationStore;
    const root = as.selected && as.selected.root;
    const { settings } = store;

    // const [adminsLoading, setAdminsLoading] = useState(true);

    // onSnapshot(store.adminsListLoading, sna => {
    //   setAdminsLoading(sna.flag);
    // });

    // useEffect(() => {
    // }, [adminsLoading]);

    // console.log("asOb", asOb)
    // console.log("asOb", {...asOb})
    // console.log("as", as)
    // console.log("as", {...as})
    // console.log("as", Object.keys(as))
    // console.log("store", {...store})
    // console.log("store", Object.keys(store))
    // console.log("selected", as.selected)
    // console.log("root", as.root)
    
    // if (store.isLoading || adminsLoading) return this.renderLoader();
    if (store.isLoading) return this.renderLoader();

    if (store.noTask) return this.renderNothingToLabel(store);

    if (store.noAccess) return this.renderNoAccess();

    if (store.labeledSuccess) return this.renderSuccess();

    if (!root) return this.renderNoAnnotation();

    const viewingAll = as.viewingAll;

    // tags can be styled in config when user is awaiting for suggestions from ML backend
    const mainContent = (
      <Block id="main-content-block" name="main-content" mix={store.awaitingSuggestions ? ['requesting'] : []}>
        {as.validation === null
          ? this._renderUI(as.selectedHistory?.root ?? root, as, store)
          : this.renderConfigValidationException(store)}
      </Block>
    );
    const isAdmin = isAllowed(store.user?.email, store.adminsList);

    const shouldBeDisabled = !store.hasAdminAccess && !(store.user?.email === as.selected.user?.email);//isAdmin ? false : !(as.selected?.user?.email === store.user?.email);

    const outlinerEnabled = isFF(FF_DEV_1170);
    const newUIEnabled = isFF(FF_DEV_3873);

    return (
      <Block
        name="editor"
        mod={{ fullscreen: settings.fullscreen, _auto_height: !outlinerEnabled }}
        ref={isFF(FF_LSDV_4620_3_ML) ? reactCleaner(this) : null}
      >
        <Settings store={store} />
        <Provider store={store}>
          {newUIEnabled ? (
            <InstructionsModal
              visible={store.showingDescription}
              onCancel={() => store.toggleDescription()}
              title="Labeling Instructions"
            >
              {store.description}
            </InstructionsModal>
          ) : (
            <>
              {store.showingDescription && (
                <Segment>
                  <div dangerouslySetInnerHTML={{ __html: sanitizeHtml(store.description) }} />
                </Segment>
              )}
            </>
          )}

          {isDefined(store) && store.hasInterface('topbar') && <TopBar store={store} />}
          <Block
            name="wrapper"
            mod={{
              viewAll: viewingAll,
              bsp: settings.bottomSidePanel,
              outliner: outlinerEnabled,
              showingBottomBar: newUIEnabled,
            }}
            style={
              {
                position: 'relative',
              }
            }
          >
            { shouldBeDisabled && <div style={{ position: 'absolute', color: 'red', top: 0, bottom: 0, right: 0, left: 0, backgroundColor: '#BFBFBF', zIndex: 999, opacity: '0.325', display: 'flex', justifyContent: 'center', alignItems: 'center', fontWeight: 'bold', fontSize: '1.45rem' }}>
                You currently don't have access to edit this annotation.
              </div>}
            {outlinerEnabled ? (
              newUIEnabled ? (
                <SideTabsPanels
                  panelsHidden={viewingAll}
                  currentEntity={as.selectedHistory ?? as.selected}
                  regions={as.selected.regionStore}
                  showComments={store.hasInterface('annotations:comments')}
                  focusTab={store.commentStore.tooltipMessage ? 'comments' : null}
                >
                  <div id="main-content-pane"></div>
                  {mainContent}
                  <div id="bottom-bar-content-pane"></div>
                  {store.hasInterface('topbar') && <BottomBar store={store} />}
                </SideTabsPanels>
              ) : (
                <SidePanels
                  panelsHidden={viewingAll}
                  currentEntity={as.selectedHistory ?? as.selected}
                  regions={as.selected.regionStore}
                >
                  {mainContent}
                </SidePanels>
              )
            ) : (
              <>
                {mainContent}

                {viewingAll === false && (
                  <Block name="menu" mod={{ bsp: settings.bottomSidePanel }}>
                    {store.hasInterface('side-column') && (
                      <SidebarTabs>
                        <AnnotationTab store={store} />
                      </SidebarTabs>
                    )}
                  </Block>
                )}

                {newUIEnabled && store.hasInterface('topbar') && <BottomBar store={store} />}
              </>
            )}
          </Block>
        </Provider>
        {store.hasInterface('debug') && <Debug store={store} />}
      </Block>
    );
  }

  _notifyScroll = () => {
    if (this.relationsRef.current) {
      this.relationsRef.current.onResize();
    }
  };
}

export default observer(App);
