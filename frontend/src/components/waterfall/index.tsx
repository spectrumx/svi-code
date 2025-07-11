import { useEffect, useState, useMemo } from 'react';
import _ from 'lodash';

import { Periodogram } from './Periodogram';
import { WaterfallPlot } from './WaterfallPlot';
import {
  Chart,
  Data,
  DataPoint,
  FloatArray,
  ScanState,
  ScanWaterfallType,
  WaterfallFile,
  Display,
  WaterfallSettings,
} from './types';
import { formatHertz } from '../../utils/utils';
import { WATERFALL_MAX_ROWS } from './WaterfallVizContainer';

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
  allData: [],
  yMin: 100000,
  yMax: -100000,
  xMin: 100000,
  xMax: -100000,
  spinner: false,
  heatmapData: [] as Data[],
  scaleMin: undefined as number | undefined,
  scaleMax: undefined as number | undefined,
};

interface WaterfallVisualizationProps {
  waterfallFiles: WaterfallFile[];
  settings: WaterfallSettings;
  setSettings: React.Dispatch<React.SetStateAction<WaterfallSettings>>;
  onSave?: () => void;
  onWaterfallRangeChange?: (range: {
    startIndex: number;
    endIndex: number;
  }) => void;
  totalSlices?: number; // For DigitalRF captures
  isLoadingWaterfallRange?: boolean; // Loading state for waterfall range changes
}

