import { useRef, useEffect } from 'react';
import _ from 'lodash';
import { scaleLinear, interpolateHslLong, rgb } from 'd3';

import { ScanState, WaterfallType, Display } from './types';
import { WATERFALL_MAX_ROWS } from './index';

interface WaterfallPlotProps {
  scan: ScanState;
  display: Display;
  setWaterfall: (waterfall: WaterfallType) => void;
  setScaleChanged: (scaleChanged: boolean) => void;
  setResetScale: (resetScale: boolean) => void;
  currentCaptureIndex: number;
  onCaptureSelect: (index: number) => void;
  /**
   * The indices of the captures currently being displayed in the waterfall plot.
   * Note that the WaterfallPlot component simply displays whatever captures are
   * in scan.allData; this prop just tells the component the indices of those
   * captures within the full dataset.
   */
  captureRange: {
    startIndex: number;
    endIndex: number;
  };
  /**
   * The total number of captures in the full dataset.
   */
  totalCaptures: number;
}

const scrollIndicatorStyle: React.CSSProperties = {
  position: 'absolute',
  left: '50%',
  transform: 'translateX(-50%)',
  width: 0,
  height: 0,
  borderLeft: '20px solid transparent',
  borderRight: '20px solid transparent',
  opacity: 0.7,
  cursor: 'pointer',
};

const upIndicatorStyle: React.CSSProperties = {
  ...scrollIndicatorStyle,
  top: '-25px',
  borderBottom: '20px solid #808080',
};

const downIndicatorStyle: React.CSSProperties = {
  ...scrollIndicatorStyle,
  bottom: '-25px',
  borderTop: '20px solid #808080',
};

