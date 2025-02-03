import { useEffect, useState } from 'react';
import Button from '../components/Button';

import FileUploadModal from '../components/FileUploadModal';
import { useAppContext } from '../utils/AppContext';
import { useSyncCaptures } from '../apiClient/fileService';
import DatasetTable from '../components/CaptureTable';

const MyDataPage = () => {
  const context = useAppContext();
  const { captures } = context;
  const syncCaptures = useSyncCaptures();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    syncCaptures();
  }, [syncCaptures]);

  return (
    <div className="page-container">
      <h5>Captures</h5>
      {captures.length > 0 ? (
        <DatasetTable captures={captures} />
      ) : (
        <div>
          <p>No captures found. Upload a capture to get started!</p>
        </div>
      )}
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!context?.username}
        disabledHelpText="You must be logged in to upload a capture"
      >
        Upload New Capture
      </Button>
      <FileUploadModal
        show={showModal}
        handleClose={() => setShowModal(false)}
        handleSuccess={syncCaptures}
      />
    </div>
  );
};

export default MyDataPage;
