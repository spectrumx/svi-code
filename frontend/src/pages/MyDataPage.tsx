import { useEffect, useState } from 'react';
import { Row, Col } from 'react-bootstrap';
import {
  FrequencyFilter,
  DateTimeFilter,
  // SourceFilter,
} from '../components/filters';
import { useAppContext } from '../utils/AppContext';
import { useSyncCaptures } from '../apiClient/captureService';
import CaptureTable from '../components/CaptureTable';
import Button from '../components/Button';
// import CaptureUploadModal from '../components/CaptureUploadModal';
import LoadingBlock from '../components/LoadingBlock';

const MyDataPage = () => {
  const context = useAppContext();
  const { captures, username } = context;
  const syncCaptures = useSyncCaptures();
  // const [showModal, setShowModal] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Filter states
  const [minFrequency, setMinFrequency] = useState<string>('');
  const [maxFrequency, setMaxFrequency] = useState<string>('');
  const [startTime, setStartTime] = useState<string>('');
  const [endTime, setEndTime] = useState<string>('');
  // const [selectedSources, setSelectedSources] = useState<CaptureSource[]>([]);

  useEffect(() => {
    if (username) {
      setIsLoading(true);
      syncCaptures().finally(() => setIsLoading(false));
    }
  }, [syncCaptures, username]);

  // const handleSourceChange = (source: CaptureSource) => {
  //   setSelectedSources((prevSources) =>
  //     prevSources.includes(source)
  //       ? prevSources.filter((s) => s !== source)
  //       : [...prevSources, source],
  //   );
  // };

  // filters- to select captures based on filters
  const applyFilters = () => {
    syncCaptures({
      min_frequency: minFrequency,
      max_frequency: maxFrequency,
      start_time: startTime,
      end_time: endTime,
      // source: selectedSources.length > 0 ? selectedSources : undefined,
    });
  };

  return (
    <div className="page-container-wide">
      <h5>Captures</h5>
      {/* <br />
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!username}
        disabledHelpText="You must be logged in to upload a capture"
      >
        Upload New Capture
      </Button> */}

      <Row className="mt-3 align-items-start">
        {/* Filter Column */}
        <Col xs={3} style={{ minWidth: '250px' }}>
          <div className="capture-table-infobox-height" />
          <div className="filter-box p-3 border bg-white">
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

            {/* <SourceFilter
              selectedSources={selectedSources}
              onSourceChange={handleSourceChange}
              className="mb-3"
            /> */}

            <Button variant="primary" onClick={applyFilters} className="mt-3">
              Apply Filters
            </Button>
          </div>
        </Col>

        {/* Table Column */}
        <Col xs={9}>
          <div>
            {captures.length > 0 ? (
              <CaptureTable captures={captures} />
            ) : (
              <div className="p-3" style={{ marginTop: '25px' }}>
                {isLoading ? (
                  <LoadingBlock message="Getting captures..." />
                ) : username ? (
                  <p>
                    No captures found. Create a capture in the{' '}
                    <a
                      href="https://sds.crc.nd.edu/"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      SpectrumX Data System
                    </a>{' '}
                    to get started!
                  </p>
                ) : (
                  <p>Please log in to view your data.</p>
                )}
              </div>
            )}
          </div>
        </Col>
      </Row>

      {/* <CaptureUploadModal
        show={showModal}
        handleClose={() => setShowModal(false)}
        handleSuccess={syncCaptures}
      /> */}
    </div>
  );
};

export default MyDataPage;
