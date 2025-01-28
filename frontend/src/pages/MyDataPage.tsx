import { useEffect, useState } from 'react';
import Button from '../components/Button';

import FileUploadModal from '../components/FileUploadModal';
import { useAppContext } from '../utils/AppContext';
import {
  useSyncSigMFFilePairs,
  useSyncCaptures,
} from '../apiClient/fileService';
import DatasetTable from '../components/CaptureTable';

const MyDataPage = () => {
  const context = useAppContext();
  const { captures } = context;
  const syncSigMFFilePairs = useSyncSigMFFilePairs();
  const syncCaptures = useSyncCaptures();
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    syncCaptures();
  }, [syncCaptures]);

  return (
    <>
      <h5>Captures</h5>
      <DatasetTable captures={captures} />
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!context?.username}
        disabledHelpText="You must be logged in to upload a capture"
      >
        Upload SigMF File Pair
      </Button>
      <FileUploadModal
        show={showModal}
        handleClose={() => setShowModal(false)}
        handleSuccess={syncSigMFFilePairs}
      />
    </>
  );
};

export default MyDataPage;
