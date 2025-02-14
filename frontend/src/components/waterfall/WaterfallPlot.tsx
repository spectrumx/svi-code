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
}

function WaterfallPlot({
  scan,
  display,
  setWaterfall,
  setScaleChanged,
  setResetScale,
}: WaterfallPlotProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Update canvas size only once on mount
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const container = canvas.parentElement;
    if (!container) return;

    // Get the container's width
    const { width } = container.getBoundingClientRect();

    // Set canvas width to match container width, accounting for device pixel ratio
    const pixelRatio = window.devicePixelRatio || 1;
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = 500 * pixelRatio; // Maintain 500px height, adjusted for pixel ratio

    // Scale the canvas CSS size back down
    canvas.style.width = `${width}px`;
    canvas.style.height = '500px';

    // Adjust canvas context for high DPI displays
    const context = canvas.getContext('2d');
    if (context) {
      context.scale(pixelRatio, pixelRatio);
    }
  }, []); // Empty dependency array means this only runs once on mount

  function processWaterfall(
    canvas: HTMLCanvasElement,
    resetScaleCallback: () => void,
  ) {
    const scanCopy = _.cloneDeep(scan);
    const displayCopy = _.cloneDeep(display);
    const allData = scanCopy.allData as number[][];
    let redrawLegend = 0;

    if (allData && allData.length > 0) {
      const context = canvas.getContext('2d');
      const labelWidth = 60;
      const margin = {
        top: 5,
        left: 5,
        //left: canvas.width / 20,
        bottom: 3,
        right: 10,
      };
      const width = canvas.width - margin.left - margin.right - labelWidth;
      const height = canvas.height - margin.top - margin.bottom;
      const rectWidth = width / allData[0].length;
      const rectHeight = height / Math.min(allData.length, WATERFALL_MAX_ROWS);

      let { yMin, yMax } = scanCopy;
      const { scaleMin, scaleMax } = displayCopy;

      // const x = scaleLinear().range([0, width]);
      // x.domain([0, allData[0].length - 1]);

      // const y = scaleLinear().range([0, height]);
      // y.domain([0, maxSize]);

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
        allData.forEach((row, rowIndex) => {
          row.forEach((value, colIndex) => {
            if (colorScale) {
              // console.log('Drawing allDatacanvas square:', colIndex, value);
              drawCanvasSquare(
                context,
                colIndex,
                value,
                rowIndex,
                colorScale,
                rectWidth,
                rectHeight,
              );
            } else {
              console.error('color scale is undefined');
            }
          });
        });

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
        context.fillRect(0, 0, labelWidth, height);

        // Iterate through each pixel height of the legend
        for (let legendPixel = 0; legendPixel < height + 2; legendPixel++) {
          // Calculate dB value for this position
          const dbVal =
            scaleMin && scaleMax
              ? scaleMin +
                ((height - legendPixel) / height) * (scaleMax - scaleMin)
              : -130 + ((height - legendPixel) / height) * 90;
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
        // // Copy existing plot and move it down one row.
        // //console.log(labelWidth, margin.top, width, height-rectHeight);
        // const periodogram = context.getImageData(
        //   labelWidth,
        //   margin.top,
        //   width + 5,
        //   height - rectHeight,
        // );
        // context.putImageData(periodogram, labelWidth, rectHeight + margin.top);

        // Draw all data at once instead of moving existing data
        allData.forEach((row, rowIndex) => {
          row.forEach((value, colIndex) => {
            if (colorScale) {
              // console.log('Drawing dataset canvas square:', colIndex, value);
              drawCanvasSquare(
                context,
                colIndex,
                value,
                rowIndex,
                colorScale,
                rectWidth,
                rectHeight,
              );
            } else {
              console.error('color scale is undefined');
            }
          });
        });
      }
    }
  }

  useEffect(() => {
    if (canvasRef.current) {
      console.log('Drawing waterfall');
      processWaterfall(canvasRef.current, () => setResetScale(false));
      console.log('Waterfall drawn');
    }
  }, [scan, display]);

  return (
    <div style={{ width: '100%', height: '500px' }}>
      <canvas ref={canvasRef} style={{ display: 'block' }} />
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
  const adjustedWidth = Math.max(rectWidth, 1);
  const adjustedHeight = Math.max(rectHeight, 1);
  ctx.fillStyle = colorScale(yValue);
  ctx.fillRect(
    xValue * rectWidth,
    yPos * rectHeight,
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
