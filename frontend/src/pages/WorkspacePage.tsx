import { useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';
import axios from 'axios';

import DatasetTable from '../components/DatasetTable';
import { api_host } from '../App';
import FileUploadModal from '../components/FileUploadModal';

export type SigMFFilePairResponse = {
  id: number;
  data_file: string;
  meta_file: string;
}[];

const WorkspacePage = () => {
  const [showModal, setShowModal] = useState(false);
  const [datasets, setDatasets] = useState<SigMFFilePairResponse>([]);

  const syncDatasets = async () => {
    const response = await axios.get(`${api_host}/api/sigmf-file-pairs/`);
    setDatasets(response.data as SigMFFilePairResponse);
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
