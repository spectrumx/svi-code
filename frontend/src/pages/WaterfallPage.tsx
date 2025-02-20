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
}

export const WaterfallPage = () => {
  const [searchParams] = useSearchParams();
  const [waterfallData, setWaterfallData] = useState<WaterfallData[]>([]);
  const [settings, setSettings] = useState<WaterfallSettings>({
    captureIndex: 0,
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

        console.log('Getting waterfall data');
        const results = await Promise.all(waterfallPromises);
        console.log('Files downloaded');
        setWaterfallData(results);
      } catch (err) {
        if (abortController.signal.aborted) {
          console.log('Downloads aborted');
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
    <div className="page-container">
      <h5>Waterfall</h5>
      <br />
      <Row>
        <Col xs={3} style={{ maxWidth: 200 }}>
          <div className="d-flex flex-column gap-3">
            <WaterfallControls
              settings={settings}
              setSettings={setSettings}
              numCaptures={waterfallData.length}
            />
          </div>
        </Col>
        <Col>
          <WaterfallVisualization
            data={waterfallData.map((data) => data.fileData)}
            settings={settings}
            setSettings={setSettings}
          />
        </Col>
      </Row>
      <br />
      <Row>
        <ScanDetailsTable
          capture={waterfallData[settings.captureIndex].fileData}
        />
      </Row>
    </div>
  );
};

export default WaterfallPage;
