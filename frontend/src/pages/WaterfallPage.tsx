import { useEffect, useState } from 'react';
// import { useParams } from 'react-router';
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
  const [waterfallData, setWaterfallData] = useState<WaterfallData[]>([]);
  const [settings, setSettings] = useState<WaterfallSettings>({
    captureIndex: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRadiohoundData = async () => {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch all captures and filter for RadioHound data
        const captures = await getCaptures();
        const radiohoundCaptures = captures.filter(
          (capture) => capture.type === 'rh',
        );

        // Fetch file content for each RadioHound capture
        const waterfallPromises = radiohoundCaptures.map(async (capture) => {
          // Assuming we want the first file from each capture
          const fileId = capture.files[0]?.id;
          if (!fileId) {
            throw new Error(`No files found for capture ${capture.id}`);
          }
          const fileData = await getFileContent(fileId);
          return {
            capture,
            fileData,
          };
        });

        const results = await Promise.all(waterfallPromises);
        setWaterfallData(results);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'An error occurred while fetching RadioHound data',
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchRadiohoundData();
  }, []);

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
          />
        </Col>
      </Row>
      <Row>
        <ScanDetailsTable
          capture={waterfallData[settings.captureIndex].fileData}
        />
      </Row>
    </div>
  );
};

export default WaterfallPage;
