import Table from 'react-bootstrap/Table';
import { Link } from 'react-router';

import { SigMFFilePair, FileMetadata } from '../apiClient/fileService';

interface DatasetTableProps {
  datasets: (SigMFFilePair | FileMetadata)[];
  selectedId?: number | null;
  onSelect?: (id: number) => void;
  type: 'sigmf' | 'file';
}

/**
 * Displays a table of datasets with optional selection functionality
 */
const DatasetTable = ({
  datasets,
  selectedId,
  onSelect,
  type,
}: DatasetTableProps) => {
  const isSigMF = type === 'sigmf';

  return (
    <Table striped bordered hover>
      <thead>
        <tr>
          {onSelect && (
            <th className="text-center" style={{ width: '50px' }}></th>
          )}
          <th>ID</th>
          {isSigMF ? (
            <>
              <th>Data File</th>
              <th>Metadata File</th>
            </>
          ) : (
            <>
              <th>Name</th>
              <th>Created</th>
            </>
          )}
          {!onSelect && <th></th>}
        </tr>
      </thead>
      <tbody>
        {datasets.map((dataset) => {
          const sigmfDataset = isSigMF ? (dataset as SigMFFilePair) : null;
          const fileDataset = !isSigMF ? (dataset as FileMetadata) : null;
          const visualizationType = isSigMF ? 'spectrogram' : 'waterfall';

          return (
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
              {isSigMF ? (
                <>
                  <td className="align-middle">
                    {sigmfDataset?.data_file_name}
                  </td>
                  <td className="align-middle">
                    {sigmfDataset?.meta_file_name}
                  </td>
                </>
              ) : (
                <>
                  <td className="align-middle">{fileDataset?.name}</td>
                  <td className="align-middle">
                    {new Date(
                      fileDataset?.created_at || '',
                    ).toLocaleDateString()}
                  </td>
                </>
              )}
              {!onSelect && (
                <td className="align-middle text-center">
                  <Link
                    to={`/visualization/${visualizationType}/${dataset.id}`}
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

export default DatasetTable;
