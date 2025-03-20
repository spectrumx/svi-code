import { useState } from 'react';
import { Alert, Row, Col } from 'react-bootstrap';

import { WaterfallVisualization } from '.';
import { RadioHoundCapture } from './types';
import WaterfallControls from './WaterfallControls';
import { Capture } from '../../apiClient/fileService';
import ScanDetailsTable from './ScanDetailsTable';
import { VizContainerProps } from '../types';

interface WaterfallData {
  capture: Capture;
  fileContent: RadioHoundCapture;
}

export interface WaterfallSettings {
  captureIndex: number;
  isPlaying: boolean;
  playbackSpeed: string;
}

export const WaterfallVizContainer = ({
  visualizationState,
  files,
}: VizContainerProps) => {
  const [settings, setSettings] = useState<WaterfallSettings>({
    captureIndex: 0,
    isPlaying: false,
    playbackSpeed: '1 fps',
  });

  const waterfallData: WaterfallData[] = visualizationState.captures
    .map((capture) => ({
      capture,
      fileContent: files[capture.files[0].id].fileContent as RadioHoundCapture,
    }))
    .sort(
      (a, b) =>
        new Date(a.fileContent.timestamp).getTime() -
        new Date(b.fileContent.timestamp).getTime(),
    );

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
              data={waterfallData.map((data) => data.fileContent)}
              settings={settings}
              setSettings={setSettings}
            />
          </Row>
          <Row>
            <ScanDetailsTable
              capture={waterfallData[settings.captureIndex].fileContent}
            />
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default WaterfallVizContainer;
