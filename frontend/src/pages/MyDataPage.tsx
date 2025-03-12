import { useEffect, useState } from 'react';
import { Row, Col } from 'react-bootstrap';
import {
  FrequencyFilter,
  DateTimeFilter,
  SourceFilter,
} from '../components/filters';
import { useAppContext } from '../utils/AppContext';
import { useSyncCaptures, CaptureSource } from '../apiClient/fileService';
import DatasetTable from '../components/CaptureTable';
import Button from '../components/Button';
import FileUploadModal from '../components/FileUploadModal';

const MyDataPage = () => {
  const context = useAppContext();
  const { captures, username } = context;
  const syncCaptures = useSyncCaptures();
  const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filter states
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

  const handleSourceChange = (source: CaptureSource) => {
    setSelectedSources((prevSources) =>
      prevSources.includes(source)
        ? prevSources.filter((s) => s !== source)
        : [...prevSources, source],
    );
  };

  // filters- to select captures based on filters
  const applyFilters = () => {
    syncCaptures({
      min_frequency: minFrequency,
      max_frequency: maxFrequency,
      start_time: startTime,
      end_time: endTime,
      source: selectedSources.length > 0 ? selectedSources : undefined,
    });
  };

  return (
    <div className="page-container">
      <h5>Captures</h5>
      <br />
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!username}
        disabledHelpText="You must be logged in to upload a capture"
      >
        Upload New Capture
      </Button>

      <Row className="mt-3 align-items-start">
        {/* Filter Column */}
        <Col xs={3} style={{ minWidth: '250px' }}>
          <div className="filter-box p-3 border rounded bg-white">
            <FrequencyFilter
              minFrequency={minFrequency}
              maxFrequency={maxFrequency}
              onMinFrequencyChange={setMinFrequency}
              onMaxFrequencyChange={setMaxFrequency}
              className="mb-3"
            />

            <DateTimeFilter
              startTime={startTime}
              endTime={endTime}
              onStartTimeChange={setStartTime}
              onEndTimeChange={setEndTime}
              className="mb-3"
            />

            <SourceFilter
              selectedSources={selectedSources}
              onSourceChange={handleSourceChange}
              className="mb-3"
            />

            <Button variant="primary" onClick={applyFilters} className="mt-3">
              Apply Filters
            </Button>
          </div>
        </Col>

        {/* Table Column - Remove border from container */}
        <Col xs={9}>
          <div className="capture-table-container">
            {captures.length > 0 ? (
              <DatasetTable
                captures={captures}
                totalCaptures={captures.length}
                numHiddenCaptures={0}
              />
            ) : isLoading ? (
              <div className="p-3">
                <p>Loading...</p>
              </div>
            ) : username ? (
              <div className="p-3">
                <p>No captures found. Upload a capture to get started!</p>
              </div>
            ) : (
              <div className="p-3">
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
