import { useEffect, useState } from 'react';
import Button from '../components/Button';

import DatasetTable from '../components/DatasetTable';
import FileUploadModal from '../components/FileUploadModal';
import { getDatasets, SigMFFilePairResponse } from '../apiClient/fileService';
import { useAppContext } from '../utils/AppContext';

const WorkspacePage = () => {
  const context = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [datasets, setDatasets] = useState<SigMFFilePairResponse>([]);

  const syncDatasets = async () => {
    setDatasets(await getDatasets());
  };

  useEffect(() => {
    syncDatasets();
  }, []);

  return (
    <>
      <h5>Captures</h5>
      <DatasetTable datasets={datasets} />
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
        handleSuccess={syncDatasets}
      />
    </>
  );
};

export default WorkspacePage;
