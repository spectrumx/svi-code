import { useEffect, useState } from 'react';
import Button from 'react-bootstrap/Button';

import DatasetTable from '../components/DatasetTable';

const api_host = 'http://localhost:8000';

export type SigMFFilePairResponse = {
  id: number;
  data_file: string;
  meta_file: string;
}[];

const WorkspacePage = () => {
  const [datasets, setDatasets] = useState<SigMFFilePairResponse>([]);

  useEffect(() => {
    const fetchData = async () => {
      const response = await fetch(`${api_host}/api/sigmf-file-pairs/`);
      const data = (await response.json()) as SigMFFilePairResponse;
      setDatasets(data);
    };
    fetchData();
  }, []);

  return (
    <div style={{ padding: 20 }}>
      <h5>Select a Dataset to Visualize</h5>
      <DatasetTable datasets={datasets} />
      <br />
      <h5>Add a New Dataset</h5>
      <Button variant="primary">Upload Dataset</Button>
    </div>
  );
};

export default WorkspacePage;
