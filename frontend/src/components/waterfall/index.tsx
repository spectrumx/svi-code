import { useState, useEffect, useCallback } from 'react';
import _ from 'lodash';

type DataPoint = {
  x: number;
  y?: number;
  label?: string;
  markerType?: string;
  markerColor?: string;
  markerSize?: number;
};

export type Data = {
  _id?: string;
  type?: string;
  dataPoints?: DataPoint[];
  name?: string;
  showInLegend?: boolean;
  visible?: boolean;
  toolTipContent?: string;
  raw?: number;
  location?: google.maps.LatLng;
  weight?: number;
};

export interface BoundaryMarker {
  value: number;
  labelFontColor: string;
  labelAlign: string;
  lineDashType: string;
  opacity: number;
}

interface Chart {
  theme: string;
  animationEnabled: boolean;
  zoomEnabled: boolean;
  zoomType: string;
  title: {
    text: string;
  };
  exportEnabled: boolean;
  data: Data[];
  axisX: {
    title: string;
    minimum?: number;
    maximum?: number;
    suffix?: string;
    crosshair?: {
      enabled: boolean;
    };
    stripLines?: BoundaryMarker[];
    interval?: number;
  };
  axisY: {
    interval: number;
    includeZero: boolean;
    viewportMinimum?: number;
    viewportMaximum?: number;
    title: string;
    absoluteMinimum: number | undefined;
    absoluteMaximum: number | undefined;
    minimum?: number;
    maximum?: number;
  };
  key: number;
}

interface ScanOptionsCore {
  selectedNodes?: string[];
  startingFrequency: number;
  endingFrequency: number;
  centerFrequency: number;
  gain: number;
  nsamples: number;
  interval: number;
  updateInterval?: number;
  bandwidth: number;
  selectedGroups: string[];
  rbw: number;
  showLiveData: boolean;
  archiveResult: boolean;
  m4s: boolean;
  siggen: boolean;
  siggen_ip: string;
  siggen_power: number;
  siggen_freq: number;
  option: number;
  hw_versions_selected: string[];
  mode: string;
  scaleMax?: number;
  scaleMin?: number;
  scaleChanged?: boolean;
  resetScale?: boolean;
  browserGuid?: string;
  isScanActive?: boolean;
  comments?: string;
  output_topic?: string;
  lat_min?: number;
  lat_max?: number;
  lon_min?: number;
  lon_max?: number;
  sensor?: string;
  algorithm: string;
}

export interface ScanOptionsType extends ScanOptionsCore {
  errors: {
    [K in keyof ScanOptionsCore]?: unknown;
  };
}

export interface Display {
  resetScale: boolean;
  scaleChanged: boolean;
  scaleMax?: number;
  scaleMin?: number;
  scan_boundaries: number;
  max_hold: boolean;
  ref_lock: boolean;
  ref_level: number | undefined;
  ref_range: number | undefined;
  ref_interval: number | undefined;
  markers: {
    index: number;
    freq: number;
    color: string;
    type: string;
    values: (number | undefined)[];
    deleted: boolean;
    to_be_set: boolean;
  }[];
  marker_indexes: (number | undefined)[] | undefined;
  maxHoldValues: { [key: string]: DataPoint[] };
  errors?: ScanOptionsType['errors'];
}

export interface PeriodogramType {
  short_name?: string;
  mac_address: string;
  metadata?: {
    data_type?: string;
    xstart?: number;
    xstop?: number;
    fmin?: number;
    fmax?: number;
    nfft?: number;
    xcount?: number;
    gps_lock?: boolean;
    scan_time?: number;
    archiveResult?: boolean;
  };
  data: number[] | Float32Array | Float64Array | string;
  type?: string;
  sample_rate?: number;
  gain?: number;
  timestamp?: string;
  center_frequency?: number;
  m4s_min?: string;
  m4s_max?: string;
  m4s_mean?: string;
  m4s_median?: string;
  requested?: {
    rbw?: number;
    span: number;
    fmin?: number;
    fmax?: number;
    gain?: number;
    samples?: number;
  };
  latitude?: number;
  longitude?: number;
  altitude?: number;
  batch?: number;
  hardware_version?: string;
  hardware_board_id?: string;
  software_version?: string;
}

type FloatArray = Float32Array | Float64Array;

export interface ScanState {
  isScanActive: boolean;
  options: ScanOptionsType;
  display: Display;
  lastScanOptions: ScanOptionsType | undefined;
  receivedHeatmap: boolean;
  scansRequested: number;
  // I inferred allData's type, but it doesn't seem correct
  allData: (Data | PeriodogramType | number[])[];
  yMin: number;
  yMax: number;
  xMin?: number;
  xMax?: number;
  spinner: boolean;
  periodogram?: PeriodogramType | number[];
  chart: Chart;
  heatmapData: Data[];
  scaleMin: number | undefined;
  scaleMax: number | undefined;
}

interface Waterfall
  extends Pick<ScanState, 'periodogram' | 'xMin' | 'xMax'>,
    Partial<Pick<ScanState, 'scaleMin' | 'scaleMax' | 'yMin' | 'yMax'>> {}

type Application =
  | 'WATERFALL'
  | 'PERIODOGRAM'
  | 'PERIODOGRAM_SINGLE'
  | 'PERIODOGRAM_MULTI';

interface PeriodogramProps {
  data: PeriodogramType;
  startingFrequency: number;
  endingFrequency: number;
  // scaleMin: number;
  // scaleMax: number;
}

