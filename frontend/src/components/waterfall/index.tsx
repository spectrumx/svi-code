import { useEffect, useState } from 'react';
import _ from 'lodash';

import { Periodogram } from './Periodogram';
import { WaterfallPlot } from './WaterfallPlot';
import { WaterfallSettings } from '../../pages/WaterfallPage';
import {
  Chart,
  Data,
  DataPoint,
  FloatArray,
  ScanState,
  WaterfallType,
  RadioHoundCapture,
  Display,
  ApplicationType,
} from './types';

// const initialOptions: ScanOptionsType = {
//   selectedNodes: [],
//   startingFrequency: 1990,
//   endingFrequency: 2010,
//   centerFrequency: 2000,
//   gain: 1,
//   nsamples: 1024,
//   interval: 0.2, // handler for recurring scan
//   bandwidth: 20,
//   errors: {},
//   selectedGroups: [],
//   rbw: 23437.5,
//   showLiveData: false,
//   archiveResult: true,
//   m4s: false,
//   siggen: false,
//   siggen_ip: '10.173.170.235',
//   siggen_power: -30,
//   siggen_freq: 2000,
//   option: 1,
//   hw_versions_selected: [],
//   mode: 'compatibility',
//   scaleMax: -30,
//   scaleMin: -110,
//   algorithm: 'Cubic',
// };

const initialDisplay: Display = {
  resetScale: false,
  scaleChanged: false,
  scaleMax: -30,
  scaleMin: -110,
  scan_boundaries: 0,
  max_hold: false,
  ref_lock: false,
  ref_level: undefined,
  ref_range: undefined,
  ref_interval: undefined,
  maxHoldValues: {},
};

const initialChart: Chart = {
  theme: 'light2',
  animationEnabled: false,
  zoomEnabled: true,
  zoomType: 'xy',
  title: {
    text: '',
  },
  exportEnabled: true,
  data: [
    {
      _id: undefined as string | undefined,
      type: 'line',
      dataPoints: [{ x: 1, y: 0 }],
      name: 'template',
      showInLegend: false,
    },
  ] as Data[],
  axisX: {
    title: '-',
  },
  axisY: {
    interval: 10,
    includeZero: false,
    viewportMinimum: -100,
    viewportMaximum: -40,
    title: 'dBm per bin',
    absoluteMinimum: undefined as number | undefined,
    absoluteMaximum: undefined as number | undefined,
  },
  key: 0,
};

const initialScan: ScanState = {
  isScanActive: false,
  lastScanOptions: undefined,
  receivedHeatmap: false,
  scansRequested: 0,
  allData: [] as Data[],
  yMin: 100000,
  yMax: -100000,
  xMin: 100000,
  xMax: -100000,
  spinner: false,
  heatmapData: [] as Data[],
  scaleMin: undefined as number | undefined,
  scaleMax: undefined as number | undefined,
};

export const WATERFALL_MAX_ROWS = 80;

interface WaterfallVisualizationProps {
  data: RadioHoundCapture[];
  settings: WaterfallSettings;
  setSettings: React.Dispatch<React.SetStateAction<WaterfallSettings>>;
}

