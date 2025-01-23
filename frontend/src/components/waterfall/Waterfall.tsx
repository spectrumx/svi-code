import { useRef, useCallback } from 'react';

import _ from 'lodash';

import {
  Application,
  Display,
  ScanOptionsType,
  Chart,
  WaterfallType,
  PeriodogramType,
  DataPoint,
  FloatArray,
  binaryStringToFloatArray,
  formatHertz,
} from './index';

interface WaterfallProps {
  data: PeriodogramType;
  currentApplication: Application;
  scanDisplay: Display;
  setScanDisplay: (display: Display) => void;
  scanOptions: ScanOptionsType;
  setScanOptions: (options: ScanOptionsType) => void;
  chart: Chart;
  setChart: (chart: Chart) => void;
  waterfall: WaterfallType;
  setWaterfall: (waterfall: WaterfallType) => void;
}

export {};

/*
function Waterfall({
  data,
  currentApplication,
  scanDisplay,
  setScanDisplay,
  scanOptions,
  setScanOptions,
  chart,
  setChart,
  waterfall,
  setWaterfall,
}: WaterfallProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const useProcessWaterfall = () => {
    const waterfall = useAppSelector((state) => state.scan);

    return useCallback(
      function processWaterfall(
        canvas: HTMLCanvasElement,
        resetScaleCallback: () => void,
      ) {
        const waterfallCopy = _.cloneDeep(waterfall);
        const dataset = waterfallCopy.periodogram;
        let redrawLegend = 0;

        // console.log("in ProcessWaterfall: waterfall object", waterfall);
        if (Array.isArray(dataset) && dataset.length > 0) {
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

          const maxSize = DEFS.WATERFALL_MAX_ROWS; //that.maxSize = that.seconds * that.jobsPerSecond;
          const rectHeight = height / maxSize;
          const rectWidth = width / dataset.length;

          let yMin = waterfallCopy.yMin;
          let yMax = waterfallCopy.yMax;

          const x = scaleLinear().range([0, width]);
          //x.domain([xMin, xMax]);
          x.domain([0, dataset.length - 1]);

          const y = scaleLinear().range([0, height]);
          y.domain([0, maxSize]);

          // console.log('scalemin/max', waterfall.display.scaleMin, waterfall.display.scaleMax)
          let color = scaleLinear()
            .domain([
              waterfallCopy.display.scaleMin,
              waterfallCopy.display.scaleMax,
            ])
            .interpolate(interpolateHslLong)
            // .interpolate(d3.interpolate)
            // .interpolate(d3.interpolateHcl)
            .range([rgb('#0000FF'), rgb('#FF0000')]);

          if (waterfallCopy.display.resetScale && context) {
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
            waterfallCopy.allData
              .slice()
              .reverse()
              .forEach(function (data) {
                if (Array.isArray(data)) {
                  data.forEach((element) => {
                    if (yMin === undefined || element < yMin) {
                      yMin = element;
                    }
                    if (yMax === undefined || element > yMax) {
                      yMax = element;
                    }
                  });
                }
              });
            //console.log("new ymin/max:",yMin,yMax);

            //waterfall.display.scaleMin = Math.round(yMin * 100) / 100;
            //waterfall.display.scaleMax = Math.round(yMax * 100) / 100;
            waterfallCopy.display.scaleMin = yMin;
            waterfallCopy.display.scaleMax = yMax;
            if (yMin < waterfallCopy.yMin) {
              waterfallCopy.yMin = yMin;
            }
            if (yMax > waterfallCopy.yMax) {
              waterfallCopy.yMax = yMax;
            }
            // We made a dispatch call to reset the min/max values
            // But, unset periodogram so we aren't duplicating it inside allData
            waterfallCopy.periodogram = undefined;
            dispatch(waterfallSet(waterfallCopy));
            color = scaleLinear()
              .domain([
                waterfallCopy.display.scaleMin,
                waterfallCopy.display.scaleMax,
              ])
              .interpolate(interpolateHslLong)
              // .interpolate(d3.interpolate)
              // .interpolate(d3.interpolateHcl)
              .range([rgb('#0000FF'), rgb('#FF0000')]);

            // context.translate(labelWidth + margin.left, margin.top + 5);

            waterfallCopy.allData
              .slice()
              .reverse()
              .forEach(function (data, index) {
                if (Array.isArray(data)) {
                  data.forEach((element, xIndex) => {
                    drawCanvasSquare(
                      context,
                      xIndex,
                      element,
                      index,
                      color,
                      rectWidth,
                      rectHeight,
                    );
                  });
                }
              });

            resetScaleCallback();
            redrawLegend = 1;
          }

          if (
            (isCanvasBlank(canvas) ||
              redrawLegend ||
              waterfallCopy.display.scaleChanged) &&
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
                context.fillText(
                  String(saveDbVal),
                  margin.left + 25,
                  legend + 3,
                );
                context.fillText('dBm', margin.left + 25, legend + 12);
                skipCount++;
              }

              if (Math.ceil(dbVal / 10) * 10 < saveDbVal) {
                skipCount = 0;
              }
              context.strokeStyle = color(dbVal);
              context.fillStyle = color(dbVal);
              if (
                dbVal > Number(waterfallCopy.display.scaleMin) &&
                dbVal < Number(waterfallCopy.display.scaleMax)
              ) {
                context.fillRect(2, legend, 20, 1);
              }
            }
            context.translate(labelWidth + margin.left, margin.top);
            dispatch(scaleChangedSet(false));
          }

          if (waterfallCopy.periodogram !== undefined && context) {
            // Copy existing plot and move it down one row.
            //console.log(labelWidth, margin.top, width, height-rectHeight);
            const periodogram = context.getImageData(
              labelWidth,
              margin.top,
              width + 5,
              height - rectHeight,
            );
            context.putImageData(
              periodogram,
              labelWidth,
              rectHeight + margin.top,
            );

            // Draw newest data on the top row
            dataset.forEach(function (yValue, index) {
              // console.log('waterfall:', color(yValue), yValue, index);
              if (yValue < Number(waterfallCopy.display.scaleMin)) {
                yValue = Number(waterfallCopy.display.scaleMin);
              }
              if (yValue > Number(waterfallCopy.display.scaleMax)) {
                yValue = Number(waterfallCopy.display.scaleMax);
              }
              drawCanvasSquare(
                context,
                index,
                yValue,
                0,
                color,
                rectWidth,
                rectHeight,
              );
            });
          }
        }
      },
      [dispatch, waterfall],
    );
  };

  return <canvas key="waterfall" ref={canvasRef} width="100%" height="500px" />;
}

export { Waterfall };
*/
