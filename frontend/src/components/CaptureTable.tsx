import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  flexRender,
  createColumnHelper,
  ColumnDef,
  getSortedRowModel,
  getPaginationRowModel,
  Table as TableInstance,
} from '@tanstack/react-table';
import Table from 'react-bootstrap/Table';
import { Link } from 'react-router';
import {
  Button,
  ButtonGroup,
  Tooltip,
  OverlayTrigger,
  Dropdown,
} from 'react-bootstrap';

import {
  Capture,
  CAPTURE_TYPE_INFO,
  // CAPTURE_SOURCES,
} from '../apiClient/captureService';
import { formatHertz, sortByDate } from '../utils/utils';

// Style object for table cells that might contain long text
const textCellStyle = {
  maxWidth: '200px',
};

interface PaginationControlsProps {
  table: TableInstance<any>;
  position: 'top' | 'bottom';
}

const PaginationControls = ({ table, position }: PaginationControlsProps) => {
  const isTop = position === 'top';

  return (
    <div
      className="capture-table-infobox-height"
      style={{
        padding: isTop ? '0.25rem 1rem' : '1rem',
        display: 'flex',
        justifyContent: isTop ? 'flex-end' : 'center',
        alignItems: 'center',
      }}
    >
      <div className="d-flex align-items-center gap-1">
        <span className="text-muted" style={{ fontSize: '0.9rem' }}>
          Page {table.getState().pagination.pageIndex + 1} of{' '}
          {table.getPageCount()}
        </span>
      </div>
      <ButtonGroup size="sm" className="ms-2">
        <Button
          variant="outline-secondary"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
          aria-label="Previous page"
          className="py-0"
        >
          <i className="bi bi-chevron-left" aria-hidden="true" />
        </Button>
        <Button
          variant="outline-secondary"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
          aria-label="Next page"
          className="py-0"
        >
          <i className="bi bi-chevron-right" aria-hidden="true" />
        </Button>
      </ButtonGroup>
    </div>
  );
};

interface ColumnVisibilityMenuProps {
  table: TableInstance<any>;
}

const ColumnVisibilityMenu = ({ table }: ColumnVisibilityMenuProps) => {
  return (
    <Dropdown
      className="capture-table-infobox-height"
      style={{ display: 'flex', alignItems: 'center' }}
    >
      <Dropdown.Toggle
        variant="outline-secondary"
        size="sm"
        className="py-0"
        aria-label="Column visibility"
      >
        <i className="bi bi-gear" aria-hidden="true" />
      </Dropdown.Toggle>
      <Dropdown.Menu>
        {table.getAllLeafColumns().map((column) => {
          if (!column.getCanHide()) {
            return null;
          }
          return (
            <Dropdown.Item
              key={column.id}
              as="div"
              onClick={(e) => {
                e.stopPropagation();
              }}
              className="py-0"
            >
              <div className="form-check" onClick={(e) => e.stopPropagation()}>
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={column.getIsVisible()}
                  onChange={(e) => {
                    e.stopPropagation();
                    column.getToggleVisibilityHandler()(e);
                  }}
                  id={`column-${column.id}`}
                />
                <label
                  className="form-check-label"
                  htmlFor={`column-${column.id}`}
                  style={{ width: '100%' }}
                >
                  {typeof column.columnDef.header === 'string'
                    ? column.columnDef.header
                    : column.columnDef.id}
                </label>
              </div>
            </Dropdown.Item>
          );
        })}
      </Dropdown.Menu>
    </Dropdown>
  );
};

