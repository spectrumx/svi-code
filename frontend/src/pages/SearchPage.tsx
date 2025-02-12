import { useEffect, useState, useMemo } from 'react';
import { Form } from 'react-bootstrap';

import CaptureTable from '../components/CaptureTable';
import {
  useSyncCaptures,
  CAPTURE_TYPES,
  CAPTURE_SOURCES,
  CaptureType,
  CaptureSource,
} from '../apiClient/fileService';
import { useAppContext } from '../utils/AppContext';

/**
 * SearchPage component that displays a search interface for RF captures
 * with filtering capabilities for capture types and sources
 */
export const SearchPage = () => {
  const context = useAppContext();
  const { captures } = context;
  const syncCaptures = useSyncCaptures();

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

      // Add/subtract one day from min/max
      const minWithBuffer = new Date(minTimestamp);
      minWithBuffer.setDate(minWithBuffer.getDate() - 1);
      const maxWithBuffer = new Date(maxTimestamp);
      maxWithBuffer.setDate(maxWithBuffer.getDate() + 1);

      // Format to ISO string and remove milliseconds and timezone
      const formatDateTime = (date: Date) => {
        return date.toISOString().slice(0, 16);
      };

      setStartDatetime(formatDateTime(minWithBuffer));
      setEndDatetime(formatDateTime(maxWithBuffer));
    }
  }, [captures]);

  useEffect(() => {
    syncCaptures();
  }, [syncCaptures]);

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

      console.log('capture.timestamp', capture.timestamp);
      console.log('startDatetime', startDatetime);
      console.log('endDatetime', endDatetime);

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

  return (
    <div className="page-container">
      <div
        style={{
          padding: '10px',
          textAlign: 'center',
          backgroundColor: '#ffffff',
        }}
      >
        <h5>Search</h5>
        <input
          type="text"
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{
            padding: '10px',
            width: '800px',
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
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: '90%',
            minWidth: '600px',
            maxWidth: '1400px',
            gap: '20px',
          }}
        >
          <div
            style={{
              width: '200px',
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
                    value={startDatetime}
                    onChange={(e) => setStartDatetime(e.target.value)}
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
                    value={endDatetime}
                    onChange={(e) => setEndDatetime(e.target.value)}
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
          </div>
          <div style={{ flex: 1 }}>
            <CaptureTable captures={filteredCaptures} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
