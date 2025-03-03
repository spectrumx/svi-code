import { useEffect, useState } from 'react';
import Button from '../components/Button';

import FileUploadModal from '../components/FileUploadModal';
import { useAppContext } from '../utils/AppContext';
import { useSyncCaptures } from '../apiClient/fileService';
import DatasetTable from '../components/CaptureTable';

const MyDataPage = () => {
  const context = useAppContext();
  const { captures, username } = context;
  const syncCaptures = useSyncCaptures();
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (username) {
      setIsLoading(true);
      syncCaptures().finally(() => setIsLoading(false));
    }
  }, [syncCaptures, username]);

  return (
    <div className="page-container">
      <h5>Captures</h5>
      <br />
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!context?.username}
        disabledHelpText="You must be logged in to upload a capture"
      >
        Upload New Capture
      </Button>
      <div style={{ marginTop: '20px' }}>
        {captures.length > 0 ? (
          <DatasetTable captures={captures} />
        ) : isLoading ? (
          <div>
            <p>Loading...</p>
          </div>
        ) : username ? (
          <div>
            <p>No captures found. Upload a capture to get started!</p>
          </div>
        ) : (
          <div>
            <p>You must be logged in to view data.</p>
          </div>
        )}
      </div>
      <FileUploadModal
        show={showModal}
        handleClose={() => setShowModal(false)}
        handleSuccess={syncCaptures}
      />
    </div>
  );
};

export default MyDataPage;
