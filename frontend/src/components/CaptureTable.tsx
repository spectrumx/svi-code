import Table from 'react-bootstrap/Table';
import { Link } from 'react-router';

import {
  Capture,
  CAPTURE_TYPES,
  CAPTURE_SOURCES,
} from '../apiClient/fileService';
import { VISUALIZATION_TYPES } from '../pages/NewVisualizationPage';

interface CaptureTableProps {
  captures: Capture[];
  selectedIds?: number[] | null;
  onSelect?: (ids: number[]) => void;
  selectionMode?: 'single' | 'multiple';
}

/**
 * Displays a table of captures with optional selection functionality
 * Supports both single and multiple selection modes
 */
const CaptureTable = ({
  captures,
  selectedIds = [],
  onSelect,
  selectionMode = 'single',
}: CaptureTableProps) => {
  // Helper function to handle selection
  const handleSelect = (id: number) => {
    if (!onSelect) return;

    if (selectionMode === 'single') {
      onSelect([id]);
    } else {
      const newSelectedIds = selectedIds?.includes(id)
        ? selectedIds.filter((selectedId) => selectedId !== id)
        : [...(selectedIds || []), id];
      onSelect(newSelectedIds);
    }
  };

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
          const captureIdParam =
            visualizationType?.name === 'waterfall' ? '' : String(capture.id);

          const isSelected = selectedIds?.includes(capture.id);

          return (
            <tr
              key={capture.id}
              className={isSelected ? 'table-primary' : ''}
              onClick={() => onSelect && handleSelect(capture.id)}
              style={onSelect ? { cursor: 'pointer' } : undefined}
              role={onSelect ? 'button' : undefined}
              tabIndex={onSelect ? 0 : undefined}
              onKeyPress={(e) => {
                if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                  handleSelect(capture.id);
                }
              }}
            >
              {onSelect && (
                <td className="text-center align-middle">
                  <input
                    type={selectionMode === 'multiple' ? 'checkbox' : 'radio'}
                    checked={isSelected}
                    onChange={() => handleSelect(capture.id)}
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
              <td className="align-middle">
                {CAPTURE_TYPES[capture.type].name}
              </td>
              <td className="align-middle">{capture.files.length}</td>
              <td className="align-middle">
                {CAPTURE_SOURCES[capture.source].name}
              </td>
              {!onSelect && visualizationType ? (
                <td className="align-middle text-center">
                  <Link
                    to={`/visualization/${visualizationType.name}/${captureIdParam}`}
                    className="btn btn-primary btn-sm px-4"
                  >
                    Visualize
                  </Link>
                </td>
              ) : !onSelect ? (
                <td></td>
              ) : null}
            </tr>
          );
        })}
      </tbody>
    </Table>
  );
};

export default CaptureTable;
