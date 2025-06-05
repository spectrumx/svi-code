import { useState } from 'react';
import { Alert, Row, Col } from 'react-bootstrap';

import { WaterfallVisualization } from '.';
import WaterfallControls from './WaterfallControls';
import ScanDetailsTable from './ScanDetailsTable';
import { VizContainerProps } from '../types';
import { useWaterfallData } from '../../apiClient/visualizationService';
import LoadingBlock from '../LoadingBlock';

export interface WaterfallSettings {
  fileIndex: number;
  isPlaying: boolean;
  playbackSpeed: string;
}

export const WaterfallVizContainer = ({
  visualizationRecord,
}: VizContainerProps) => {
  const { waterfallData, isLoading, error } = useWaterfallData(
    visualizationRecord.uuid,
  );
  const [settings, setSettings] = useState<WaterfallSettings>({
    fileIndex: 0,
    isPlaying: false,
    playbackSpeed: '1 fps',
  });

  if (isLoading) {
    return <LoadingBlock message="Getting visualization files..." />;
  }

  if (error) {
    return (
      <Alert variant="danger">Error loading visualization files: {error}</Alert>
    );
  }

  if (waterfallData.length === 0) {
    return (
      <Alert variant="warning">
        <Alert.Heading>No Data Found</Alert.Heading>
        <p>No files found for this visualization</p>
      </Alert>
    );
  }

  // We currently only support one capture per visualization, so grab the first
  // capture and use its files
  const waterfallFiles = waterfallData.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  );

  return (
    <div>
      <Row>
        <Col xs={3} style={{ maxWidth: 250 }}>
          <div className="d-flex flex-column gap-3">
            <WaterfallControls
              settings={settings}
              setSettings={setSettings}
              numFiles={waterfallFiles.length}
            />
          </div>
        </Col>
        <Col>
          <Row>
            <WaterfallVisualization
              waterfallFiles={waterfallFiles}
              settings={settings}
              setSettings={setSettings}
            />
          </Row>
          <Row>
            <ScanDetailsTable
              waterfallFile={waterfallFiles[settings.fileIndex]}
            />
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default WaterfallVizContainer;
