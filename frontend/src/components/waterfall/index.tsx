import { useEffect, useState, useMemo } from 'react';
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

// Desired margins for both periodogram and waterfall plots
const PLOTS_LEFT_MARGIN = 85;
const PLOTS_RIGHT_MARGIN = 30;
// Approximate CanvasJS built-in margins we need to adjust for
const CANVASJS_LEFT_MARGIN = 5;
const CANVASJS_RIGHT_MARGIN = 10;

const initialChart: Chart = {
  theme: 'light2',
  animationEnabled: false,
  title: {},
  data: [
    {
      // Dummy data series so we can manipulate axisX
      _id: undefined as string | undefined,
      type: 'line',
      dataPoints: [{ x: undefined, y: undefined }],
      name: 'template',
      showInLegend: false,
    },
  ],
  // Hide axisX and remove margin
  axisX: {
    tickLength: 0,
    labelFontSize: 0,
    labelPlacement: 'inside',
    lineThickness: 0,
    margin: 0,
  },
  axisX2: {
    interval: 2,
    title: '-',
    titlePadding: 15,
    titleFontSize: 16,
    titleFontWeight: 'bold',
    labelFontWeight: 'bold',
    labelAngle: 90,
  },
  axisY: {
    interval: 20,
    includeZero: false,
    viewportMinimum: -100,
    viewportMaximum: -40,
    tickLength: 0,
    labelPlacement: 'inside',
    labelBackgroundColor: 'white',
    labelFormatter: (e) => {
      // Replace minus sign with longer dash symbol for better readability
      return e.value.toString().replace('-', '\u{2012}');
    },
    labelFontWeight: 'bold',
    labelPadding: 0,
    gridColor: '#EEEEEE',
    margin: PLOTS_LEFT_MARGIN - CANVASJS_LEFT_MARGIN,
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

const WaterfallVisualization: React.FC<WaterfallVisualizationProps> = ({
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

  // Process all captures once and store the results
  const processedData = useMemo(() => {
    return data.map((capture) => {
      let floatArray: FloatArray | number[] | undefined;

      if (typeof capture.data === 'string') {
        if (capture.data.slice(0, 8) === 'AAAAAAAA') {
          return { floatArray: undefined, dbValues: undefined };
        }
        floatArray = binaryStringToFloatArray(capture.data, capture.type);
      } else {
        floatArray = capture.data;
      }

      if (!floatArray) {
        return { floatArray: undefined, dbValues: undefined };
      }

      const dbValues = floatArray.map((i) =>
        Math.round(10 * Math.log10(i * 1000)),
      ) as FloatArray | number[];

      return { floatArray, dbValues };
    });
  }, [data]);

  const globalYAxisRange = useMemo(() => {
    let globalMin = Infinity;
    let globalMax = -Infinity;

    processedData.forEach(({ dbValues }) => {
      if (!dbValues) return;

      const minValue = _.min(dbValues);
      const maxValue = _.max(dbValues);

      if (minValue !== undefined) globalMin = Math.min(globalMin, minValue);
      if (maxValue !== undefined) globalMax = Math.max(globalMax, maxValue);
    });

    return {
      min: globalMin !== Infinity ? globalMin : undefined,
      max: globalMax !== -Infinity ? globalMax : undefined,
    };
  }, [processedData]);

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

  /**
   * Processes a single capture for the periodogram display
   */
  const processPeriodogramData = (
    input: RadioHoundCapture,
    processedValues: (typeof processedData)[number],
  ) => {
    let dataArray: FloatArray | number[] | undefined;
    let arrayLength: number | undefined = Number(input.metadata?.xcount);
    const pointArr: DataPoint[] = [];
    let yValue: number | undefined,
      xValue: number,
      fMin: number,
      fMax: number,
      freqStep: number,
      centerFreq: number | undefined;
    const minArray: DataPoint[] = [];
    let m4sMin: FloatArray | undefined;
    const maxArray: DataPoint[] = [];
    let m4sMax: FloatArray | undefined;
    const meanArray: DataPoint[] = [];
    let m4sMean: FloatArray | undefined;
    const medianArray: DataPoint[] = [];
    let m4sMedian: FloatArray | undefined;

    // Use pre-processed data
    dataArray = processedValues.floatArray;
    const yValues = processedValues.dbValues;
    arrayLength = dataArray?.length;

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

    if (
      input.mac_address &&
      (display.maxHoldValues[input.mac_address] === undefined ||
        dataArray?.length !== display.maxHoldValues[input.mac_address].length)
    ) {
      tmpDisplay.maxHoldValues[input.mac_address] = [];
    }

    if (dataArray && arrayLength && yValues) {
      for (let i = 0; i < arrayLength; i++) {
        yValue = yValues[i];
        if (yValue !== undefined) {
          xValue = (fMin + i * freqStep) / 1000000;
          pointArr.push({ x: xValue, y: yValue });

          if (display.max_hold) {
            if (tmpDisplay.maxHoldValues[input.mac_address].length <= i) {
              tmpDisplay.maxHoldValues[input.mac_address].push({
                x: xValue,
                y: yValue,
              });
            } else {
              const maxHoldValuesY =
                tmpDisplay.maxHoldValues[input.mac_address][i].y;

              if (maxHoldValuesY && yValue > maxHoldValuesY) {
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
    let nextIndex = 0;

    if (tmpChart.data === undefined) {
      tmpChart.data = [];
    } else if (tmpChart.data[0].name === 'template') {
      nextIndex = 1;
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
      axisXType: 'secondary',
      showInLegend: true,
      name:
        input.short_name +
        ' (' +
        input.mac_address?.substring(input.mac_address.length - 4) +
        ')',
      toolTipContent: input.short_name + ': {x}, {y}',
      _id: input.mac_address,
    };

    // Ensure axisX exists and isn't an array.
    // IMPORTANT: This is what allows us to assert that axisX exists in the
    // following code with the ! operator.
    if (!('axisX2' in tmpChart) || Array.isArray(tmpChart.axisX2)) {
      tmpChart.axisX2 = {};
    }

    tmpChart.axisX2!.title =
      'Frequency ' + (centerFreq ? formatHertz(centerFreq) : '');
    if (input.requested) {
      tmpChart.axisX2!.title += input.requested.rbw
        ? ', RBW ' + formatHertz(input.requested.rbw)
        : '';
      tmpChart.axisX2!.title += input.requested.span
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
      tmpChart.axisX2!.title = '';
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

    // Hide legend if there is only one data series to show in the legend
    let seriesWithLegendIndex = -1;
    let showLegend = false;
    for (let i = 0; i < tmpChart.data.length; i++) {
      if (tmpChart.data[i].showInLegend) {
        if (seriesWithLegendIndex === -1) {
          // We've found the first series to show in the legend
          seriesWithLegendIndex = i;
        } else {
          // We've found a second series to show in the legend
          showLegend = true;
          break;
        }
      }
    }
    if (seriesWithLegendIndex !== -1 && !showLegend) {
      tmpChart.data[seriesWithLegendIndex].showInLegend = false;
    }

    // Ensure axisY exists and isn't an array.
    // IMPORTANT: This is what allows us to assert that axisY exists in the
    // following code with the ! operator.
    if (!('axisY' in tmpChart) || Array.isArray(tmpChart.axisY)) {
      tmpChart.axisY = {};
    }

    // Determine viewing area based off global min/max
    if (globalYAxisRange.max !== undefined) {
      tmpChart.axisY!.viewportMaximum = globalYAxisRange.max + 10;
    }
    if (globalYAxisRange.min !== undefined) {
      tmpChart.axisY!.viewportMinimum = globalYAxisRange.min - 10;
    }

    if (display.ref_level !== undefined) {
      tmpChart.axisY!.viewportMaximum = display.ref_level;
    }
    if (display.ref_range !== undefined) {
      tmpChart.axisY!.viewportMinimum =
        Number(display.ref_level) - display.ref_range;
    }
    if (display.ref_interval !== undefined) {
      tmpChart.axisY!.interval = display.ref_interval;
    }

    if (currentApplication.includes('PERIODOGRAM')) {
      tmpChart.axisX2!.minimum = fMin / 1e6;
      tmpChart.axisX2!.maximum = fMax / 1e6;
    } else {
      delete tmpChart.axisX2!.minimum;
      delete tmpChart.axisX2!.maximum;
    }

    // Move dummy series to the end of the data array to maintain correct data
    // series colors
    if (tmpChart.data[0].name === 'template') {
      tmpChart.data.push(tmpChart.data.shift()!);
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
  const processWaterfallData = (
    captures: RadioHoundCapture[],
    processedValues: typeof processedData,
  ) => {
    const processedWaterfallData: number[][] = [];
    let globalMinValue = 100000;
    let globalMaxValue = -100000;
    let xMin = Infinity;
    let xMax = -Infinity;

    captures.forEach((capture, index) => {
      const processedCapture = processedValues[index];
      const yValues = processedCapture.dbValues;

      if (!yValues) return;

      // Update global min/max
      const minValue = _.min(yValues);
      const maxValue = _.max(yValues);
      globalMinValue =
        minValue !== undefined
          ? Math.min(globalMinValue, minValue)
          : globalMinValue;
      globalMaxValue =
        maxValue !== undefined
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
      processedWaterfallData.push(Array.from(yValues));
    });

    setDisplay((prevDisplay) => ({
      ...prevDisplay,
      scaleMin: globalMinValue,
      scaleMax: globalMaxValue,
    }));

    // Update waterfall state
    const newWaterfall: WaterfallType = {
      allData: processedWaterfallData,
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
    processPeriodogramData(
      data[settings.captureIndex],
      processedData[settings.captureIndex],
    );
  }, [data, processedData, settings.captureIndex]);

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
        const relevantProcessedValues = processedData.slice(
          startIndex,
          endIndex,
        );
        processWaterfallData(relevantCaptures, relevantProcessedValues);
        setWaterfallRange({ startIndex, endIndex });
      }
    }
  }, [data, processedData, settings.captureIndex, waterfallRange]);

  // Handle realtime playback
  useEffect(() => {
    if (!settings.isPlaying || settings.playbackSpeed !== 'realtime') return;

    // Pre-compute timestamps for all captures
    const timestamps = data.map((capture) =>
      capture.timestamp ? Date.parse(capture.timestamp) : 0,
    );

    // Store the start time and reference points
    const startTimestamp = timestamps[settings.captureIndex];
    const startTime = Date.now();

    const realtimeInterval = setInterval(() => {
      const elapsedRealTime = Date.now() - startTime;

      setSettings((prev) => {
        let targetIndex = prev.captureIndex;
        while (targetIndex < timestamps.length - 1) {
          const nextTimestamp = timestamps[targetIndex + 1];
          if (nextTimestamp - startTimestamp > elapsedRealTime) {
            break;
          }
          targetIndex++;
        }

        if (targetIndex !== prev.captureIndex) {
          return {
            ...prev,
            captureIndex: targetIndex,
            isPlaying: targetIndex < data.length - 1,
          };
        }
        return prev;
      });
    }, 20);

    return () => clearInterval(realtimeInterval);
  }, [settings.isPlaying, settings.playbackSpeed, data.length, setSettings]);

  // Handle constant FPS playback
  useEffect(() => {
    if (!settings.isPlaying || settings.playbackSpeed === 'realtime') return;

    // Calculate interval time based on playback speed
    const speed = Number(settings.playbackSpeed.replace(' fps', ''));
    if (isNaN(speed) || speed <= 0) return;

    const intervalTime = 1000 / speed;
    const playbackInterval = setInterval(() => {
      setSettings((prev) => {
        const nextIndex = prev.captureIndex + 1;
        // Stop playback at the end
        if (nextIndex >= data.length) {
          return { ...prev, isPlaying: false };
        }
        return { ...prev, captureIndex: nextIndex };
      });
    }, intervalTime);

    return () => clearInterval(playbackInterval);
  }, [settings.isPlaying, settings.playbackSpeed, data.length, setSettings]);

  const handleCaptureSelect = (index: number) => {
    // Update the settings with the new capture index
    setSettings((prev) => ({
      ...prev,
      captureIndex: index,
      isPlaying: false,
    }));
  };

  return (
    <div>
      <h5>
        Capture {displayedCaptureIndex + 1} (
        {data[displayedCaptureIndex].timestamp} UTC)
      </h5>
      <Periodogram
        chartOptions={chart}
        chartContainerStyle={{
          height: 200,
          paddingRight: PLOTS_RIGHT_MARGIN - CANVASJS_RIGHT_MARGIN,
          paddingTop: 0,
          paddingBottom: 0,
        }}
        yAxisTitle="dBm per bin"
      />
      {/* Div to test left plot margins */}
      {/* <div
        style={{ width: PLOTS_LEFT_MARGIN, height: 30, backgroundColor: 'red' }}
      /> */}
      {/* Div to test right plot margins */}
      {/* <div
        style={{
          width: PLOTS_RIGHT_MARGIN,
          height: 30,
          backgroundColor: 'blue',
          float: 'right',
        }}
      /> */}
      <WaterfallPlot
        scan={scan}
        display={display}
        setWaterfall={setWaterfall}
        setScaleChanged={setScaleChanged}
        setResetScale={setResetScale}
        currentCaptureIndex={settings.captureIndex}
        onCaptureSelect={handleCaptureSelect}
        captureRange={waterfallRange}
        totalCaptures={data.length}
        colorLegendWidth={PLOTS_LEFT_MARGIN}
        indexLegendWidth={PLOTS_RIGHT_MARGIN}
      />
    </div>
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
