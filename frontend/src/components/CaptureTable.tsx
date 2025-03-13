import { useMemo } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  ColumnDef,
  getSortedRowModel,
} from '@tanstack/react-table';
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
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  totalCaptures?: number;
  numHiddenCaptures?: number;
}

// Style object for table cells that might contain long text
const textCellStyle = {
  maxWidth: '200px',
};

/**
 * Displays a table of captures with optional selection functionality and sorting
 */
export const CaptureTable = ({
  captures,
  selectedId,
  onSelect,
  totalCaptures,
  numHiddenCaptures,
}: CaptureTableProps) => {
  const columnHelper = createColumnHelper<Capture>();

  const columns = useMemo<ColumnDef<Capture, any>[]>(() => {
    const baseColumns: ColumnDef<Capture, any>[] = [
      columnHelper.accessor('id', {
        header: 'ID',
        size: 80,
      }),
      columnHelper.accessor('name', {
        header: 'Name',
        cell: (info) => <div style={textCellStyle}>{info.getValue()}</div>,
      }),
      columnHelper.accessor('timestamp', {
        header: 'Timestamp',
        cell: (info) =>
          info.getValue()
            ? new Date(info.getValue())
                .toISOString()
                .replace('Z', ' UTC')
                .replace('T', ' ')
            : 'None',
        size: 200,
      }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: (info) =>
          CAPTURE_TYPES[info.getValue() as keyof typeof CAPTURE_TYPES].name,
        size: 120,
      }),
      columnHelper.accessor('files', {
        header: 'Files',
        cell: (info) => info.getValue().length,
        size: 80,
      }),
      columnHelper.accessor('source', {
        header: 'Source',
        cell: (info) =>
          CAPTURE_SOURCES[info.getValue() as keyof typeof CAPTURE_SOURCES].name,
        size: 120,
      }),
    ];

    // Add selection column if needed
    if (onSelect) {
      baseColumns.unshift(
        columnHelper.display({
          id: 'select',
          header: '',
          cell: ({ row }) => (
            <input
              type="radio"
              checked={row.original.id === selectedId}
              onChange={() => onSelect(row.original.id)}
              aria-label={`Select capture ${row.original.id}`}
              onClick={(e) => e.stopPropagation()}
            />
          ),
          size: 20,
        }),
      );
    }

    // Add visualization column if needed
    if (!onSelect) {
      baseColumns.push(
        columnHelper.display({
          id: 'actions',
          cell: ({ row }) => {
            const capture = row.original;
            const visualizationType = VISUALIZATION_TYPES.find((visType) =>
              visType.supportedCaptureTypes.includes(capture.type),
            );

            if (!visualizationType) return null;

            const captureIdParam =
              visualizationType.name === 'waterfall'
                ? `?captures=${capture.id}`
                : visualizationType.name === 'spectrogram'
                  ? `/${capture.id}`
                  : '';

            return (
              <Link
                to={`/visualization/${visualizationType.name}${captureIdParam}`}
                className="btn btn-primary btn-sm px-4"
              >
                Visualize
              </Link>
            );
          },
          size: 100,
        }),
      );
    }

    return baseColumns;
  }, [columnHelper, onSelect, selectedId]);

  const table = useReactTable({
    data: captures,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    enableMultiRowSelection: false,
    state: {
      rowSelection: selectedId ? { [selectedId]: true } : {},
    },
  });

  const handleRowClick = (capture: Capture) => {
    if (!onSelect) return;
    onSelect(capture.id);
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
      }}
    >
      <div
        style={{
          padding: '0 1rem',
          fontSize: '0.9rem',
          color: '#6c757d',
          height: '25px',
        }}
        role="status"
        aria-live="polite"
      >
        <span>
          {totalCaptures !== undefined ? (
            <>
              Showing {captures.length} of {totalCaptures} captures
              {numHiddenCaptures
                ? ` (${numHiddenCaptures} hidden by filters)`
                : ''}
            </>
          ) : (
            `${captures.length} captures`
          )}
        </span>
      </div>

      <div style={{ overflowY: 'auto', flex: 1 }}>
        <Table striped bordered hover responsive style={{ marginBottom: 0 }}>
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    style={{
                      width: header.getSize(),
                      cursor: header.column.getCanSort()
                        ? 'pointer'
                        : undefined,
                    }}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
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
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className={
                    row.original.id === selectedId ? 'table-primary' : ''
                  }
                  onClick={() => handleRowClick(row.original)}
                  style={onSelect ? { cursor: 'pointer' } : undefined}
                  role={onSelect ? 'button' : undefined}
                  tabIndex={onSelect ? 0 : undefined}
                  onKeyPress={(e) => {
                    if (onSelect && (e.key === 'Enter' || e.key === ' ')) {
                      handleRowClick(row.original);
                    }
                  }}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="align-middle">
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext(),
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </Table>
      </div>
    </div>
  );
};

export default CaptureTable;
