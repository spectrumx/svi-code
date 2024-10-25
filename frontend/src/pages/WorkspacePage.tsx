import { useEffect, useState } from 'react';

const api_host = 'http://localhost:8000';

type SigMFFilePairResponse = {
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
    <div>
      <div>Select a Dataset to Visualize</div>
      <ul>
        {datasets.map((dataset) => (
          <li key={dataset.id}>
            {dataset.data_file}/{dataset.meta_file}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default WorkspacePage;
