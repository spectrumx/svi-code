import { useEffect, useState, useMemo } from 'react';
import { Form } from 'react-bootstrap';
import _ from 'lodash';

import CaptureTable, { CaptureTableProps } from '../components/CaptureTable';
import {
  CAPTURE_TYPES,
  CAPTURE_SOURCES,
  Capture,
  CaptureType,
  CaptureSource,
} from '../apiClient/fileService';

interface CaptureSearchProps {
  captures: Capture[];
  selectedCaptureIds?: number[];
  setSelectedCaptureIds?: (ids: number[]) => void;
  tableProps?: Omit<CaptureTableProps, 'captures' | 'selectedIds' | 'onSelect'>;
  hideCaptureTypeFilter?: boolean;
}

/**
 * SearchPage component that displays a search interface for RF captures
 * with filtering capabilities for capture types and sources
 */
export const CaptureSearch = ({
  captures,
  selectedCaptureIds,
  setSelectedCaptureIds,
  tableProps,
  hideCaptureTypeFilter = false,
}: CaptureSearchProps) => {
  // State for search and filters
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedTypes, setSelectedTypes] = useState<Set<CaptureType>>(
    new Set(),
  );
  const [selectedSources, setSelectedSources] = useState<Set<CaptureSource>>(
    new Set(),
  );

  // Update state to use string type since datetime-local works with ISO strings
  const [startDatetime, setStartDatetime] = useState<string>('');
  const [endDatetime, setEndDatetime] = useState<string>('');

  // Initialize datetime range when captures load
  useEffect(() => {
    if (captures.length > 0) {
      // Find min and max timestamps
      const timestamps = captures.map((capture) =>
        new Date(capture.timestamp).getTime(),
      );
      const minTimestamp = new Date(Math.min(...timestamps));
      const maxTimestamp = new Date(Math.max(...timestamps));

      setStartDatetime(minTimestamp.toISOString());
      setEndDatetime(maxTimestamp.toISOString());
    }
  }, [captures]);

  // Filter captures based on search query and selected filters
  const filteredCaptures = useMemo(() => {
    return captures.filter((capture) => {
      // Check if capture matches search query
      const matchesSearch = capture.name
        .toLowerCase()
        .includes(searchQuery.toLowerCase());

      // Check if capture matches selected types
      const matchesType =
        selectedTypes.size === 0 || selectedTypes.has(capture.type);

      // Check if capture matches selected sources
      const matchesSource =
        selectedSources.size === 0 || selectedSources.has(capture.source);

      // Update timestamp filtering logic
      const captureDate = new Date(capture.timestamp).getTime();
      const matchesTimeRange =
        (!startDatetime || captureDate >= new Date(startDatetime).getTime()) &&
        (!endDatetime || captureDate <= new Date(endDatetime).getTime());

      return matchesSearch && matchesType && matchesSource && matchesTimeRange;
    });
  }, [
    captures,
    searchQuery,
    selectedTypes,
    selectedSources,
    startDatetime,
    endDatetime,
  ]);

  // Unselect captures that are filtered out
  useEffect(() => {
    if (!selectedCaptureIds || !setSelectedCaptureIds) {
      return;
    }

    // Get IDs of currently visible captures
    const visibleCaptureIds = new Set(
      filteredCaptures.map((capture) => capture.id),
    );

    // Keep only selected IDs that are still visible in filtered results
    const newSelectedIds = selectedCaptureIds.filter((id) =>
      visibleCaptureIds.has(id),
    );

    // Update selection if any captures were unselected
    if (!_.isEqual(selectedCaptureIds, newSelectedIds)) {
      setSelectedCaptureIds(newSelectedIds);
    }
  }, [filteredCaptures, selectedCaptureIds, setSelectedCaptureIds]);

  // Handle checkbox changes for type filters
  const handleTypeChange = (type: CaptureType) => {
    setSelectedTypes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(type)) {
        newSet.delete(type);
      } else {
        newSet.add(type);
      }
      return newSet;
    });
  };

  // Handle checkbox changes for source filters
  const handleSourceChange = (source: CaptureSource) => {
    setSelectedSources((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(source)) {
        newSet.delete(source);
      } else {
        newSet.add(source);
      }
      return newSet;
    });
  };

  // Calculate the number of hidden captures
  const hiddenCaptures = captures.length - filteredCaptures.length;

  return (
    <div style={{ width: '100%' }}>
      <div
        style={{
          padding: '10px',
          textAlign: 'center',
          backgroundColor: '#ffffff',
        }}
      >
        <input
          type="text"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '10px',
            width: '800px',
            maxWidth: '100%',
            borderRadius: '20px',
            border: '1px solid #ccc',
            outline: 'none',
          }}
          aria-label="Search captures"
        />
      </div>
      <div
        style={{
          display: 'flex',
          width: '100%',
          gap: '20px',
          alignItems: 'flex-start',
        }}
      >
        <aside
          style={{
            width: '250px',
            flexShrink: 0,
            padding: '15px',
            backgroundColor: '#ffffff',
            borderRadius: '4px',
            boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          }}
        >
          <h5>Filters</h5>
          <Form>
            <Form.Group className="mb-3">
              <h6>Time Range</h6>
              <div className="mb-2">
                <label htmlFor="start-time" className="d-block mb-1">
                  Start Time
                </label>
                <input
                  type="datetime-local"
                  id="start-time"
                  className="form-control"
                  value={startDatetime.replace('Z', '')}
                  onChange={(e) => setStartDatetime(e.target.value + 'Z')}
                  max={endDatetime || undefined}
                  aria-label="Select start date and time"
                />
              </div>
              <div className="mb-2">
                <label htmlFor="end-time" className="d-block mb-1">
                  End Time
                </label>
                <input
                  type="datetime-local"
                  id="end-time"
                  className="form-control"
                  value={endDatetime.replace('Z', '')}
                  onChange={(e) => setEndDatetime(e.target.value + 'Z')}
                  min={startDatetime || undefined}
                  aria-label="Select end date and time"
                />
              </div>
              <button
                className="btn btn-link btn-sm p-0"
                onClick={(e) => {
                  e.preventDefault();
                  setStartDatetime('');
                  setEndDatetime('');
                }}
                aria-label="Clear date range"
              >
                Clear dates
              </button>
            </Form.Group>

            {!hideCaptureTypeFilter && (
              <Form.Group className="mb-3">
                <h6>Capture Type</h6>
                {Object.entries(CAPTURE_TYPES).map(([id, info]) => (
                  <Form.Check
                    key={id}
                    type="checkbox"
                    id={`filter-type-${id}`}
                    label={info.name}
                    checked={selectedTypes.has(id as CaptureType)}
                    onChange={() => handleTypeChange(id as CaptureType)}
                    aria-label={`${info.name} filter checkbox`}
                  />
                ))}
              </Form.Group>
            )}
            <Form.Group className="mb-3">
              <h6>Source</h6>
              {Object.entries(CAPTURE_SOURCES).map(([id, info]) => (
                <Form.Check
                  key={id}
                  type="checkbox"
                  id={`filter-source-${id}`}
                  label={info.name}
                  checked={selectedSources.has(id as CaptureSource)}
                  onChange={() => handleSourceChange(id as CaptureSource)}
                  aria-label={`${info.name} filter checkbox`}
                />
              ))}
            </Form.Group>
          </Form>
        </aside>
        <main
          style={{
            flex: 1,
            minWidth: 0,
            maxHeight: '600px',
            backgroundColor: '#ffffff',
            borderRadius: '4px',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          <CaptureTable
            captures={filteredCaptures}
            selectedIds={selectedCaptureIds}
            onSelect={setSelectedCaptureIds}
            totalCaptures={captures.length}
            hiddenCaptures={hiddenCaptures}
            {...tableProps}
          />
        </main>
      </div>
    </div>
  );
};

export default CaptureSearch;
