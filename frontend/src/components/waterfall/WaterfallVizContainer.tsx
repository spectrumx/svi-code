import { useState, useCallback, useEffect } from 'react';
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
  subchannel?: number;
}

export const WaterfallVizContainer = ({
  visualizationRecord,
}: VizContainerProps) => {
  const [settings, setSettings] = useState<WaterfallSettings>({
    fileIndex: 0,
    isPlaying: false,
    playbackSpeed: '1 fps',
    subchannel: 0,
  });

  // Track the current window range for DigitalRF captures (from WaterfallVisualization)
  const [waterfallRange, setWaterfallRange] = useState({
    startIndex: 0,
    endIndex: 80, // WATERFALL_MAX_ROWS
  });

  // Determine if this is a DigitalRF visualization
  const isDigitalRF = visualizationRecord.capture_type === 'drf';

  const { waterfallData, isLoading, error } = useWaterfallData(
    visualizationRecord.uuid,
    settings.subchannel,
    isDigitalRF ? waterfallRange.startIndex : undefined,
    isDigitalRF ? waterfallRange.endIndex : undefined,
  );

  // Callback to receive waterfall range updates from WaterfallVisualization
  const handleWaterfallRangeChange = useCallback(
    (range: { startIndex: number; endIndex: number }) => {
      if (isDigitalRF) {
        setWaterfallRange(range);
      }
    },
    [isDigitalRF],
  );

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

  // Extract subchannel information from the first file if available
  const numSubchannels = waterfallFiles[0]?.custom_fields?.num_subchannels;

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
              numFiles={
                isDigitalRF
                  ? visualizationRecord.total_slices || waterfallFiles.length
                  : waterfallFiles.length
              }
              numSubchannels={numSubchannels}
            />
          </div>
        </Col>
        <Col>
          <Row>
            <WaterfallVisualization
              waterfallFiles={waterfallFiles}
              settings={settings}
              setSettings={setSettings}
              onSave={handleSaveWaterfall}
              onWaterfallRangeChange={handleWaterfallRangeChange}
              totalSlices={
                isDigitalRF
                  ? visualizationRecord.total_slices || undefined
                  : undefined
              }
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
