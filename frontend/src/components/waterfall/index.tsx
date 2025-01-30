import { useEffect, useState } from 'react';
import _ from 'lodash';

import { Periodogram } from './Periodogram';
import { Waterfall } from './Waterfall';
import { WaterfallSettings } from '../../pages/WaterfallPage';
import {
  Chart,
  Data,
  DataPoint,
  FloatArray,
  ScanState,
  ScanOptionsType,
  WaterfallType,
  PeriodogramType,
  Display,
  ApplicationType,
} from './types';

const initialState: ScanState = {
  isScanActive: false,
  options: {
    selectedNodes: [],
    startingFrequency: 1990,
    endingFrequency: 2010,
    centerFrequency: 2000,
    gain: 1,
    nsamples: 1024,
    interval: 0.2, // handler for recurring scan
    bandwidth: 20,
    errors: {},
    selectedGroups: [],
    rbw: 23437.5,
    showLiveData: false,
    archiveResult: true,
    m4s: false,
    siggen: false,
    siggen_ip: '10.173.170.235',
    siggen_power: -30,
    siggen_freq: 2000,
    option: 1,
    hw_versions_selected: [],
    mode: 'compatibility',
    scaleMax: -30,
    scaleMin: -110,
    algorithm: 'Cubic',
  } as ScanOptionsType,
  display: {
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
  },
  lastScanOptions: undefined as ScanOptionsType | undefined,
  receivedHeatmap: false,
  scansRequested: 0,
  allData: [] as Data[],
  yMin: 100000,
  yMax: -100000,
  xMin: 100000,
  xMax: -100000,
  spinner: false,
  periodogram: undefined,
  chart: {
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
  },
  heatmapData: [] as Data[],
  scaleMin: undefined as number | undefined,
  scaleMax: undefined as number | undefined,
};

export const WATERFALL_MAX_ROWS = 80;

export type Application = ApplicationType | ApplicationType[];

interface WaterfallProps {
  data: PeriodogramType[];
  settings: WaterfallSettings;
}

const WaterfallVisualization = ({ data, settings }: WaterfallProps) => {
  const [displayedCaptureIndex, setDisplayedCaptureIndex] = useState(
    settings.captureIndex,
  );
  const [scan, setScan] = useState<ScanState>(initialState);
  const scanDisplay = scan.display;
  const setScanDisplay = (display: Display) => {
    setScan((prevScan) => ({ ...prevScan, display }));
  };
  const scanOptions = scan.options;
  const setScaleChanged = (scaleChanged: boolean) => {
    setScan((prevScan) => ({
      ...prevScan,
      options: { ...prevScan.options, scaleChanged },
    }));
  };
  const setResetScale = (resetScale: boolean) => {
    setScan((prevScan) => ({
      ...prevScan,
      options: { ...prevScan.options, resetScale },
    }));
  };
  const chart = scan.chart;
  const setChart = (chart: Chart) => {
    setScan((prevScan) => ({ ...prevScan, chart }));
  };
  const setWaterfall = (waterfall: WaterfallType) => {
    console.log('setWaterfall called with:', waterfall);
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
    tmpScan.periodogram = waterfall.periodogram;
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
  const currentApplication = ['PERIODOGRAM', 'WATERFALL'] as Application;

  const processPeriodogramData = (input: PeriodogramType) => {
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

    // // Waterfall data follows
    // if (currentApplication.includes('WATERFALL')) {
    //   const newWaterfall = {
    //     periodogram: intArray,
    //     xMin: Number(input.metadata?.xstart),
    //     xMax: Number(input.metadata?.xstop),
    //     yMin: minValue,
    //     yMax: maxValue,
    //   };
    //   //waterfall.periodogram = [];
    //   //waterfall.allData.push(intArray);
    //   //waterfall.maxSize = DEFS.WATERFALL_MAX_ROWS;
    //   //while (waterfall.allData.length > waterfall.maxSize) {
    //   //waterfall.allData.shift();
    //   //}
    //   console.log('calling dispatch with:', newWaterfall);
    //   setWaterfall(newWaterfall);
    // }

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
      setDisplayedCaptureIndex(settings.captureIndex);
    }
    // if (process.env.REACT_APP_ENVIRONMENT === "development")
    // {
    //   console.log("Finished processing periodogram at:", Date.now());
    // }
    return;
  };

  /**
   * Processes multiple captures for the waterfall display
   */
  const processWaterfallData = (captures: PeriodogramType[]) => {
    const processedData: number[][] = [];
    let globalMinValue = 100000;
    let globalMaxValue = -100000;
    let xMin = Number.MAX_VALUE;
    let xMax = Number.MIN_VALUE;

    captures.forEach((capture) => {
      let dataArray: FloatArray | number[] | undefined;
      // const arrayLength = Number(capture.metadata?.xcount);

      // Process the data array similar to existing logic
      if (typeof capture.data === 'string') {
        if (capture.data.slice(0, 8) === 'AAAAAAAA') {
          console.log('Invalid data, skipping capture');
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
        Math.round(10 * (Math.log(i * 1000) / Math.log(10))),
      );

      // Update global min/max
      const minValue = Math.min(...Array.from(yValues));
      const maxValue = Math.max(...Array.from(yValues));
      globalMinValue = Math.min(globalMinValue, minValue);
      globalMaxValue = Math.max(globalMaxValue, maxValue);

      // Update x range
      const currentXMin = Number(capture.metadata?.xstart);
      const currentXMax = Number(capture.metadata?.xstop);
      xMin = Math.min(xMin, currentXMin);
      xMax = Math.max(xMax, currentXMax);

      // Store processed values
      processedData.push(Array.from(yValues));
    });

    // Trim to maximum rows if needed
    while (processedData.length > WATERFALL_MAX_ROWS) {
      processedData.shift();
    }

    // Update waterfall state
    const newWaterfall: WaterfallType = {
      periodogram: processedData[processedData.length - 1], // Most recent capture for periodogram
      allData: processedData,
      xMin,
      xMax,
      yMin: globalMinValue,
      yMax: globalMaxValue,
      scaleMin: scan.scaleMin,
      scaleMax: scan.scaleMax,
    };

    setWaterfall(newWaterfall);
  };

  useEffect(() => {
    console.log('Running useEffect in WaterfallVisualization');
    // Process single capture for periodogram
    processPeriodogramData(data[settings.captureIndex]);

    // Process all captures for waterfall
    // Determine range of captures to process based on current index
    const startIndex = Math.max(
      0,
      settings.captureIndex - WATERFALL_MAX_ROWS + 1,
    );
    const endIndex = Math.min(data.length, startIndex + WATERFALL_MAX_ROWS);
    const relevantCaptures = data.slice(startIndex, endIndex);
    processWaterfallData(relevantCaptures);
  }, [data, settings.captureIndex]);

  return (
    <>
      <h5>Capture {displayedCaptureIndex + 1}</h5>
      <Periodogram chart={chart} />
      <br />
      <Waterfall
        scan={scan}
        setWaterfall={setWaterfall}
        setScaleChanged={setScaleChanged}
        setResetScale={setResetScale}
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
  } else if (dataTypeStr === 'float32') {
    dataValues = new Float32Array(bytes.buffer, 0, len / 4);
    // } else if (dataTypeStr==='float16') {
    //     dataValues = new Float16Array(dBuf,0,len/2);
  } else {
    console.log('Cannot convert data type: ' + dataTypeStr);
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