const WaterfallVisualization: React.FC<WaterfallVisualizationProps> = ({
  waterfallFiles,
  settings,
  setSettings,
  onSave,
  onWaterfallRangeChange,
  totalSlices,
  isLoadingWaterfallRange,
}: WaterfallVisualizationProps) => {
  const [displayedFileIndex, setDisplayedFileIndex] = useState(
    settings.fileIndex,
  );
  const [currentWaterfallRange, setCurrentWaterfallRange] = useState({
    startIndex: 0,
    endIndex: 0,
  });
  const [desiredWaterfallRange, setDesiredWaterfallRange] = useState({
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
  const setScanWaterfall = (waterfall: ScanWaterfallType) => {
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

  // Process all files once and store the results
  const processedData = useMemo(() => {
    return waterfallFiles.map((waterfallFile) => {
      let floatArray: FloatArray | number[] | undefined;

      if (typeof waterfallFile.data === 'string') {
        if (waterfallFile.data.slice(0, 8) === 'AAAAAAAA') {
          return { floatArray: undefined, dbValues: undefined };
        }
        floatArray = binaryStringToFloatArray(
          waterfallFile.data,
          waterfallFile.data_type,
        );
      } else {
        // Old RH data
        floatArray = waterfallFile.data;
      }

      if (!floatArray) {
        return { floatArray: undefined, dbValues: undefined };
      }

      const dbValues = floatArray.map((i) =>
        Math.round(10 * Math.log10(i * 1000)),
      ) as FloatArray | number[];

      return { floatArray, dbValues };
    });
  }, [waterfallFiles]);

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

  /**
   * Processes a single file for the periodogram display
   */
  const processPeriodogramData = (
    waterfallFile: WaterfallFile,
    processedValues: (typeof processedData)[number],
  ) => {
    console.log('waterfallFile', waterfallFile);
    console.log('processedValues', processedValues);
    let fMin: number;
    let fMax: number;

    const requested = waterfallFile.custom_fields?.requested;

    // Multiple branches to handle both new and old RH data
    if (requested && requested.min_frequency && requested.max_frequency) {
      fMin = requested.min_frequency;
      fMax = requested.max_frequency;
    } else if (waterfallFile.min_frequency && waterfallFile.max_frequency) {
      fMin = waterfallFile.min_frequency;
      fMax = waterfallFile.max_frequency;
    } else if (waterfallFile.center_frequency) {
      fMin = waterfallFile.center_frequency - waterfallFile.sample_rate / 2;
      fMax = waterfallFile.center_frequency + waterfallFile.sample_rate / 2;
    } else {
      throw new Error('No frequency range found');
    }

    let freqStep: number;
    let centerFreq: number;

    // Multiple branches to handle both new and old RH data
    if (waterfallFile.center_frequency) {
      freqStep = waterfallFile.sample_rate / waterfallFile.num_samples;
      centerFreq = waterfallFile.center_frequency;
    } else {
      freqStep = waterfallFile.sample_rate / waterfallFile.num_samples;
      centerFreq = (fMax + fMin) / 2;
    }

    const tmpDisplay = _.cloneDeep(display);

    // Use pre-processed data
    const dataArray = processedValues.floatArray;

    if (
      display.maxHoldValues[waterfallFile.mac_address] === undefined ||
      dataArray?.length !==
        display.maxHoldValues[waterfallFile.mac_address].length
    ) {
      tmpDisplay.maxHoldValues[waterfallFile.mac_address] = [];
    }

    const yValues = processedValues.dbValues;
    const arrayLength = dataArray?.length;
    const pointArr: DataPoint[] = [];
    let yValue: number | undefined;
    let xValue: number;

    if (dataArray && arrayLength && yValues) {
      for (let i = 0; i < arrayLength; i++) {
        yValue = yValues[i];
        if (yValue !== undefined) {
          xValue = (fMin + i * freqStep) / 1000000;
          pointArr.push({ x: xValue, y: yValue });

          if (display.max_hold) {
            if (
              tmpDisplay.maxHoldValues[waterfallFile.mac_address].length <= i
            ) {
              tmpDisplay.maxHoldValues[waterfallFile.mac_address].push({
                x: xValue,
                y: yValue,
              });
            } else {
              const maxHoldValuesY =
                tmpDisplay.maxHoldValues[waterfallFile.mac_address][i].y;

              if (maxHoldValuesY && yValue > maxHoldValuesY) {
                tmpDisplay.maxHoldValues[waterfallFile.mac_address][i] = {
                  x: xValue,
                  y: yValue,
                };
              }
            }
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
        (element) => element._id === waterfallFile.mac_address,
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
        waterfallFile.device_name +
        ' (' +
        waterfallFile.mac_address.substring(
          waterfallFile.mac_address.length - 4,
        ) +
        ')',
      toolTipContent: waterfallFile.device_name + ': {x}, {y}',
      _id: waterfallFile.mac_address,
    };

    // Ensure axisX exists and isn't an array.
    // IMPORTANT: This is what allows us to assert that axisX exists in the
    // following code with the ! operator.
    if (!('axisX2' in tmpChart) || Array.isArray(tmpChart.axisX2)) {
      tmpChart.axisX2 = {};
    }

    tmpChart.axisX2!.title =
      'Frequency ' + (centerFreq ? formatHertz(centerFreq) : '');

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

    if (
      display.max_hold &&
      display.maxHoldValues[waterfallFile.mac_address].length > 0
    ) {
      nextIndex = tmpChart.data.findIndex(
        (element) => element._id === 'maxhold_' + waterfallFile.mac_address,
      );
      if (nextIndex === -1) {
        nextIndex = tmpChart.data.length;
      }

      tmpChart.data[nextIndex] = {
        ..._.cloneDeep(tmpChart.data[nextIndex - 1]),
        name:
          'Max Hold (' +
          waterfallFile.mac_address.substring(
            waterfallFile.mac_address.length - 4,
          ) +
          ')',
        _id: 'maxhold_' + waterfallFile.mac_address,
        dataPoints: tmpDisplay.maxHoldValues[waterfallFile.mac_address],
        toolTipContent: 'Max : {x}, {y}',
      };

      if (!_.isEqual(display, tmpDisplay)) {
        setDisplay(tmpDisplay);
      }
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

    tmpChart.axisX2!.minimum = fMin / 1e6;
    tmpChart.axisX2!.maximum = fMax / 1e6;

    // Move dummy series to the end of the data array to maintain correct data
    // series colors
    if (tmpChart.data[0].name === 'template') {
      tmpChart.data.push(tmpChart.data.shift()!);
    }

    if (!_.isEqual(chart, tmpChart)) {
      tmpChart.key = Math.random();
      setChart(tmpChart);
      setDisplayedFileIndex(settings.fileIndex);
    }
  };

  /**
   * Processes multiple files for the waterfall display
   */
  const processWaterfallData = (
    waterfallFiles: WaterfallFile[],
    processedValues: typeof processedData,
  ) => {
    const processedWaterfallData: number[][] = [];
    let globalMinValue = 100000;
    let globalMaxValue = -100000;
    let xMin = Infinity;
    let xMax = -Infinity;

    waterfallFiles.forEach((waterfallFile, index) => {
      const processedFile = processedValues[index];
      const yValues = processedFile.dbValues;

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
      if (waterfallFile.center_frequency && waterfallFile.sample_rate) {
        currentXMin =
          waterfallFile.center_frequency - waterfallFile.sample_rate / 2;
        currentXMax =
          waterfallFile.center_frequency + waterfallFile.sample_rate / 2;
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
    const newWaterfall: ScanWaterfallType = {
      allData: processedWaterfallData,
      xMin: xMin / 1e6,
      xMax: xMax / 1e6,
      yMin: globalMinValue,
      yMax: globalMaxValue,
      scaleMin: globalMinValue,
      scaleMax: globalMaxValue,
    };

    setScanWaterfall(newWaterfall);
  };

  useEffect(() => {
    // Process single file for periodogram
    if (
      isLoadingWaterfallRange ||
      !_.isEqual(desiredWaterfallRange, currentWaterfallRange) ||
      waterfallFiles.length === 0 ||
      processedData.length === 0 ||
      settings.fileIndex < currentWaterfallRange.startIndex ||
      settings.fileIndex > currentWaterfallRange.endIndex
    ) {
      return;
    }

    processPeriodogramData(
      waterfallFiles[settings.fileIndex - currentWaterfallRange.startIndex],
      processedData[settings.fileIndex - currentWaterfallRange.startIndex],
    );
  }, [
    waterfallFiles,
    processedData,
    settings.fileIndex,
    isLoadingWaterfallRange,
    desiredWaterfallRange,
    currentWaterfallRange,
  ]);

  // Determine whether to update the waterfall range based on the current file
  // index, and if so, process the new waterfall data
  useEffect(() => {
    if (isLoadingWaterfallRange) return;

    if (!_.isEqual(desiredWaterfallRange, currentWaterfallRange)) {
      console.log('Processing waterfall data after loading new files');
      processWaterfallData(waterfallFiles, processedData);
      setCurrentWaterfallRange(desiredWaterfallRange);
      return;
    }

    const pageSize = WATERFALL_MAX_ROWS;
    const totalFiles = totalSlices || waterfallFiles.length;

    // Check if the requested index is outside current window
    const isOutsideCurrentWindow =
      settings.fileIndex < currentWaterfallRange.startIndex ||
      settings.fileIndex >= currentWaterfallRange.endIndex;

    if (isOutsideCurrentWindow) {
      // Calculate new start index only when moving outside current window
      const idealStartIndex =
        Math.floor(settings.fileIndex / pageSize) * pageSize;
      const lastPossibleStartIndex = Math.max(0, totalFiles - pageSize);
      const startIndex = Math.min(idealStartIndex, lastPossibleStartIndex);
      const endIndex = Math.min(totalFiles - 1, startIndex + pageSize - 1);

      // Only reprocess waterfall if the range has changed
      if (
        startIndex !== currentWaterfallRange.startIndex ||
        endIndex !== currentWaterfallRange.endIndex
      ) {
        if (totalSlices && waterfallFiles.length < totalSlices) {
          // If we don't have all the files, we need to get the correct files
          setDesiredWaterfallRange({ startIndex, endIndex });
          if (onWaterfallRangeChange) {
            onWaterfallRangeChange({ startIndex, endIndex });
          }
        } else {
          // If we have all the files, we can just use the waterfallFiles
          const relevantFiles = waterfallFiles.slice(startIndex, endIndex);
          const relevantProcessedValues = processedData.slice(
            startIndex,
            endIndex,
          );
          setDesiredWaterfallRange({ startIndex, endIndex });
          setCurrentWaterfallRange({ startIndex, endIndex });
          console.log('Processing waterfall data after simple range change');
          processWaterfallData(relevantFiles, relevantProcessedValues);
        }
      }
    }
  }, [
    waterfallFiles,
    processedData,
    settings.fileIndex,
    currentWaterfallRange,
    desiredWaterfallRange,
    isLoadingWaterfallRange,
    onWaterfallRangeChange,
    totalSlices,
  ]);

  // Handle realtime playback
  useEffect(() => {
    if (!settings.isPlaying || settings.playbackSpeed !== 'realtime') return;

    const totalFiles = totalSlices || waterfallFiles.length;

    // Pre-compute timestamps for all files
    const timestamps = waterfallFiles.map((waterfallFile) =>
      waterfallFile.timestamp ? Date.parse(waterfallFile.timestamp) : 0,
    );

    // Store the start time and reference points
    const startTimestamp = timestamps[settings.fileIndex];
    const startTime = Date.now();

    const realtimeInterval = setInterval(() => {
      const elapsedRealTime = Date.now() - startTime;

      setSettings((prev) => {
        let targetIndex = prev.fileIndex;
        while (targetIndex < timestamps.length - 1) {
          const nextTimestamp = timestamps[targetIndex + 1];
          if (nextTimestamp - startTimestamp > elapsedRealTime) {
            break;
          }
          targetIndex++;
        }

        if (targetIndex !== prev.fileIndex) {
          return {
            ...prev,
            fileIndex: targetIndex,
            isPlaying: targetIndex < totalFiles - 1,
          };
        }
        return prev;
      });
    }, 20);

    return () => clearInterval(realtimeInterval);
  }, [
    settings.isPlaying,
    settings.playbackSpeed,
    waterfallFiles.length,
    totalSlices,
    setSettings,
  ]);

  // Handle constant FPS playback
  useEffect(() => {
    if (!settings.isPlaying || settings.playbackSpeed === 'realtime') return;

    const totalFiles = totalSlices || waterfallFiles.length;

    // Calculate interval time based on playback speed
    const speed = Number(settings.playbackSpeed.replace(' fps', ''));
    if (isNaN(speed) || speed <= 0) return;

    const intervalTime = 1000 / speed;
    const playbackInterval = setInterval(() => {
      setSettings((prev) => {
        const nextIndex = prev.fileIndex + 1;
        // Stop playback at the end
        if (nextIndex >= totalFiles) {
          return { ...prev, isPlaying: false };
        }
        return { ...prev, fileIndex: nextIndex };
      });
    }, intervalTime);

    return () => clearInterval(playbackInterval);
  }, [
    settings.isPlaying,
    settings.playbackSpeed,
    waterfallFiles.length,
    totalSlices,
    setSettings,
  ]);

  const handleRowSelect = (index: number) => {
    // Update the settings with the new file index
    setSettings((prev) => ({
      ...prev,
      fileIndex: index,
      isPlaying: false,
    }));
  };

  return (
    <div>
      {onSave && (
        <div className="d-flex justify-content-end mb-3">
          <button
            className="btn btn-primary"
            onClick={onSave}
            aria-label="Export Waterfall"
          >
            <i className="bi bi-download me-2" />
            Export
          </button>
        </div>
      )}
      <div style={{ position: 'relative' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
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
          <WaterfallPlot
            scan={scan}
            display={display}
            setWaterfall={setScanWaterfall}
            setScaleChanged={setScaleChanged}
            setResetScale={setResetScale}
            currentFileIndex={settings.fileIndex}
            onRowSelect={handleRowSelect}
            fileRange={currentWaterfallRange}
            totalFiles={waterfallFiles.length}
            colorLegendWidth={PLOTS_LEFT_MARGIN}
            indexLegendWidth={PLOTS_RIGHT_MARGIN}
          />
        </div>
      </div>
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

export { WaterfallVisualization };
