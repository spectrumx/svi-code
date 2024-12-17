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
          <th>Metadata File</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {datasets.map((dataset) => (
          <tr key={dataset.id}>
            <td className="align-middle">{dataset.id}</td>
            <td className="align-middle">{dataset.data_file_name}</td>
            <td className="align-middle">{dataset.meta_file_name}</td>
            <td className="align-middle text-center">
              <Link
                to={`/visualize/${dataset.id}`}
                className="btn btn-primary btn-sm px-4"
              >
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
