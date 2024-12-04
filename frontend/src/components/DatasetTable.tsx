import Table from 'react-bootstrap/Table';
import { Link } from 'react-router';

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
          <th></th>
        </tr>
      </thead>
      <tbody>
        {datasets.map((dataset) => (
          <tr key={dataset.id}>
            <td>{dataset.id}</td>
            <td>{dataset.data_file_name}</td>
            <td>{dataset.meta_file_name}</td>
            <td>
              <Link to={`/visualize/${dataset.id}`} className="btn btn-primary">
                Visualize
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default DatasetTable;
