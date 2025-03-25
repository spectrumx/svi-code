import { useState } from 'react';
import { Alert, Row, Col } from 'react-bootstrap';

import { WaterfallVisualization } from '.';
import { RadioHoundFile } from './types';
import WaterfallControls from './WaterfallControls';
import ScanDetailsTable from './ScanDetailsTable';
import { VizContainerProps } from '../types';

export interface WaterfallSettings {
  fileIndex: number;
  isPlaying: boolean;
  playbackSpeed: string;
}

export const WaterfallVizContainer = ({
  visualizationRecord,
  files,
}: VizContainerProps) => {
  const [settings, setSettings] = useState<WaterfallSettings>({
    fileIndex: 0,
    isPlaying: false,
    playbackSpeed: '1 fps',
  });

  // We currently only support one capture per visualization, so grab the first
  // capture and use its files
  const rhFiles = visualizationRecord.captures[0].files.map(
    (file) => files[file.id].fileContent as RadioHoundFile,
  );

  if (rhFiles.length === 0) {
    return (
      <Alert variant="warning">
        <Alert.Heading>No RadioHound Data Found</Alert.Heading>
        <p>No files found for this visualization</p>
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
              numFiles={rhFiles.length}
            />
          </div>
        </Col>
        <Col>
          <Row>
            <WaterfallVisualization
              rhFiles={rhFiles}
              settings={settings}
              setSettings={setSettings}
            />
          </Row>
          <Row>
            <ScanDetailsTable rhFile={rhFiles[settings.fileIndex]} />
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default WaterfallVizContainer;
