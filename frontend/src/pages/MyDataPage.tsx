import { useEffect, useState } from 'react';
import { Row, Col, Form } from 'react-bootstrap';

import { useAppContext } from '../utils/AppContext';
import { useSyncCaptures } from '../apiClient/fileService';
import DatasetTable from '../components/CaptureTable';
import Button from '../components/Button';
import FileUploadModal from '../components/FileUploadModal';
import { CaptureSource, CAPTURE_SOURCES } from '../apiClient/fileService';

const MyDataPage = () => {
  const context = useAppContext();
  const { captures, username, sdsCount } = context;
  const syncCaptures = useSyncCaptures();
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const [minFrequency, setMinFrequency] = useState<string>('');
  const [maxFrequency, setMaxFrequency] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  const [selectedSources, setSelectedSources] = useState<CaptureSource[]>([]);

  useEffect(() => {
    if (username) {
      setIsLoading(true);
      syncCaptures().finally(() => setIsLoading(false));
    }
  }, [syncCaptures, username]);

  const applyFilters = () => {
    syncCaptures({
      min_frequency: minFrequency,
      max_frequency: maxFrequency,
      start_time: startTime,
      end_time: endTime,
      source: selectedSources.length > 0 ? selectedSources : undefined,
    });
  };

  const handleSourceChange = (source: string) => {
    const typedSource = source as CaptureSource; // Cast to CaptureSource type
    setSelectedSources(
      (prevSources) =>
        prevSources.includes(typedSource)
          ? prevSources.filter((s) => s !== typedSource) // Remove if already selected
          : [...prevSources, typedSource], // Add if not selected
    );
  };

  return (
    <div className="page-container">
      <h5>Captures</h5>
      <br />
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!context?.username}
        disabledHelpText="You must be logged in to upload a capture"
      >
        Upload New Capture
      </Button>

      {sdsCount === 0 && (
        <div style={{ marginTop: '20px', color: 'black' }}>
          <p>No SDS captures available. Upload a capture to get started</p>
        </div>
      )}

      <Row className="mt-3 align-items-start">
        {/* Left Side: Filters */}
        <Col xs={3} style={{ minWidth: '250px' }}>
          <div className="filter-box p-3 border rounded bg-white h-100">
            <h6>Filter by Frequency</h6>
            <Form.Group controlId="minFrequency">
              <Form.Label>Min Frequency (Hz)</Form.Label>
              <Form.Control
                type="number"
                placeholder="Enter min freq"
                value={minFrequency}
                onChange={(e) => setMinFrequency(e.target.value)}
              />
            </Form.Group>

            <Form.Group controlId="maxFrequency" className="mt-2">
              <Form.Label>Max Frequency (Hz)</Form.Label>
              <Form.Control
                type="number"
                placeholder="Enter max freq"
                value={maxFrequency}
                onChange={(e) => setMaxFrequency(e.target.value)}
              />
            </Form.Group>

            <h6 className="mt-3">Filter by Date & Time</h6>
            <Form.Group controlId="startTime">
              <Form.Label>Start Time</Form.Label>
              <Form.Control
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
              />
            </Form.Group>
            <Form.Group controlId="endTime" className="mt-2">
              <Form.Label>End Time</Form.Label>
              <Form.Control
                type="datetime-local"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
              />
            </Form.Group>

            <h6 className="mt-3">Filter by Source</h6>
            <Form.Group controlId="sourceFilter">
              {Object.keys(CAPTURE_SOURCES).map((sourceKey) => {
                const sourceValue = sourceKey as CaptureSource;
                return (
                  <Form.Check
                    key={sourceValue}
                    type="checkbox"
                    label={CAPTURE_SOURCES[sourceValue].name}
                    value={sourceValue}
                    checked={selectedSources.includes(sourceValue)}
                    onChange={() => handleSourceChange(sourceValue)}
                  />
                );
              })}
            </Form.Group>

            <Button variant="primary" onClick={applyFilters} className="mt-3">
              Apply Filters
            </Button>
          </div>
        </Col>

        {/* Right Side: Captures Table */}
        <Col md={8}>
          <div className="capture-table-container bg-white h-100">
            {captures.length > 0 ? (
              <DatasetTable captures={captures} />
            ) : isLoading ? (
              <div>
                <p>Loading...</p>
              </div>
            ) : username ? (
              <div>
                <p>No captures found. Upload a capture to get started!</p>
              </div>
            ) : (
              <div>
                <p>Please log in to view your data.</p>
              </div>
            )}
          </div>
        </Col>
      </Row>

      <FileUploadModal
        show={showModal}
        handleClose={() => setShowModal(false)}
        handleSuccess={syncCaptures}
      />
    </div>
  );
};

export default MyDataPage;
