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
    <div style={{ padding: 20 }}>
      <h5>Select a Dataset to Visualize</h5>
      <DatasetTable datasets={datasets} />
      <br />
      <h5>Add a New Dataset</h5>
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!context?.username}
        disabledHelpText="You must be logged in to upload a dataset"
      >
        Upload Dataset
      </Button>
      <FileUploadModal
        show={showModal}
        handleClose={() => setShowModal(false)}
        handleSuccess={syncDatasets}
      />
    </div>
  );
};

export default WorkspacePage;
