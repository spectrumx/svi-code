import Table from 'react-bootstrap/Table';
import { Link } from 'react-router';

import { CaptureResponse } from '../apiClient/fileService';

// This page was added to view the capture table. This is not currently used. Instead the IntegratedTable.tsx is used
// retaining this page so that in case we want to have a separate table for captures we can use this

interface CaptureTableProps {
  datasets: CaptureResponse;
  //datasets: CombinedResponse;
}

const CaptureTable = ({ datasets }: CaptureTableProps) => {
  return (
    <Table striped bordered hover>
      <thead>
        <tr>
          <th>Name</th>
          <th>Timestamp</th>
          <th>Frequency</th>
          <th>Location</th>
          <th>File Path</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        {datasets.map((dataset) => (
          <tr key="key">
            <td className="align-middle">{dataset.name}</td>
            <td className="align-middle">{dataset.timestamp}</td>
            <td className="align-middle">{dataset.frequency}</td>
            <td className="align-middle">{dataset.location}</td>
            <td className="align-middle">{dataset.file_path}</td>
            
            
            <td className="align-middle text-center">
            <Link
                to={`/viewCapture/${dataset.name}`}
                className="btn btn-primary btn-sm px-4"
              >
                View Details
              </Link>
            </td>
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default CaptureTable;
