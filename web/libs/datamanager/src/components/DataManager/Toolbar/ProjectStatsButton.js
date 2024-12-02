import { inject } from 'mobx-react';
import { LsRefresh, LsRefresh2 } from '../../../assets/icons';
import { FF_LOPS_E_10, isFF } from '../../../utils/feature-flags';
import { Button } from '../../Common/Button/Button';
import { useEffect, useState } from 'react';
import { Alert, Card, Modal, Skeleton, Space } from 'antd';

const isNewUI = isFF(FF_LOPS_E_10);

const statEntryStyles = {
  fontSize: '14px',
  fontWeight: '500',
  width: '70%',
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginInline: 'auto',
  color: 'rgb(149, 130, 130)',
  backgroundColor: 'rgba(219, 219, 219, 0.24)',
  padding: '10px 8px'
};
const statEntryValueStyles = {fontWeight: '600', color: 'black'};

const injector = inject(({ store }) => {
  return {
    store,
    needsDataFetch: store.needsDataFetch,
    projectFetch: store.projectFetch,
  };
});

export const ProjectStatsButton = injector(
  ({ store, needsDataFetch, projectFetch, size, style, ...rest }) => {
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(true);
    const [shouldFetch, setShouldFetch] = useState(true);

    const [stats, setStats] = useState({});
    const [error, setError] = useState('');

    useEffect(() => {
      if(Object.keys(stats).length) {
        setShouldFetch(false);
      }
    }, [stats])

    const showModal = async (force=false) => {
      setOpen(true);
      setLoading(true);
      setError('');
      if(!force && !shouldFetch) {
        setTimeout(() => setLoading(false), 600);
        return;
      }
      try {
        await store.fetchProjectStats({ force: true });

        const newStats = JSON.parse(store.projectStats);

        if (Object.keys(newStats).length) {
          setStats(newStats);
        }
      } catch (err) {
        setError(err?.message ?? `${err}`);
      } finally {
        setLoading(false);
      }
    };

    return (
      <>
        <Button
          // size={size}
          // look={needsDataFetch && 'primary'}
          waiting={projectFetch}
          onClick={async () => {
            showModal();
            // await store.fetchProject({ force: true, interaction: 'refresh' });
            // await store.currentView?.reload();
          }}
          style={{
            ...(style ?? {}),
            // minWidth: 0,
            // padding: 0,
            // width: isNewUI ? 40 : 32,
            minWidth: 'fit-content',
          }}
          {...rest}
        >
          Project Stats
        </Button>
        <Modal
          title={<p>Project Stats Modal</p>}
          footer={
            <Button type="primary" onClick={() => {
              showModal(true);
            }}>
              Reload
            </Button>
          }
          open={open}
          onCancel={() => setOpen(false)}
          centered
          width={"60%"}
          bodyStyle={{
            maxHeight: '65vh',
            overflow: 'auto'
          }}
        >
          {loading ? (
            <Skeleton active />
          ) : (
            <div
              style={{
                width: '100%',
                height: 'auto',
                maxHeight: '95%',
                overflowY: 'auto',
                padding: '1rem'
              }}
            >
              {error && error.trim() !== '' && (
                <Alert
                  message="Error Occurred"
                  description={error}
                  type="error"
                  closable
                  onClose={() => setError('')}
                />
              )}
              <Space direction="vertical" size={'middle'} style={{ display: 'flex', alignItems: 'stretch' }}>
                <Card title="Over all Stats" size="small" >
                  <p style={statEntryStyles}>Total Tasks : <span style={statEntryValueStyles}>{stats.total_tasks ?? 'N/A'}</span></p>
                  <p style={statEntryStyles}>Processed Tasks : <span style={statEntryValueStyles}>{stats.total_processed_tasks ?? 'N/A'}</span></p>
                  <p style={statEntryStyles}>Un-Processed Tasks : <span style={statEntryValueStyles}>{stats.total_unprocessed_tasks ?? 'N/A'}</span></p>
                  <p style={statEntryStyles}>Attention Requiring Tasks : <span style={statEntryValueStyles}>{stats.attention_needing_tasks ?? 'N/A'}</span></p>
                  <p style={statEntryStyles}>Total Annotations : <span style={statEntryValueStyles}>{stats.total_annotations ?? 'N/A'}</span></p>
                </Card>
                {Object.keys(stats.athlete_wise_annotations).length && (
                  <>
                    <Card title="Athlete wise Annotations" size="small">
                      {Object.keys(stats.athlete_wise_annotations).map(
                        (rec) => (
                          <p key={rec} style={statEntryStyles}>
                            {rec} : <span style={statEntryValueStyles}>{stats.athlete_wise_annotations[rec]}</span>
                          </p>
                        )
                      )}
                    </Card>
                  </>
                )}
                {Object.keys(stats.labels_wise_annotations).length && (
                  <>
                    <Card title="Label wise Regions (Across all Annotations)" size="small">
                      {Object.keys(stats.labels_wise_annotations).map((rec) => (
                        <p key={rec} style={statEntryStyles}>
                          {rec} : <span style={statEntryValueStyles}>{stats.labels_wise_annotations[rec]}</span>
                        </p>
                      ))}
                    </Card>
                  </>
                )}
              </Space>
            </div>
          )}
        </Modal>
      </>
    );
  }
);