export interface CaptureTableProps {
  captures: Capture[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  totalCaptures?: number;
  numHiddenCaptures?: number;
  pageSize?: number;
}

/**
 * Displays a table of captures with optional selection functionality and sorting
 */
export const CaptureTable = ({
  captures,
  selectedId,
  onSelect,
  totalCaptures,
  numHiddenCaptures,
  pageSize = 10,
}: CaptureTableProps) => {
  const [pagination, setPagination] = useState({
    pageIndex: 0,
    pageSize,
  });

  const [columnVisibility, setColumnVisibility] = useState<
    Record<string, boolean>
  >({
    created_at: false,
    source: false,
  });

  const columnHelper = createColumnHelper<Capture>();

  const columns = useMemo<ColumnDef<Capture, any>[]>(() => {
    const baseColumns: ColumnDef<Capture, any>[] = [
      // columnHelper.accessor('source', {
      //   header: 'Source',
      //   cell: (info) =>
      //     CAPTURE_SOURCES[info.getValue() as keyof typeof CAPTURE_SOURCES].name,
      //   size: 120,
      // }),
      columnHelper.accessor('uuid', {
        header: 'ID',
        size: 80,
        cell: (info) => <div style={textCellStyle}>{info.getValue()}</div>,
      }),
      columnHelper.accessor('name', {
        id: 'Name',
        header: () => (
          <div className="d-flex align-items-center gap-1">
            Name
            <OverlayTrigger
              placement="right"
              overlay={
                <Tooltip id="name-header-tooltip">
                  For SDS captures, this column shows the scan group ID or
                  channel name
                </Tooltip>
              }
            >
              <i className="bi bi-info-circle text-muted" aria-hidden="true" />
            </OverlayTrigger>
          </div>
        ),
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
        sortingFn: (a, b) => -sortByDate(a, b, 'original.timestamp'),
        size: 200,
      }),
      // columnHelper.accessor('created_at', {
      //   header: 'Created',
      //   cell: (info) =>
      //     info.getValue() ? new Date(info.getValue()).toLocaleString() : 'None',
      //   sortingFn: (a, b) => -sortByDate(a, b, 'original.created_at'),
      //   size: 200,
      // }),
      columnHelper.accessor('type', {
        header: 'Type',
        cell: (info) =>
          CAPTURE_TYPE_INFO[info.getValue() as keyof typeof CAPTURE_TYPE_INFO]
            .name,
        size: 120,
      }),
      columnHelper.accessor('files', {
        header: 'Files',
        cell: (info) => info.getValue().length,
        size: 80,
      }),
      columnHelper.accessor('min_freq', {
        header: 'Min Freq',
        cell: (info) =>
          info.getValue() ? formatHertz(info.getValue()) : 'Unknown',
        size: 120,
      }),
      columnHelper.accessor('max_freq', {
        header: 'Max Freq',
        cell: (info) =>
          info.getValue() ? formatHertz(info.getValue()) : 'Unknown',
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
              checked={row.original.uuid === selectedId}
              onChange={() => onSelect(row.original.uuid)}
              aria-label={`Select capture ${row.original.uuid}`}
              onClick={(e) => e.stopPropagation()}
            />
          ),
          size: 20,
          enableHiding: false,
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

            return (
              <OverlayTrigger
                placement="left"
                overlay={
                  <Tooltip id={`visualize-tooltip-${capture.uuid}`}>
                    Visualize capture
                  </Tooltip>
                }
              >
                <Link
                  to={`/visualization/new?captureId=${capture.uuid}`}
                  className="btn btn-primary p-1"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                  aria-label="Visualize capture"
                >
                  <i className="bi bi-graph-up" aria-hidden="true" />
                </Link>
              </OverlayTrigger>
            );
          },
          size: 60,
          enableHiding: false,
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
    getPaginationRowModel: getPaginationRowModel(),
    enableMultiRowSelection: false,
    state: {
      rowSelection: selectedId ? { [selectedId]: true } : {},
      pagination,
      columnVisibility,
    },
    onPaginationChange: setPagination,
    onColumnVisibilityChange: setColumnVisibility,
    pageCount: Math.ceil(captures.length / pageSize),
  });

  const hasMultiplePages = table.getPageCount() > 1;

  const handleRowClick = (capture: Capture) => {
    if (!onSelect) return;
    onSelect(capture.uuid);
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid #dee2e6',
        }}
      >
        <div
          className="capture-table-infobox-height"
          style={{
            padding: '0.25rem 1rem',
            fontSize: '0.9rem',
            color: '#6c757d',
          }}
          role="status"
          aria-live="polite"
        >
          <span>
            {totalCaptures !== undefined ? (
              <>
                Showing {table.getRowModel().rows.length} of {totalCaptures}{' '}
                captures
                {numHiddenCaptures
                  ? ` (${numHiddenCaptures} hidden by filters)`
                  : ''}
              </>
            ) : (
              `${captures.length} captures`
            )}
            {selectedId ? ' • 1 selected' : ''}
          </span>
        </div>
        <div className="d-flex align-items-center">
          {hasMultiplePages && (
            <PaginationControls table={table} position="top" />
          )}
          <ColumnVisibilityMenu table={table} />
        </div>
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
                      transition: 'background-color 0.2s ease',
                    }}
                    className={
                      header.column.getCanSort() ? 'sortable-header' : ''
                    }
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    <div className="d-flex align-items-center gap-1">
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                      {header.column.getCanSort() && (
                        <span className="ms-1">
                          {header.column.getIsSorted() === 'asc' ? (
                            <i className="bi bi-sort-up" aria-hidden="true" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <i className="bi bi-sort-down" aria-hidden="true" />
                          ) : (
                            <i
                              className="bi bi-sort text-muted"
                              aria-hidden="true"
                            />
                          )}
                        </span>
                      )}
                    </div>
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
                  key={row.original.uuid}
                  className={
                    row.original.uuid === selectedId ? 'table-primary' : ''
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
      {hasMultiplePages && (
        <PaginationControls table={table} position="bottom" />
      )}
    </div>
  );
};

export default CaptureTable;