const WaterfallVisualization = ({
  data,
  settings,
  setSettings,
}: WaterfallVisualizationProps) => {
  const currentApplication = ['PERIODOGRAM', 'WATERFALL'] as ApplicationType[];
  const [displayedCaptureIndex, setDisplayedCaptureIndex] = useState(
    settings.captureIndex,
  );
  const [waterfallRange, setWaterfallRange] = useState({
    startIndex: 0,
    endIndex: 0,
  });

  const [scan, setScan] = useState<ScanState>(initialScan);
  const [display, setDisplay] = useState<Display>(initialDisplay);
  const [chart, setChart] = useState<Chart>(initialChart);

  const setScaleChanged = (scaleChanged: boolean) => {
    setDisplay((prevDisplay) => ({
      ...prevDisplay,
      scaleChanged,
    }));
  };
  const setResetScale = (resetScale: boolean) => {
    setDisplay((prevDisplay) => ({
      ...prevDisplay,
      resetScale,
    }));
  };
  const setWaterfall = (waterfall: WaterfallType) => {
    const localScaleMin = waterfall.scaleMin ?? scan.scaleMin;
    const localScaleMax = waterfall.scaleMax ?? scan.scaleMax;
    const tmpData = _.cloneDeep(waterfall.allData ?? scan.allData);
    // if (waterfall.periodogram !== undefined) {
    //   tmpData.push(waterfall.periodogram);
    // }
    while (tmpData.length > WATERFALL_MAX_ROWS) {
      tmpData.shift();
    }
    const tmpScan = _.cloneDeep(scan);
    tmpScan.allData = tmpData;
    tmpScan.yMin = Math.min(Number(waterfall.yMin), tmpScan.yMin);
    tmpScan.yMax = Math.max(Number(waterfall.yMax), tmpScan.yMax);
    tmpScan.xMin = waterfall.xMin;
    tmpScan.xMax = waterfall.xMax;
    tmpScan.scaleMin = localScaleMin;
    tmpScan.scaleMax = localScaleMax;
    if (!_.isEqual(tmpScan, scan)) {
      setScan(tmpScan);
    }
  };

  const processPeriodogramData = (input: RadioHoundCapture) => {
    let dataArray: FloatArray | number[] | undefined;
    let arrayLength: number | undefined = Number(input.metadata?.xcount);
    const pointArr: DataPoint[] = [];
    let yValue: number | undefined,
      xValue: number,
      fMin: number,
      fMax: number,
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
        console.error('Invalid data, not processing', input['data']);
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
      fMax = Number(input.center_frequency) + Number(input.sample_rate) / 2;
      freqStep = Number(input.sample_rate) / Number(input.metadata?.nfft);
      centerFreq = input.center_frequency;
    } else {
      // NEW Icarus
      fMin = Number(input.metadata.xstart);
      fMax = Number(input.metadata.xstop);
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

    const tmpDisplay = _.cloneDeep(display);

    const yValues = dataArray?.map((i) =>
      Math.round(10 * Math.log10(i * 1000)),
    );
    minValue = yValues ? _.min(yValues) : undefined;
    maxValue = yValues ? _.max(yValues) : undefined;

    if (
      input.mac_address &&
      (display.maxHoldValues[input.mac_address] === undefined ||
        dataArray?.length !== display.maxHoldValues[input.mac_address].length)
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
          // if (yValue < minValue) { minValue = yValue; }
          // if (yValue > maxValue) { maxValue = yValue; }

          if (display.max_hold) {
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

    if (_.isEqual(currentApplication, ['WATERFALL'])) {
      tmpChart.axisX.title = '';
      tmpChart.data[nextIndex].showInLegend = false;
      tmpChart.data[nextIndex].name = input.short_name;
    }

    if (
      display.max_hold &&
      display.maxHoldValues[input.mac_address].length > 0
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

      if (!_.isEqual(display, tmpDisplay)) {
        setDisplay(tmpDisplay);
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

    if (display.ref_level !== undefined) {
      tmpChart.axisY.viewportMaximum = display.ref_level;
    }
    if (display.ref_range !== undefined) {
      tmpChart.axisY.viewportMinimum =
        Number(display.ref_level) - display.ref_range;
    }
    if (display.ref_interval !== undefined) {
      tmpChart.axisY.interval = display.ref_interval;
    }

    if (currentApplication.includes('PERIODOGRAM')) {
      tmpChart.axisX.minimum = fMin / 1e6;
      tmpChart.axisX.maximum = fMax / 1e6;
    } else {
      delete tmpChart.axisX.minimum;
      delete tmpChart.axisX.maximum;
    }

    if (!_.isEqual(chart, tmpChart)) {
      tmpChart.key = Math.random();
      setChart(tmpChart);
      setDisplayedCaptureIndex(settings.captureIndex);
    }
  };

  /**
   * Processes multiple captures for the waterfall display
   */
  const processWaterfallData = (captures: RadioHoundCapture[]) => {
    const processedData: number[][] = [];
    let globalMinValue = 100000;
    let globalMaxValue = -100000;
    let xMin = Infinity;
    let xMax = -Infinity;

    captures.forEach((capture) => {
      let dataArray: FloatArray | number[] | undefined;
      // const arrayLength = Number(capture.metadata?.xcount);

      if (typeof capture.data === 'string') {
        if (capture.data.slice(0, 8) === 'AAAAAAAA') {
          console.error('Invalid data, skipping capture');
          return;
        }
        dataArray = binaryStringToFloatArray(capture.data, capture.type);
      } else {
        dataArray = capture.data;
      }

      if (!dataArray) return;

      // Convert to dB values
      // const intArray: number[] = [];
      const yValues = dataArray.map((i) =>
        Math.round(10 * Math.log10(i * 1000)),
      );

      // Update global min/max
      const minValue = _.min(yValues);
      const maxValue = _.max(yValues);
      globalMinValue = minValue
        ? Math.min(globalMinValue, minValue)
        : globalMinValue;
      globalMaxValue = maxValue
        ? Math.max(globalMaxValue, maxValue)
        : globalMaxValue;

      // Update x range
      let currentXMin = Infinity;
      let currentXMax = -Infinity;
      if (capture.metadata?.xstart && capture.metadata?.xstop) {
        currentXMin = capture.metadata.xstart;
        currentXMax = capture.metadata.xstop;
      } else if (capture.center_frequency && capture.sample_rate) {
        currentXMin = capture.center_frequency - capture.sample_rate / 2;
        currentXMax = capture.center_frequency + capture.sample_rate / 2;
      }
      xMin = Math.min(xMin, currentXMin);
      xMax = Math.max(xMax, currentXMax);

      // Store processed values
      processedData.push(Array.from(yValues));
    });

    setDisplay((prevDisplay) => ({
      ...prevDisplay,
      scaleMin: globalMinValue,
      scaleMax: globalMaxValue,
    }));

    // Update waterfall state
    const newWaterfall: WaterfallType = {
      allData: processedData,
      xMin: xMin / 1e6,
      xMax: xMax / 1e6,
      yMin: globalMinValue,
      yMax: globalMaxValue,
      scaleMin: globalMinValue,
      scaleMax: globalMaxValue,
    };

    setWaterfall(newWaterfall);
  };

  useEffect(() => {
    // Process single capture for periodogram
    console.log('Processing periodogram data');
    processPeriodogramData(data[settings.captureIndex]);
    console.log('Periodogram data processed');
  }, [data, settings.captureIndex]);

  useEffect(() => {
    const pageSize = WATERFALL_MAX_ROWS;

    // Check if the requested index is outside current window
    const isOutsideCurrentWindow =
      settings.captureIndex < waterfallRange.startIndex ||
      settings.captureIndex >= waterfallRange.endIndex;

    if (isOutsideCurrentWindow) {
      // Calculate new start index only when moving outside current window
      const idealStartIndex =
        Math.floor(settings.captureIndex / pageSize) * pageSize;
      const lastPossibleStartIndex = Math.max(0, data.length - pageSize);
      const startIndex = Math.min(idealStartIndex, lastPossibleStartIndex);
      const endIndex = Math.min(data.length, startIndex + pageSize);

      // Only reprocess waterfall if the range has changed
      if (
        startIndex !== waterfallRange.startIndex ||
        endIndex !== waterfallRange.endIndex
      ) {
        const relevantCaptures = data.slice(startIndex, endIndex);
        console.log('Processing waterfall data');
        processWaterfallData(relevantCaptures);
        console.log('Waterfall data processed');
        setWaterfallRange({ startIndex, endIndex });
      }
    }
  }, [data, settings.captureIndex, waterfallRange]);

  const handleCaptureSelect = (index: number) => {
    // Update the settings with the new capture index
    setSettings((prev) => ({
      ...prev,
      captureIndex: index,
    }));
  };

  return (
    <>
      <h5>Capture {displayedCaptureIndex + 1}</h5>
      <Periodogram chart={chart} />
      <br />
      <WaterfallPlot
        scan={scan}
        display={display}
        setWaterfall={setWaterfall}
        setScaleChanged={setScaleChanged}
        setResetScale={setResetScale}
        currentCaptureIndex={settings.captureIndex}
        onCaptureSelect={handleCaptureSelect}
        captureRange={waterfallRange}
      />
    </>
  );
};

export const binaryStringToFloatArray = (
  base64: string,
  dataTypeStr?: string,
): FloatArray | undefined => {
  const bStr = atob(base64);
  const len = bStr.length;
  let dataValues: FloatArray | undefined;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = bStr.charCodeAt(i);
  }
  // use bytes.buffer
  if (dataTypeStr === 'float64') {
    dataValues = new Float64Array(bytes.buffer, 0, len / 8);
  } else if (dataTypeStr === 'float32' || !dataTypeStr) {
    // Assume float32 if not specified
    dataValues = new Float32Array(bytes.buffer, 0, len / 4);
    // } else if (dataTypeStr==='float16') {
    //     dataValues = new Float16Array(dBuf,0,len/2);
  } else {
    console.error('Cannot convert data type: ' + dataTypeStr);
  }
  return dataValues;
};

export function formatHertz(bytes: number, decimals = 2) {
  if (bytes === 0) return 'MHz';

  const k = 1000;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Hz', 'KHz', 'MHz', 'GHz'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export { WaterfallVisualization };
