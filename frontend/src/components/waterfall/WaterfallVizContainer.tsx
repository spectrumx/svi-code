import { useCallback, useState } from 'react';
import { Row, Col, Alert } from 'react-bootstrap';

import LoadingBlock from '../LoadingBlock';
import { WaterfallControls } from './WaterfallControls';
import { WaterfallVisualization } from './index';
import { WaterfallSettings } from './types';
import { useWaterfallData, useTotalSlices } from '../../apiClient/visualizationService';
import { VisualizationRecordDetail } from '../../apiClient/visualizationService';
import ScanDetailsTable from './ScanDetailsTable';

export const WATERFALL_MAX_ROWS = 80;

interface VizContainerProps {
  visualizationRecord: VisualizationRecordDetail;
}

export const WaterfallVizContainer = ({
  visualizationRecord,
}: VizContainerProps) => {
  const [settings, setSettings] = useState<WaterfallSettings>({
    fileIndex: 0,
    isPlaying: false,
    playbackSpeed: '1 fps',
  });

  const [waterfallRange, setWaterfallRange] = useState({
    startIndex: 0,
    endIndex: WATERFALL_MAX_ROWS - 1,
  });

  const { waterfallData, isLoading: isLoadingWaterfallData, error } = useWaterfallData(
    visualizationRecord.uuid,
    waterfallRange.startIndex,
    waterfallRange.endIndex,
  );

  // Get total slices (only called once when component mounts)
  const { totalSlices, isLoading: isLoadingTotalSlices } = useTotalSlices(
    visualizationRecord.uuid
  );

  // Callback to receive waterfall range updates from WaterfallVisualization
  const handleWaterfallRangeChange = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      setWaterfallRange(range);
    },
    [],
  );

  const allFilesLoaded = waterfallData && totalSlices && waterfallData.length === totalSlices;
  const isLoadingWaterfallRange =
    Boolean(isLoadingWaterfallData && waterfallData && !allFilesLoaded);

  if ((isLoadingTotalSlices || isLoadingWaterfallData || waterfallData === undefined) && !error) {
    return <LoadingBlock message="Getting visualization files..." />;
  }

  if (error) {
    return (
      <Alert variant="danger">Error loading visualization files: {error}</Alert>
    );
  }

  if (waterfallData?.length === 0) {
    return (
      <Alert variant="warning">
        <Alert.Heading>No Data Found</Alert.Heading>
        <p>No files found for this visualization</p>
      </Alert>
    );
  }

  const waterfallFiles = waterfallData?.sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
  ) ?? [];

  const handleSaveWaterfall = async () => {
    try {
      // Get all canvas elements
      const periodogramCanvas = document.querySelector('#chartCanvas canvas');
      const waterfallPlotCanvas = document.querySelector(
        '.waterfall-plot canvas:first-child',
      );
      const waterfallOverlayCanvas = document.querySelector(
        '.waterfall-plot canvas:last-child',
      );

      if (
        !periodogramCanvas ||
        !waterfallPlotCanvas ||
        !waterfallOverlayCanvas
      ) {
        throw new Error('Could not find all visualization canvases');
      }

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

      // Create a new canvas to combine all elements
      const combinedCanvas = document.createElement('canvas');
      const ctx = combinedCanvas.getContext('2d');
      if (!ctx) throw new Error('Could not create canvas context');

      // Get dimensions
      const periodogramHeight = (periodogramCanvas as HTMLCanvasElement).height;
      const waterfallHeight = (waterfallPlotCanvas as HTMLCanvasElement).height;
      const waterfallWidth = (waterfallPlotCanvas as HTMLCanvasElement).width;

      // Define padding
      const padding = 20; // pixels of padding on all sides

      // Set combined canvas size with padding
      combinedCanvas.width = waterfallWidth + padding * 2;
      combinedCanvas.height = periodogramHeight + waterfallHeight + padding * 2;

      // Fill background with white
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, combinedCanvas.width, combinedCanvas.height);

      // Draw periodogram with padding
      ctx.drawImage(periodogramCanvas as HTMLCanvasElement, padding, padding);

      // Draw waterfall plot with padding
      ctx.drawImage(
        waterfallPlotCanvas as HTMLCanvasElement,
        padding,
        periodogramHeight + padding,
      );

      // Draw overlay on top of waterfall with padding
      ctx.drawImage(
        waterfallOverlayCanvas as HTMLCanvasElement,
        padding,
        periodogramHeight + padding,
      );

      // Convert combined canvas to blob
      const combinedBlob = await new Promise<Blob>((resolve, reject) => {
        combinedCanvas.toBlob((blob: Blob | null) => {
          if (blob) resolve(blob);
          else reject(new Error('Failed to create blob from combined canvas'));
        }, 'image/png');
      });

      // Helper function to trigger download
      const downloadFile = (blob: Blob, filename: string) => {
        const downloadUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      };

      // Download combined image
      downloadFile(
        combinedBlob,
        `waterfall-visualization-${visualizationRecord.uuid}-${timestamp}.png`,
      );
    } catch (error) {
      console.error('Error saving visualization:', error);
      // You might want to show an error message to the user here
    }
  };

  return (
    <div>
      <Row>
        <Col xs={3} style={{ maxWidth: 250 }}>
          <div className="d-flex flex-column gap-3">
            <WaterfallControls
              settings={settings}
              setSettings={setSettings}
              numFiles={totalSlices}
            />
          </div>
        </Col>
        <Col>
          <Row>
            <div style={{ position: 'relative' }}>
              <WaterfallVisualization
                waterfallFiles={waterfallFiles}
                settings={settings}
                setSettings={setSettings}
                onSave={handleSaveWaterfall}
                onWaterfallRangeChange={!allFilesLoaded ? handleWaterfallRangeChange : undefined}
                totalSlices={totalSlices}
                isLoadingWaterfallRange={isLoadingWaterfallRange}
              />
              {isLoadingWaterfallRange && (
                <div
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    backgroundColor: 'rgba(255, 255, 255, 0.9)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    backdropFilter: 'blur(2px)',
                  }}
                >
                  <LoadingBlock
                    message='Loading waterfall data...'
                  />
                </div>
              )}
            </div>
          </Row>
          <Row>
            <ScanDetailsTable
              waterfallFile={waterfallFiles[settings.fileIndex]}
              captureType={visualizationRecord.capture_type}
            />
          </Row>
        </Col>
      </Row>
    </div>
  );
};

export default WaterfallVizContainer;
