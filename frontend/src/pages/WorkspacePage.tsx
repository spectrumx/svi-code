import { useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';

import DatasetTable from '../components/DatasetTable';
import FileUploadModal from '../components/FileUploadModal';
import { getDatasets, SigMFFilePairResponse } from '../apiClient/fileService';

const WorkspacePage = () => {
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
      <Button variant="primary" onClick={() => setShowModal(true)}>
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
