import Table from 'react-bootstrap/Table';
import { Link } from 'react-router';

import { Capture } from '../apiClient/fileService';
import { VISUALIZATION_TYPES } from '../pages/NewVisualizationPage';

interface CaptureTableProps {
  captures: Capture[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
}

/**
 * Displays a table of captures with optional selection functionality
 */
const CaptureTable = ({
  captures,
  selectedId,
  onSelect,
}: CaptureTableProps) => {
  return (
    <Table striped bordered hover>
      <thead>
        <tr>
          {onSelect && (
            <th className="text-center" style={{ width: '50px' }}></th>
          )}
          <th>ID</th>
          <th>Name</th>
          <th>Timestamp</th>
          <th>Type</th>
          <th>Files</th>
          <th>Source</th>
          {!onSelect && <th></th>}
        </tr>
      </thead>
      <tbody>
        {captures.map((capture) => {
          const visualizationType = VISUALIZATION_TYPES.find((visType) =>
            visType.supportedCaptureTypes.includes(capture.type),
          );
          // For now, we're just displaying all RadioHound captures in the
          // waterfall visualization
          const captureId =
            visualizationType?.name === 'waterfall' ? '' : capture.id;

          return (
            <tr
              key={capture.id}
              className={selectedId === capture.id ? 'table-primary' : ''}
              onClick={() => onSelect?.(capture.id)}
              style={onSelect ? { cursor: 'pointer' } : undefined}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onKeyPress={(e) => {
                if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                  onSelect(capture.id);
                }
              }}
            >
              {onSelect && (
                <td className="text-center align-middle">
                  <input
                    type="radio"
                    checked={selectedId === capture.id}
                    onChange={() => onSelect(capture.id)}
                    onClick={(e) => e.stopPropagation()}
                    aria-label={`Select capture ${capture.id}`}
                  />
                </td>
              )}
              <td className="align-middle">{capture.id}</td>
              <td className="align-middle">{capture.name}</td>
              <td className="align-middle">
                {new Date(capture.timestamp).toLocaleDateString()}
              </td>
              <td className="align-middle">{capture.type}</td>
              <td className="align-middle">{capture.files.length}</td>
              <td className="align-middle">{capture.source}</td>
              {!onSelect && visualizationType && (
                <td className="align-middle text-center">
                  <Link
                    to={`/visualization/${visualizationType.name}/${captureId}`}
                    className="btn btn-primary btn-sm px-4"
                  >
                    Visualize
                  </Link>
                </td>
              )}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
};

export default CaptureTable;
