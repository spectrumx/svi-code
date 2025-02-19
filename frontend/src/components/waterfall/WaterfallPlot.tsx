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
}

function WaterfallPlot({
  scan,
  display,
  setWaterfall,
  setScaleChanged,
  setResetScale,
  currentCaptureIndex,
}: WaterfallPlotProps) {
  const plotCanvasRef = useRef<HTMLCanvasElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const plotDimensionsRef = useRef<{
    rectWidth: number;
    rectHeight: number;
  } | null>(null);

  const labelWidth = 60;
  const margin = {
    top: 5,
    left: 5,
    bottom: 5,
    right: 10,
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

  // Function to draw highlight box on overlay canvas
  function drawHighlightBox(
    allData: number[][],
    currentIndex: number,
    rectWidth: number,
    rectHeight: number,
  ) {
    console.log('Drawing highlight box');
    const overlayCanvas = overlayCanvasRef.current;
    if (!overlayCanvas) return;

    const context = overlayCanvas.getContext('2d');
    if (!context) return;

    const pixelRatio = window.devicePixelRatio || 1;

    // Clear the entire overlay canvas including the transformed area
    context.save();
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    context.restore();

    // Set up the transform for the highlight box
    context.save();
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.translate(labelWidth + margin.left, margin.top);

    // Calculate position for highlight box
    const boxY = Math.floor(currentIndex * rectHeight);
    const boxWidth = Math.ceil(allData[0].length * rectWidth);

    // Draw the highlight box
    context.strokeStyle = '#ff00ff'; // purple
    context.lineWidth = 2;
    context.strokeRect(0, boxY, boxWidth, rectHeight);

    // Restore the original transform
    context.restore();
  }

  function drawWaterfall(
    canvas: HTMLCanvasElement,
    resetScaleCallback: () => void,
  ) {
    const scanCopy = _.cloneDeep(scan);
    const displayCopy = _.cloneDeep(display);
    const allData = scanCopy.allData as number[][];
    let redrawLegend = 0;

    if (allData && allData.length > 0) {
      const context = canvas.getContext('2d');
      if (!context) return;

      const pixelRatio = window.devicePixelRatio || 1;

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
        redrawLegend = 1;
      }

      if (
        (isCanvasBlank(canvas) || redrawLegend || displayCopy.scaleChanged) &&
        context
      ) {
        // Draw the color legend
        // Reset the canvas transform matrix and move down 5 pixels
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.translate(0, 5);

        let lastDrawnVal: number | undefined = undefined;

        // Create white background for legend
        context.fillStyle = 'white';
        context.fillRect(0, 0, labelWidth, plotHeight);

        // Iterate through each pixel height of the legend
        for (let legendPixel = 0; legendPixel < plotHeight + 2; legendPixel++) {
          // Calculate dB value for this position
          const dbVal =
            scaleMin && scaleMax
              ? scaleMin +
                ((plotHeight - legendPixel) / plotHeight) *
                  (scaleMax - scaleMin)
              : -130 + ((plotHeight - legendPixel) / plotHeight) * 90;
          const dbValRounded = Math.round(dbVal);

          // If the dB value is less than the minimum scale value,
          // stop drawing labels
          if (scaleMin && dbVal < scaleMin) {
            break;
          }

          // Add text labels at every multiple of 10 dB
          if (dbValRounded % 10 === 0 && dbValRounded !== lastDrawnVal) {
            context.fillStyle = 'black';
            context.fillText(
              String(dbValRounded),
              margin.left + 25,
              legendPixel + 3,
            );
            lastDrawnVal = dbValRounded;
            context.fillText('dBm', margin.left + 25, legendPixel + 12);
          }

          // Get color for this dB value using the same color scale as the main plot
          const dbValColor = colorScale?.(dbVal) ?? 'black';
          context.strokeStyle = dbValColor;
          context.fillStyle = dbValColor;

          // Draw a colored line if the value is within the current scale range
          if (
            dbVal > Number(displayCopy.scaleMin) &&
            dbVal < Number(displayCopy.scaleMax)
          ) {
            context.fillRect(2, legendPixel, 20, 1);
          }
        }

        // Move context back for main plot
        context.translate(labelWidth + margin.left, margin.top);
        setScaleChanged(false);
      }

      if (context) {
        console.log('Drawing all data');
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
      }
    }
  }

  // Effect for drawing the waterfall plot
  useEffect(() => {
    if (plotCanvasRef.current) {
      console.log('Drawing waterfall');
      drawWaterfall(plotCanvasRef.current, () => setResetScale(false));
      console.log('Waterfall drawn');
    }
  }, [scan, display]); // Remove currentCaptureIndex from dependencies

  // Separate effect for drawing the highlight box
  useEffect(() => {
    const dimensions = plotDimensionsRef.current;
    const allData = scan.allData as number[][];

    if (
      dimensions &&
      allData &&
      allData.length > 0 &&
      currentCaptureIndex >= 0 &&
      currentCaptureIndex < allData.length
    ) {
      drawHighlightBox(
        allData,
        currentCaptureIndex,
        dimensions.rectWidth,
        dimensions.rectHeight,
      );
    }
  }, [currentCaptureIndex, scan.allData]); // Only redraw highlight when these change

  return (
    <div style={{ width: '100%', height: '500px', position: 'relative' }}>
      <canvas ref={plotCanvasRef} style={{ display: 'block' }} />
      <canvas ref={overlayCanvasRef} style={{ display: 'block' }} />
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
