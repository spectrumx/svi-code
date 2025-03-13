import Table from 'react-bootstrap/Table';
import { Link } from 'react-router';

import {
  Capture,
  CAPTURE_TYPES,
  CAPTURE_SOURCES,
} from '../apiClient/fileService';
import { VISUALIZATION_TYPES } from '../pages/NewVisualizationPage';

export interface CaptureTableProps {
  captures: Capture[];
  selectedIds?: string[] | null;
  onSelect?: (ids: string[]) => void;
  selectionMode?: 'single' | 'multiple';
  totalCaptures?: number;
  numHiddenCaptures?: number;
}

// Add a style object for table cells that might contain long text
const textCellStyle = {
  maxWidth: '200px',
  wordBreak: 'break-word' as const,
  overflowWrap: 'break-word' as const,
};

/**
 * Displays a table of captures with optional selection functionality
 * Supports both single and multiple selection modes with "Select all" capability
 */

const CaptureTable = ({
  captures,
  selectedIds = [],
  onSelect,
  selectionMode = 'single',
  totalCaptures,
  numHiddenCaptures: hiddenCaptures,
}: CaptureTableProps) => {
  const handleSelect = (id: string) => {
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

  // Helper function to handle "Select All"
  const handleSelectAll = () => {
    if (!onSelect) return;

    const allSelected = captures.length === selectedIds?.length;
    if (allSelected) {
      onSelect([]);
    } else {
      onSelect(captures.map((capture) => capture.id));
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        marginTop: '-8px',
      }}
    >
      <div
        style={{
          // padding: '0.5rem 1rem',
          padding: '0 1rem',
          fontSize: '0.9rem',
          color: '#6c757d',
        }}
        role="status"
        aria-live="polite"
      >
        <span>
          {totalCaptures !== undefined ? (
            <>
              Showing {captures.length} of {totalCaptures} captures
              {hiddenCaptures ? ` (${hiddenCaptures} hidden by filters)` : ''}
            </>
          ) : (
            `${captures.length} captures`
          )}
          {selectedIds?.length ? ` • ${selectedIds.length} selected` : ''}
        </span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        <Table
          striped
          bordered
          hover
          responsive
          style={{ marginBottom: 0, marginTop: '2px' }}
        >
          <thead>
            <tr>
              {onSelect && captures.length > 0 && (
                <th className="text-center" style={{ width: '50px' }}>
                  {selectionMode === 'multiple' && (
                    <input
                      type="checkbox"
                      checked={
                        captures.length > 0 &&
                        captures.length === selectedIds?.length
                      }
                      ref={(input) => {
                        if (input) {
                          input.indeterminate =
                            selectedIds!.length > 0 &&
                            selectedIds!.length < captures.length;
                        }
                      }}
                      onChange={handleSelectAll}
                      aria-label="Select all captures"
                    />
                  )}
                </th>
              )}
              <th style={{ maxWidth: '80px' }}>ID</th>
              <th style={textCellStyle}>Name</th>
              <th style={{ maxWidth: '200px' }}>Timestamp</th>
              <th style={{ maxWidth: '120px' }}>Type</th>
              <th style={{ maxWidth: '80px' }}>Files</th>
              <th style={{ maxWidth: '120px' }}>Source</th>
              {!onSelect && captures.length > 0 && (
                <th style={{ maxWidth: '100px' }}></th>
              )}
            </tr>
          </thead>
          <tbody>
            {captures.length === 0 ? (
              <tr>
                <td
                  colSpan={onSelect ? 8 : 7}
                  style={{
                    padding: '2rem',
                    textAlign: 'center',
                    color: '#6c757d',
                  }}
                >
                  No captures found
                </td>
              </tr>
            ) : (
              captures.map((capture) => {
                const visualizationType = VISUALIZATION_TYPES.find((visType) =>
                  visType.supportedCaptureTypes.includes(capture.type),
                );

                const isSelected = selectedIds?.includes(capture.id);

                return (
                  <tr
                    key={capture.id}
                    className={isSelected ? 'table-primary' : ''}
                    onClick={() => onSelect?.([capture.id])}
                    style={onSelect ? { cursor: 'pointer' } : undefined}
                    role={onSelect ? 'button' : undefined}
                    tabIndex={onSelect ? 0 : undefined}
                    onKeyPress={(e) => {
                      if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                        onSelect([capture.id]);
                      }
                    }}
                  >
                    {onSelect && (
                      <td
                        className="text-center align-middle"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type={
                            selectionMode === 'multiple' ? 'checkbox' : 'radio'
                          }
                          checked={isSelected}
                          onChange={() => handleSelect(capture.id)}
                          aria-label={`Select capture ${capture.id}`}
                        />
                      </td>
                    )}
                    <td className="align-middle">{capture.id}</td>
                    <td className="align-middle" style={textCellStyle}>
                      {capture.name}
                    </td>
                    <td className="align-middle">
                      {capture.timestamp
                        ? new Date(capture.timestamp)
                            .toISOString()
                            .replace('Z', ' UTC')
                            .replace('T', ' ')
                        : 'None'}
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
                          to={`/visualization/${visualizationType.name}?captures=${capture.id}`} // corrected path to pass parameters correctly
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
              })
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

export default CaptureTable;
