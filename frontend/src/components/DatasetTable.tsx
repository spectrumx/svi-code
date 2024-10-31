import Table from 'react-bootstrap/Table';

import { SigMFFilePairResponse } from '../apiClient/fileService';

interface DatasetTableProps {
  datasets: SigMFFilePairResponse;
}

const DatasetTable = ({ datasets }: DatasetTableProps) => {
  return (
    <Table striped bordered hover>
      <thead>
        <tr>
          <th>ID</th>
          <th>Data File</th>
          <th>Meta File</th>
        </tr>
      </thead>
      <tbody>
        {datasets.map((dataset) => (
          <tr key={dataset.id}>
            <td>{dataset.id}</td>
            <td>{dataset.data_file}</td>
            <td>{dataset.meta_file}</td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default DatasetTable;