export function Periodogram({
  data,
  startingFrequency,
  endingFrequency,
}: // scaleMin,
// scaleMax,
PeriodogramProps) {
  const [chart, setChart] = useState<Chart>({});
  const [scanDisplay, setScanDisplay] = useState<Display>({});
  const [waterfall, setWaterfall] = useState<Waterfall>({});
  const [currentApplication, setCurrentApplication] = useState<
    Application | Application[]
  >('PERIODOGRAM');

  const processPeriodogram = useCallback(
    (input: PeriodogramType) => {
      //console.log("inside ProcessPeriodogram, input:", input);
      let dataArray = input.data.split(',');
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
        typeof input.data === 'string' &&
        input.metadata?.data_type === 'periodogram'
      ) {
        // Null data can get base64 encoded and sent along which appears as all A's
        // Check start of string for A's and skip processing.
        if (input.data.slice(0, 8) == 'AAAAAAAA') {
          console.log('Invalid data, not processing', input['data']);
          return;
        }
        // console.log("data before decoding: ", input['data']);
        // console.log("bytestring", String.fromCharCode.apply(input['data']))
        dataArray = binaryStringToFloatArray(input['data'], input['type']);
        arrayLength = dataArray.length;
        // console.log("Decoding B64 data to:",dataArray);
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

      if (
        input['m4s_min'] &&
        input['m4s_max'] &&
        input['m4s_mean'] &&
        input['m4s_median']
      ) {
        m4sMin = binaryStringToFloatArray(input['m4s_min'], input['type']);
        m4sMax = binaryStringToFloatArray(input['m4s_max'], input['type']);
        m4sMean = binaryStringToFloatArray(input['m4s_mean'], input['type']);
        m4sMedian = binaryStringToFloatArray(
          input['m4s_median'],
          input['type'],
        );
      }

      const tmpDisplay = _.cloneDeep(scanDisplay);
      if (
        scanDisplay.markers !== undefined &&
        scanDisplay.marker_indexes == undefined
      ) {
        tmpDisplay.marker_indexes = [];
      }

      const yValues = dataArray?.map((i) =>
        Math.round(10 * (Math.log(i * 1000) / Math.log(10))),
      );
      minValue = yValues && Math.min(...yValues);
      maxValue = yValues && Math.max(...yValues);

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
            pointArr.push({ x: xValue, y: yValue, markerType: 'none' });
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

      if (currentApplication.includes('PERIODOGRAM')) {
        scanDisplay.markers.map((marker) => {
          if (marker.to_be_set || marker.deleted || nextIndex >= 2) {
            //only set markers for two nodes, too much overhead for more
            return;
          }

          if (tmpDisplay.marker_indexes === undefined)
            tmpDisplay.marker_indexes = [];

          const oldFreqIndex = tmpDisplay.marker_indexes[marker.index];
          const freqIndex =
            oldFreqIndex === undefined || oldFreqIndex === 0
              ? findFreqIndex(marker.freq, pointArr)
              : oldFreqIndex;
          tmpDisplay.marker_indexes[marker.index] = freqIndex;

          // console.log('marker_index',marker.index, 'next_index', next_index);
          tmpDisplay.markers[marker.index]['values'][nextIndex] =
            pointArr[freqIndex].y;
          pointArr[freqIndex].markerType = marker.type;
          pointArr[freqIndex].markerColor = marker.color;
          pointArr[freqIndex].markerSize = 10;
        });
        setScanDisplay(tmpDisplay);
      }

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

        setScanDisplay(tmpDisplay);
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
        const waterfall = {
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
        setWaterfall(waterfall);
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
        tmpChart.axisX.minimum = startingFrequency;
        tmpChart.axisX.maximum = endingFrequency;
      } else {
        delete tmpChart.axisX.minimum;
        delete tmpChart.axisX.maximum;
      }
      //console.log(chart);
      tmpChart.key = Math.random();
      setChart(tmpChart);
      // if (process.env.REACT_APP_ENVIRONMENT === "development")
      // {
      //   console.log("Finished processing periodogram at:", Date.now());
      // }
      return;
    },
    [
      scanDisplay,
      chart,
      currentApplication,
      startingFrequency,
      endingFrequency,
    ],
  );

  useEffect(() => {
    processPeriodogram(data);
  }, [data, processPeriodogram]);

  return (
    <div
      id="chartCanvas"
      className="border"
      //   onClick={(e) => chartRef && addMarkerCrosshair(e, chartRef)}
      style={{ width: '100%' }}
    >
      <CanvasJSChart
        onRef={(ref: React.RefObject<any>) => {
          setChartRef(ref);
          // console.log("canvas ref", ref);
        }}
        options={chart}
      />
    </div>
  );
}

export const binaryStringToFloatArray = (
  base64: string,
  dataTypeStr?: string,
): FloatArray | undefined => {
  const bStr = atob(base64);
  const len = bStr.length;
  let dataValues: Float32Array | Float64Array | undefined;
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

function findFreqIndex(target: number, arr: Array<{ x: number }>) {
  let from = 0,
    until = arr.length - 1;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    const cursor = Math.floor((from + until) / 2);

    if (cursor === from) {
      const diff1 = target - arr[from].x;
      const diff2 = arr[until].x - target;
      return diff1 <= diff2 ? from : until;
    }

    const found = arr[cursor].x;
    if (found === target) return cursor;

    if (found > target) {
      until = cursor;
    } else if (found < target) {
      from = cursor;
    }
  }
}
