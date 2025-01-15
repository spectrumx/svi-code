import Table from 'react-bootstrap/Table';
import { Link } from 'react-router';

import { SigMFFilePair } from '../apiClient/fileService';

interface DatasetTableProps {
  datasets: SigMFFilePair[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
}

/**
 * Displays a table of SigMF datasets with optional selection functionality
 */
const DatasetTable = ({
  datasets,
  selectedId,
  onSelect,
}: DatasetTableProps) => {
  return (
    <Table striped bordered hover>
      <thead>
        <tr>
          {onSelect && (
            <th className="text-center" style={{ width: '50px' }}></th>
          )}
          <th>ID</th>
          <th>Data File</th>
          <th>Metadata File</th>
          {!onSelect && <th></th>}
        </tr>
      </thead>
      <tbody>
        {datasets.map((dataset) => (
          <tr
            key={dataset.id}
            className={selectedId === dataset.id ? 'table-primary' : ''}
            onClick={() => onSelect?.(dataset.id)}
            style={onSelect ? { cursor: 'pointer' } : undefined}
            role={onSelect ? 'button' : undefined}
            tabIndex={onSelect ? 0 : undefined}
            onKeyPress={(e) => {
              if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                onSelect(dataset.id);
              }
            }}
          >
            {onSelect && (
              <td className="text-center align-middle">
                <input
                  type="radio"
                  checked={selectedId === dataset.id}
                  onChange={() => onSelect(dataset.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Select dataset ${dataset.id}`}
                />
              </td>
            )}
            <td className="align-middle">{dataset.id}</td>
            <td className="align-middle">{dataset.data_file_name}</td>
            <td className="align-middle">{dataset.meta_file_name}</td>
            {!onSelect && (
              <td className="align-middle text-center">
                <Link
                  to={`/visualize/${dataset.id}`}
                  className="btn btn-primary btn-sm px-4"
                >
                  Visualize
                </Link>
              </td>
            )}
          </tr>
        ))}
      </tbody>
    </Table>
  );
};

export default DatasetTable;
