import { useEffect, useState } from 'react';
import Button from '../components/Button';

import DatasetTable from '../components/DatasetTable';
import FileUploadModal from '../components/FileUploadModal';
import { useAppContext } from '../utils/AppContext';
import { useSyncCaptures } from '../apiClient/fileService';

const WorkspacePage = () => {
  const context = useAppContext();
  const { captures } = context;
  const syncCaptures = useSyncCaptures();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    syncCaptures();
  }, [syncCaptures]);

  return (
    <>
      <h5>Captures</h5>
      <DatasetTable datasets={captures} type="sigmf" />
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!context?.username}
        disabledHelpText="You must be logged in to upload a capture"
      >
        Upload Capture
      </Button>
      <FileUploadModal
        show={showModal}
        handleClose={() => setShowModal(false)}
        handleSuccess={syncCaptures}
      />
    </>
  );
};

export default WorkspacePage;
