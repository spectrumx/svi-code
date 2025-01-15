import Table from 'react-bootstrap/Table';
import { Link } from 'react-router';

import { IntegratedResponse } from '../apiClient/fileService';

// combined the SigMFFilePair table and newly created capture table 
interface IntegratedTableProps {
  datasets: IntegratedResponse;
  //datasets: CombinedResponse;
}


const IntegratedTable = ({ datasets }: IntegratedTableProps) => {
  return (
    <Table striped bordered hover>
      <thead>
        <tr>
          <th>Name</th>
          <th>Timestamp</th>
          <th>Frequency</th>
          <th>Location</th>
          <th>Source</th>
          <th>Format</th>
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
            <td className="align-middle">{dataset.source}</td>
            <td className="align-middle">{dataset.captureformat}</td>
            
            
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

export default IntegratedTable;