function WaterfallPlot({
  scan,
  display,
  setWaterfall,
  setScaleChanged,
  setResetScale,
  currentCaptureIndex,
  onCaptureSelect,
  captureRange,
  totalCaptures,
}: WaterfallPlotProps) {
  const plotCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const plotDimensionsRef = useRef<{
    rectWidth: number;
    rectHeight: number;
  } | null>(null);
  const pixelRatioRef = useRef(1);

  const labelWidth = 75;
  const margin = {
    top: 5,
    left: 5,
    bottom: 5,
    right: 75,
  };

  // Update canvas sizes on mount
  useEffect(() => {
    if (!plotCanvasRef.current || !overlayCanvasRef.current) return;

    const plotCanvas = plotCanvasRef.current;
    const overlayCanvas = overlayCanvasRef.current;
    const container = plotCanvas.parentElement;
    if (!container) return;

    // Get the container's width
    const { width } = container.getBoundingClientRect();

    // Set canvas width to match container width, accounting for device pixel ratio
    const pixelRatio = window.devicePixelRatio || 1;
    pixelRatioRef.current = pixelRatio;
    const canvasWidth = Math.floor(width * pixelRatio);
    const canvasHeight = Math.floor(500 * pixelRatio);

    // Set dimensions for both canvases
    [plotCanvas, overlayCanvas].forEach((c) => {
      c.width = canvasWidth;
      c.height = canvasHeight;
      c.style.width = `${width}px`;
      c.style.height = '500px';

      // Position the canvases
      c.style.position = 'absolute';
      c.style.left = '0';
      c.style.top = '0';

      // Adjust canvas context for high DPI displays
      const context = c.getContext('2d');
      if (context) {
        context.scale(pixelRatio, pixelRatio);
        // Clear any existing transformations
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      }
    });

    // Ensure overlay canvas is on top
    overlayCanvas.style.zIndex = '1';
  }, []);

  function drawHighlightBox(
    allData: number[][],
    currentIndex: number,
    rectWidth: number,
    rectHeight: number,
  ) {
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;

    const context = overlayCanvas.getContext('2d');
    if (!context) return;

    const pixelRatio = pixelRatioRef.current;

    // Clear the entire overlay canvas including the transformed area
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    context.restore();

    // Calculate the relative position within the current page
    const relativeIndex = currentIndex - captureRange.startIndex;

    // Only draw if the current index is within the displayed range
    if (relativeIndex >= 0 && relativeIndex < allData.length) {
      // Set up the transform for the highlight box
      context.save();
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.translate(labelWidth + margin.left, margin.top);

      // Calculate position for highlight box
      const boxY = Math.floor(relativeIndex * rectHeight);
      const boxWidth = Math.ceil(allData[0].length * rectWidth);

      // Draw the grey highlight box
      context.strokeStyle = '#808080';
      context.lineWidth = 2;
      context.strokeRect(0, boxY, boxWidth, rectHeight);

      // Restore the original transform
      context.restore();
    }
  }

  function drawCaptureIndices(
    context: CanvasRenderingContext2D,
    allData: number[][],
    rectHeight: number,
    canvasWidth: number,
    pixelRatio: number,
    startIndex: number,
  ) {
    // Reset transform for drawing indices
    context.save();
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    // Create white background for indices
    context.fillStyle = 'white';
    context.fillRect(
      canvasWidth / pixelRatio - margin.right,
      margin.top,
      margin.right,
      allData.length * rectHeight,
    );

    // Only draw indices if we have 5 or more captures
    if (allData.length >= 5) {
      context.fillStyle = 'black';
      context.font = '12px Arial';
      context.textAlign = 'left';

      // Show every 5th index starting at 5
      for (let i = 4; i < allData.length; i += 5) {
        const y = margin.top + i * rectHeight + rectHeight / 2 + 4;
        const x = canvasWidth / pixelRatio - margin.right + 5;
        context.fillText(String(startIndex + i + 1), x, y);
      }
    }

    context.restore();
  }

  function drawWaterfall(
    canvas: HTMLCanvasElement,
    resetScaleCallback: () => void,
  ) {
    const scanCopy = _.cloneDeep(scan);
    const displayCopy = _.cloneDeep(display);
    const allData = scanCopy.allData as number[][];
    let redrawLegend = false;

    if (allData && allData.length > 0) {
      const context = canvas.getContext('2d');
      if (!context) return;

      const pixelRatio = pixelRatioRef.current;

      // Calculate available space for plotting
      const plotWidth =
        canvas.width / pixelRatio - labelWidth - margin.left - margin.right;
      const plotHeight =
        canvas.height / pixelRatio - margin.top - margin.bottom;

      // Calculate rectangle dimensions to fit exactly
      const rectWidth = plotWidth / allData[0].length;
      const rectHeight = plotHeight / WATERFALL_MAX_ROWS;

      // Store dimensions for highlight box
      plotDimensionsRef.current = { rectWidth, rectHeight };

      let { yMin, yMax } = scanCopy;
      const { scaleMin, scaleMax } = displayCopy;

      let colorScale =
        scaleMin && scaleMax
          ? scaleLinear(
              [scaleMin, scaleMax],
              [rgb('#0000FF'), rgb('#FF0000')],
            ).interpolate(interpolateHslLong)
          : // .interpolate(d3.interpolate)
            // .interpolate(d3.interpolateHcl)
            undefined;

      if (displayCopy.resetScale && context) {
        // Rescale the color gradient to min/max values and redraw entire graph

        // The following block of code clears the entire canvas without
        // losing context information.
        // Store the current transformation matrix
        context.save();
        // Use the identity matrix while clearing the canvas
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.clearRect(0, 0, canvas.width, canvas.height);
        // Restore the transform
        context.restore();

        //console.log("old ymin/max:",yMin,yMax);
        allData.forEach((row) => {
          row.forEach((value) => {
            if (yMin === undefined || value < yMin) {
              yMin = value;
            }
            if (yMax === undefined || value > yMax) {
              yMax = value;
            }
          });
        });
        //console.log("new ymin/max:",yMin,yMax);

        //waterfall.display.scaleMin = Math.round(yMin * 100) / 100;
        //waterfall.display.scaleMax = Math.round(yMax * 100) / 100;
        displayCopy.scaleMin = yMin;
        displayCopy.scaleMax = yMax;
        if (yMin < scanCopy.yMin) {
          scanCopy.yMin = yMin;
        }
        if (yMax > scanCopy.yMax) {
          scanCopy.yMax = yMax;
        }

        setWaterfall(scanCopy);

        colorScale = scaleLinear(
          [displayCopy.scaleMin, displayCopy.scaleMax],
          [rgb('#0000FF'), rgb('#FF0000')],
        ).interpolate(interpolateHslLong);

        // context.translate(labelWidth + margin.left, margin.top + 5);

        // console.log('allData before draw:', allData);
        if (colorScale) {
          allData.forEach((row, rowIndex) => {
            row.forEach((value, colIndex) => {
              // console.log('Drawing allDatacanvas square:', colIndex, value);
              drawCanvasSquare(
                context,
                colIndex,
                value,
                rowIndex,
                colorScale!,
                rectWidth,
                rectHeight,
              );
            });
          });
        } else {
          console.error('Color scale is undefined');
        }

        resetScaleCallback();
        redrawLegend = true;
      }

      if (
        (isCanvasBlank(canvas) || redrawLegend || displayCopy.scaleChanged) &&
        context
      ) {
        // Draw the color legend
        context.save();
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

        // Create white background for legend
        context.fillStyle = 'white';
        context.fillRect(0, margin.top, labelWidth, plotHeight);

        const gradientHeight = plotHeight - margin.top - margin.bottom;
        const barWidth = 15;
        const barX = 5;
        const barY = margin.top;
        const labelX = barX + barWidth + 8;
        const totalRange =
          (displayCopy.scaleMax ?? 0) - (displayCopy.scaleMin ?? -130);

        // Draw color gradient bar
        for (let y = 0; y < gradientHeight; y++) {
          const fraction = y / gradientHeight;
          const dbVal = (displayCopy.scaleMax ?? 0) - fraction * totalRange;
          const dbValColor = colorScale?.(dbVal) ?? 'black';
          context.fillStyle = dbValColor;
          context.fillRect(barX, barY + y, barWidth, 1);
        }

        // Draw labels at 5 dB intervals
        context.font = '12px Arial';
        context.textAlign = 'left';
        context.fillStyle = 'black';

        const dbStep = 5; // Draw label every 5 dB
        const maxDb = Math.ceil((displayCopy.scaleMax ?? 0) / dbStep) * dbStep;
        const minDb =
          Math.floor((displayCopy.scaleMin ?? -130) / dbStep) * dbStep;

        // Draw dB value labels with units
        for (let dbVal = maxDb; dbVal >= minDb; dbVal -= dbStep) {
          const fraction = ((displayCopy.scaleMax ?? 0) - dbVal) / totalRange;
          const y = margin.top + fraction * gradientHeight;

          // Only draw if within the gradient bounds
          if (y >= margin.top && y <= margin.top + gradientHeight) {
            context.fillText(`${dbVal} dBm`, labelX, y + 4);
          }
        }

        // Restore the transform
        context.restore();
        setScaleChanged(false);
      }

      if (context) {
        if (colorScale) {
          // Save the current transform
          context.save();

          // Apply the correct transform for the main plot
          context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
          context.translate(labelWidth + margin.left, margin.top);

          // Draw all data points
          allData.forEach((row, rowIndex) => {
            row.forEach((value, colIndex) => {
              drawCanvasSquare(
                context,
                colIndex,
                value,
                rowIndex,
                colorScale!,
                rectWidth,
                rectHeight,
              );
            });
          });

          // Restore the transform
          context.restore();
        } else {
          console.error('Color scale is undefined');
        }

        // Draw capture indices after drawing the waterfall
        drawCaptureIndices(
          context,
          allData,
          rectHeight,
          canvas.width,
          pixelRatio,
          captureRange.startIndex,
        );
      }
    }
  }

  useEffect(() => {
    if (plotCanvasRef.current) {
      drawWaterfall(plotCanvasRef.current, () => setResetScale(false));
    }
  }, [scan, display]);

  // Separate effect for drawing the highlight box
  useEffect(() => {
    const dimensions = plotDimensionsRef.current;
    const allData = scan.allData as number[][];

    if (
      dimensions &&
      allData &&
      allData.length > 0 &&
      currentCaptureIndex >= captureRange.startIndex &&
      currentCaptureIndex < captureRange.endIndex
    ) {
      drawHighlightBox(
        allData,
        currentCaptureIndex,
        dimensions.rectWidth,
        dimensions.rectHeight,
      );
    }
  }, [currentCaptureIndex, scan.allData, captureRange]);

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !plotDimensionsRef.current) return;

    const rect = canvas.getBoundingClientRect();
    const x = event.clientX - rect.left;
    const y = event.clientY - rect.top;

    // Ignore clicks in the legend area (left side)
    if (x < labelWidth + margin.left) return;

    const { rectHeight } = plotDimensionsRef.current;
    const clickedIndex = Math.floor((y - margin.top) / rectHeight);

    // Validate the index is within bounds
    const allData = scan.allData as number[][];
    if (clickedIndex >= 0 && clickedIndex < allData.length) {
      onCaptureSelect(captureRange.startIndex + clickedIndex);
    }
  };

  return (
    <div style={{ width: '100%', height: '500px', position: 'relative' }}>
      {captureRange.startIndex > 0 && (
        <div
          style={upIndicatorStyle}
          title="More captures above"
          onClick={() => {
            const newIndex = Math.max(
              0,
              captureRange.startIndex - WATERFALL_MAX_ROWS,
            );
            onCaptureSelect(newIndex);
          }}
        />
      )}
      <canvas ref={plotCanvasRef} style={{ display: 'block' }} />
      <canvas
        ref={overlayCanvasRef}
        style={{ display: 'block', cursor: 'pointer' }}
        onClick={handleCanvasClick}
      />
      {captureRange.endIndex < totalCaptures && (
        <div
          style={downIndicatorStyle}
          title="More captures below"
          onClick={() => {
            const newIndex = Math.min(
              totalCaptures - 1,
              captureRange.startIndex + WATERFALL_MAX_ROWS,
            );
            onCaptureSelect(newIndex);
          }}
        />
      )}
    </div>
  );
}

function drawCanvasSquare(
  ctx: CanvasRenderingContext2D,
  xValue: number,
  yValue: number,
  yPos: number,
  colorScale: (value: number) => string | CanvasGradient | CanvasPattern,
  rectWidth: number,
  rectHeight: number,
) {
  const adjustedWidth = Math.ceil(rectWidth); // Ensure we don't get gaps
  const adjustedHeight = Math.ceil(rectHeight);
  ctx.fillStyle = colorScale(yValue);
  ctx.fillRect(
    Math.floor(xValue * rectWidth), // Prevent fractional positioning
    Math.floor(yPos * rectHeight),
    adjustedWidth,
    adjustedHeight,
  );
}

function isCanvasBlank(canvas: HTMLCanvasElement) {
  const context = canvas.getContext('2d');
  if (!context) throw new Error('Canvas context is null');

  const pixelBuffer = new Uint32Array(
    context.getImageData(0, 0, canvas.width, canvas.height).data.buffer,
  );
  return !pixelBuffer.some((color) => color !== 0);
}

export { WaterfallPlot };
