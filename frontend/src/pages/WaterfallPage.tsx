import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Alert, Row, Col, Spinner } from 'react-bootstrap';

import { WaterfallVisualization } from '../components/waterfall';
import { RadioHoundCapture } from '../components/waterfall/types';
import WaterfallControls from '../components/waterfall/WaterfallControls';
import { getCaptures, Capture, getFileContent } from '../apiClient/fileService';
import ScanDetailsTable from '../components/waterfall/ScanDetailsTable';

interface WaterfallData {
  capture: Capture;
  fileData: RadioHoundCapture;
}

export interface WaterfallSettings {
  captureIndex: number;
  isPlaying: boolean;
  playbackSpeed: string;
}

export const WaterfallPage = () => {
  const [searchParams] = useSearchParams();
  const [waterfallData, setWaterfallData] = useState<WaterfallData[]>([]);
  const [settings, setSettings] = useState<WaterfallSettings>({
    captureIndex: 0,
    isPlaying: false,
    playbackSpeed: '1 fps',
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const abortController = new AbortController();

    const fetchRadiohoundData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Get capture IDs from URL parameters
        const captureParam = searchParams.get('captures');
        if (!captureParam) {
          throw new Error('No captures specified');
        }

        const captureIds = captureParam.split(',').map(Number);

        // Fetch all specified captures
        const captures = await getCaptures();
        const selectedCaptures = captures.filter(
          (capture) => captureIds.includes(capture.id) && capture.type === 'rh',
        );

        if (selectedCaptures.length === 0) {
          throw new Error('No valid RadioHound captures found');
        }

        // Fetch file content for each selected capture
        const waterfallPromises = selectedCaptures.map(async (capture) => {
          const fileId = capture.files[0]?.id;
          if (!fileId) {
            throw new Error(`No files found for capture ${capture.id}`);
          }
          const fileData = await getFileContent(fileId, abortController.signal);
          return {
            capture,
            fileData,
          };
        });

        const results = await Promise.all(waterfallPromises);

        // Sort the results by timestamp before setting state
        const sortedResults = results.sort((a, b) => {
          const aTimestamp = a.fileData.timestamp;
          const bTimestamp = b.fileData.timestamp;

          // Handle cases where timestamp might not exist
          if (!aTimestamp && !bTimestamp) return 0;
          if (!aTimestamp) return 1;
          if (!bTimestamp) return -1;

          // Parse timestamps to ensure consistent comparison
          const aTime = Date.parse(aTimestamp);
          const bTime = Date.parse(bTimestamp);

          return aTime - bTime;
        });

        setWaterfallData(sortedResults);
      } catch (err) {
        if (abortController.signal.aborted) {
          return;
        }
        setError(
          err instanceof Error
            ? err.message
            : 'An error occurred while fetching RadioHound data',
        );
      } finally {
        if (!abortController.signal.aborted) {
          setIsLoading(false);
        }
      }
    };

    fetchRadiohoundData();

    return () => {
      abortController.abort();
    };
  }, [searchParams]);

  if (isLoading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: '200px' }}
        aria-live="polite"
      >
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Error</Alert.Heading>
        <p>{error}</p>
      </Alert>
    );
  }

  if (waterfallData.length === 0) {
    return (
      <Alert variant="warning">
        <Alert.Heading>No RadioHound Data Found</Alert.Heading>
        <p>No RadioHound captures are currently available</p>
      </Alert>
    );
  }

  return (
    <div className="page-container-wide">
      <h5>Waterfall</h5>
      <br />
      <Row>
        <Col xs={3} style={{ maxWidth: 250 }}>
          <div className="d-flex flex-column gap-3">
            <WaterfallControls
              settings={settings}
              setSettings={setSettings}
              numCaptures={waterfallData.length}
            />
          </div>
        </Col>
        <Col>
          <Row>
            <WaterfallVisualization
              data={waterfallData.map((data) => data.fileData)}
              settings={settings}
              setSettings={setSettings}
            />
          </Row>
          <Row>
            <ScanDetailsTable
              capture={waterfallData[settings.captureIndex].fileData}
            />
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default WaterfallPage;
