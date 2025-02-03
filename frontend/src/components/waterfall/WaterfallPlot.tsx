import { useRef, useEffect } from 'react';
import _ from 'lodash';
import { scaleLinear, interpolateHslLong, rgb } from 'd3';

import { ScanState, WaterfallType, ScanOptionsType, Display } from './types';
import { WATERFALL_MAX_ROWS } from './index';

interface WaterfallPlotProps {
  scan: ScanState;
  options: ScanOptionsType;
  display: Display;
  setWaterfall: (waterfall: WaterfallType) => void;
  setScaleChanged: (scaleChanged: boolean) => void;
  setResetScale: (resetScale: boolean) => void;
}

function WaterfallPlot({
  scan,
  options,
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
    const optionsCopy = _.cloneDeep(options);
    const allData = scanCopy.allData as number[][];
    let redrawLegend = 0;

    console.log('in processWaterfall: scan object', scan);
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
      const { startingFrequency, endingFrequency } = optionsCopy;
      const maxSize = WATERFALL_MAX_ROWS; //that.maxSize = that.seconds * that.jobsPerSecond;
      const rectHeight = height / maxSize;
      const rectWidth = width / (endingFrequency - startingFrequency);
      console.log('rectWidth, rectHeight:', rectWidth, rectHeight);

      let { yMin, yMax } = scanCopy;
      const { scaleMin, scaleMax } = displayCopy;

      const x = scaleLinear().range([0, width]);
      x.domain([0, allData[0].length - 1]);

      const y = scaleLinear().range([0, height]);
      y.domain([0, maxSize]);

      // console.log('scalemin/max', waterfall.display.scaleMin, waterfall.display.scaleMax)
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
        console.log('rescaling and redrawing');
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

        // We made a dispatch call to reset the min/max values
        // But, unset periodogram so we aren't duplicating it inside allData
        scanCopy.periodogram = undefined;
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
              console.log('color scale is undefined');
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
        // Legend
        context.setTransform(1, 0, 0, 1, 0, 0);
        context.translate(0, 5);
        let dbVal: number;
        let skipCount = 0;
        let saveDbVal = -20;
        context.fillStyle = 'white';
        context.fillRect(0, 0, labelWidth, height);
        for (let legend = 0; legend < height + 2; legend++) {
          dbVal = -130 + ((height - legend) / height) * 90;
          if (skipCount === 0) {
            context.fillStyle = 'black';
            saveDbVal = Math.ceil(dbVal / 10) * 10;
            //context.fillText(saveDbVal + 'dBm', margin.left + 20, legend + 3);
            context.fillText(String(saveDbVal), margin.left + 25, legend + 3);
            context.fillText('dBm', margin.left + 25, legend + 12);
            skipCount++;
          }

          if (Math.ceil(dbVal / 10) * 10 < saveDbVal) {
            skipCount = 0;
          }
          const dbValColor = colorScale?.(dbVal) ?? 'black';
          context.strokeStyle = dbValColor;
          context.fillStyle = dbValColor;
          if (
            dbVal > Number(displayCopy.scaleMin) &&
            dbVal < Number(displayCopy.scaleMax)
          ) {
            context.fillRect(2, legend, 20, 1);
          }
        }
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

        console.log('Drawing all waterfalldata');
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
              console.log('color scale is undefined');
            }
          });
        });
      }
    }
  }

  useEffect(() => {
    if (canvasRef.current) {
      processWaterfall(canvasRef.current, () => setResetScale(false));
    }
  }, [scan, options, display]);

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
  ctx.fillStyle = colorScale(yValue);
  ctx.fillRect(xValue * rectWidth, yPos * rectHeight, rectWidth, rectHeight);
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
