import { useEffect } from 'react';
import _ from 'lodash';

// @ts-ignore
import CanvasJSReact from '@canvasjs/react-charts';

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

const { CanvasJSChart } = CanvasJSReact;

interface PeriodogramProps {
  data: PeriodogramType;
  currentApplication: Application;
  scanOptions: ScanOptionsType;
  scanDisplay: Display;
  setScanDisplay: (display: Display) => void;
  chart: Chart;
  setChart: (chart: Chart) => void;
  setWaterfall: (waterfall: WaterfallType) => void;
}

function Periodogram({
  data,
  currentApplication,
  scanOptions,
  scanDisplay,
  setScanDisplay,
  chart,
  setChart,
  setWaterfall,
}: PeriodogramProps) {
  const processPeriodogram = (input: PeriodogramType) => {
    let dataArray: FloatArray | number[] | undefined;
    let arrayLength: number | undefined = Number(input.metadata?.xcount);
    const pointArr: DataPoint[] = [];
    const intArray: number[] = [];
    let yValue: number | undefined,
      xValue: number,
      fMin: number,
      freqStep: number,
      centerFreq: number | undefined;
    let minValue: number | undefined = 1000000;
    let maxValue: number | undefined = -1000000;
    let nextIndex: number;
    const minArray: DataPoint[] = [];
    let m4sMin: FloatArray | undefined;
    const maxArray: DataPoint[] = [];
    let m4sMax: FloatArray | undefined;
    const meanArray: DataPoint[] = [];
    let m4sMean: FloatArray | undefined;
    const medianArray: DataPoint[] = [];
    let m4sMedian: FloatArray | undefined;

    // Check for Base64 encoding and decode it
    if (
      typeof input.data === 'string'
      // && input.metadata?.data_type === 'periodogram'
    ) {
      // Null data can get base64 encoded and sent along which appears as all A's
      // Check start of string for A's and skip processing.
      if (input.data.slice(0, 8) === 'AAAAAAAA') {
        console.log('Invalid data, not processing', input['data']);
        return;
      }
      // console.log("data before decoding: ", input['data']);
      // console.log("bytestring", String.fromCharCode.apply(input['data']))
      dataArray = binaryStringToFloatArray(input['data'], input['type']);
      arrayLength = dataArray?.length;
      // console.log("Decoding B64 data to:",dataArray);
    } else {
      dataArray = input.data;
    }

    if (input.metadata?.xstart == null) {
      // OLD
      fMin = Number(input.center_frequency) - Number(input.sample_rate) / 2;
      freqStep = Number(input.sample_rate) / Number(input.metadata?.nfft);
      centerFreq = input.center_frequency;
    } else {
      // NEW Icarus
      fMin = Number(input.metadata.xstart);
      freqStep =
        (Number(input.metadata.xstop) - Number(input.metadata.xstart)) /
        Number(input.metadata.xcount);
      centerFreq =
        (Number(input.metadata.xstop) + Number(input.metadata.xstart)) / 2;
    }

    if (input.m4s_min && input.m4s_max && input.m4s_mean && input.m4s_median) {
      m4sMin = binaryStringToFloatArray(input.m4s_min, input.type);
      m4sMax = binaryStringToFloatArray(input.m4s_max, input.type);
      m4sMean = binaryStringToFloatArray(input.m4s_mean, input.type);
      m4sMedian = binaryStringToFloatArray(input.m4s_median, input.type);
    }

    const tmpDisplay = _.cloneDeep(scanDisplay);

    const yValues = dataArray?.map((i) =>
      Math.round(10 * (Math.log(i * 1000) / Math.log(10))),
    );
    minValue = yValues && Math.min(...Array.from(yValues));
    maxValue = yValues && Math.max(...Array.from(yValues));

    if (
      input.mac_address &&
      (scanDisplay.maxHoldValues[input.mac_address] === undefined ||
        dataArray?.length !==
          scanDisplay.maxHoldValues[input.mac_address].length)
    ) {
      // console.log('resetting', dataArray.length, scan_display.maxHoldValues[input.mac_address].length)
      tmpDisplay.maxHoldValues[input.mac_address] = [];
    }

    if (dataArray && arrayLength) {
      for (let i = 0; i < arrayLength; i++) {
        if (dataArray[i] > 0) {
          // yValue = Math.round(10 * ((Math.log(dataArray[i] * 1000)) / Math.log(10)));
          yValue = yValues?.[i];
        } else {
          yValue = dataArray[i];
        }

        if (yValue) {
          xValue = (fMin + i * freqStep) / 1000000;
          //console.log("xvalue:",xValue,"yValue:",yValue);
          pointArr.push({ x: xValue, y: yValue });
          intArray.push(Math.floor(yValue)); //waterfall wants int values so it's less data to keep
          // if (yValue < minValue) { minValue = yValue; }
          // if (yValue > maxValue) { maxValue = yValue; }

          if (scanDisplay.max_hold) {
            // console.log("comparing", yValue,tmp_display.maxHoldValues[input.mac_address][i], tmp_display.maxHoldValues[input.mac_address].length)
            if (tmpDisplay.maxHoldValues[input.mac_address].length <= i) {
              tmpDisplay.maxHoldValues[input.mac_address].push({
                x: xValue,
                y: yValue,
              });
            } else {
              const maxHoldValuesY =
                tmpDisplay.maxHoldValues[input.mac_address][i].y;

              if (maxHoldValuesY && yValue > maxHoldValuesY) {
                //compare y value
                tmpDisplay.maxHoldValues[input.mac_address][i] = {
                  x: xValue,
                  y: yValue,
                };
              }
            }
          }

          if ('m4s_min' in input) {
            minArray.push({ x: xValue, y: m4sMin?.[i] });
            maxArray.push({ x: xValue, y: m4sMax?.[i] });
            meanArray.push({ x: xValue, y: m4sMean?.[i] });
            medianArray.push({ x: xValue, y: m4sMedian?.[i] });
          }
        }
      }
    }

    const tmpChart = _.cloneDeep(chart);

    if (tmpChart.data === undefined || tmpChart.data[0].name === 'template') {
      tmpChart.data = [];
      nextIndex = 0;
    } else {
      //Find index for this node
      nextIndex = tmpChart.data.findIndex(
        (element) => element._id === input.mac_address,
      );
      if (nextIndex === -1) {
        nextIndex = tmpChart.data.length;
        // tmpChart.data[nextIndex] = [];
      }
    }

    tmpChart.data[nextIndex] = {
      dataPoints: pointArr,
      type: 'line',
      showInLegend: true,
      name:
        input.short_name +
        ' (' +
        input.mac_address?.substring(input.mac_address.length - 4) +
        ')',
      toolTipContent: input.short_name + ': {x}, {y}',
      _id: input.mac_address,
    };
    tmpChart.axisX.title =
      'Frequency ' + (centerFreq ? formatHertz(centerFreq) : '');
    if (input.requested) {
      tmpChart.axisX.title += input.requested.rbw
        ? ', RBW ' + formatHertz(input.requested.rbw)
        : '';
      tmpChart.axisX.title += input.requested.span
        ? ', Span ' + formatHertz(input.requested.span)
        : '';
    }
    // if (CurrentApplication === DEFS.APPLICATION_PERIODOGRAM_MULTI)
    // {
    // }
    // else if (CurrentApplication === DEFS.APPLICATION_PERIODOGRAM_SINGLE ||
    //   CurrentApplication === DEFS.APPLICATION_PERIODOGRAM ||
    //   CurrentApplication === DEFS.APPLICATION_ARCHIVE)
    // {
    //   chart.axisX.title +=  ' - ' + input.short_name
    //     + " (" + input.mac_address.substring(input.mac_address.length - 4) + ')';
    // }

    if (currentApplication === 'WATERFALL') {
      tmpChart.axisX.title = '';
      tmpChart.data[nextIndex].showInLegend = false;
      tmpChart.data[nextIndex].name = input.short_name;
    }

    if (
      scanDisplay.max_hold &&
      scanDisplay.maxHoldValues[input.mac_address].length > 0
    ) {
      nextIndex = tmpChart.data.findIndex(
        (element) => element._id === 'maxhold_' + input.mac_address,
      );
      if (nextIndex === -1) {
        nextIndex = tmpChart.data.length;
      }

      tmpChart.data[nextIndex] = {
        ..._.cloneDeep(tmpChart.data[nextIndex - 1]),
        name:
          'Max Hold (' +
          input.mac_address?.substring(input.mac_address.length - 4) +
          ')',
        _id: 'maxhold_' + input.mac_address,
        dataPoints: tmpDisplay.maxHoldValues[input.mac_address],
        toolTipContent: 'Max : {x}, {y}',
      };

      if (!_.isEqual(scanDisplay, tmpDisplay)) {
        setScanDisplay(tmpDisplay);
      }
    }

    if ('m4s_min' in input) {
      nextIndex += 1;
      tmpChart.data[nextIndex] = _.cloneDeep(tmpChart.data[nextIndex - 1]);
      tmpChart.data[nextIndex].name = 'M4S Min';
      tmpChart.data[nextIndex].dataPoints = minArray;
      tmpChart.data[nextIndex].toolTipContent = 'Min : {x}, {y}';

      nextIndex += 1;
      tmpChart.data[nextIndex] = _.cloneDeep(tmpChart.data[nextIndex - 1]);
      tmpChart.data[nextIndex].name = 'M4S Max';
      tmpChart.data[nextIndex].dataPoints = maxArray;
      tmpChart.data[nextIndex].toolTipContent = 'Max : {x}, {y}';

      nextIndex += 1;
      tmpChart.data[nextIndex] = _.cloneDeep(tmpChart.data[nextIndex - 1]);
      tmpChart.data[nextIndex].name = 'M4S Mean';
      tmpChart.data[nextIndex].dataPoints = meanArray;
      tmpChart.data[nextIndex].toolTipContent = 'Mean : {x}, {y}';

      nextIndex += 1;
      tmpChart.data[nextIndex] = _.cloneDeep(tmpChart.data[nextIndex - 1]);
      tmpChart.data[nextIndex].name = 'M4S Median';
      tmpChart.data[nextIndex].dataPoints = medianArray;
      tmpChart.data[nextIndex].toolTipContent = 'Median : {x}, {y}';
    }

    // Waterfall data follows
    if (currentApplication.includes('WATERFALL')) {
      const newWaterfall = {
        periodogram: intArray,
        xMin: Number(input.metadata?.xstart),
        xMax: Number(input.metadata?.xstop),
        yMin: minValue,
        yMax: maxValue,
      };
      //waterfall.periodogram = [];
      //waterfall.allData.push(intArray);
      //waterfall.maxSize = DEFS.WATERFALL_MAX_ROWS;
      //while (waterfall.allData.length > waterfall.maxSize) {
      //waterfall.allData.shift();
      //}
      // console.log("calling dispatch with:", waterfall);
      setWaterfall(newWaterfall);
    }

    // Determine viewing area based off min/max
    if (
      maxValue &&
      (tmpChart.axisY.viewportMaximum === undefined ||
        maxValue > tmpChart.axisY.viewportMaximum)
    ) {
      tmpChart.axisY.viewportMaximum = Number(maxValue) + 10;
      //console.log("resetting maxValue", maxValue);
    }
    if (
      minValue &&
      (tmpChart.axisY.viewportMinimum === undefined ||
        minValue < tmpChart.axisY.viewportMinimum)
      // || minValue * 1.1 < tmpChart.axisY.viewportMinimum
    ) {
      tmpChart.axisY.viewportMinimum = Number(minValue) - 10;
      //console.log("resetting minValue", minValue);
    }

    if (scanDisplay.ref_level !== undefined) {
      tmpChart.axisY.viewportMaximum = scanDisplay.ref_level;
    }
    if (scanDisplay.ref_range !== undefined) {
      tmpChart.axisY.viewportMinimum =
        Number(scanDisplay.ref_level) - scanDisplay.ref_range;
    }
    if (scanDisplay.ref_interval !== undefined) {
      tmpChart.axisY.interval = scanDisplay.ref_interval;
    }

    // If user requests X amount of bandwidth, lock the display to their request.
    // But not for other functions
    if (currentApplication.includes('PERIODOGRAM')) {
      tmpChart.axisX.minimum = scanOptions.startingFrequency;
      tmpChart.axisX.maximum = scanOptions.endingFrequency;
    } else {
      delete tmpChart.axisX.minimum;
      delete tmpChart.axisX.maximum;
    }
    //console.log(chart);
    if (!_.isEqual(chart, tmpChart)) {
      tmpChart.key = Math.random();
      setChart(tmpChart);
    }
    // if (process.env.REACT_APP_ENVIRONMENT === "development")
    // {
    //   console.log("Finished processing periodogram at:", Date.now());
    // }
    return;
  };

  useEffect(() => {
    console.log('Running useEffect in Periodogram');
    processPeriodogram(data);
  }, [data]);

  return (
    <div id="chartCanvas" className="border" style={{ width: '100%' }}>
      <CanvasJSChart options={chart} />
    </div>
  );
}

export { Periodogram };
