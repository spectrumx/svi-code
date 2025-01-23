import { useState } from 'react';

import { Periodogram } from './Periodogram';
// import { Waterfall } from './Waterfall';

export type DataPoint = {
  x: number;
  y?: number;
  label?: string;
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
  // location?: google.maps.LatLng;
  location?: {
    lat: number;
    lng: number;
  };
  weight?: number;
};

export interface Chart {
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

export interface ScanOptionsCore {
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
  data: number[] | FloatArray | string;
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

export type FloatArray = Float32Array | Float64Array;

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

export interface WaterfallType
  extends Pick<ScanState, 'periodogram' | 'xMin' | 'xMax'>,
    Partial<Pick<ScanState, 'scaleMin' | 'scaleMax' | 'yMin' | 'yMax'>> {}

export type ApplicationType =
  | 'WATERFALL'
  | 'PERIODOGRAM'
  | 'PERIODOGRAM_SINGLE'
  | 'PERIODOGRAM_MULTI';
export type Application = ApplicationType | ApplicationType[];

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

interface WaterfallProps {
  data: PeriodogramType;
}

const WaterfallVisualization = ({ data }: WaterfallProps) => {
  const [scan, setScan] = useState<ScanState>(initialState);
  const scanDisplay = scan.display;
  const setScanDisplay = (display: Display) => {
    setScan((prevScan) => ({ ...prevScan, display }));
  };
  const scanOptions = scan.options;
  const setScanOptions = (options: ScanOptionsType) => {
    setScan((prevScan) => ({ ...prevScan, options }));
  };
  const chart = scan.chart;
  const setChart = (chart: Chart) => {
    setScan((prevScan) => ({ ...prevScan, chart }));
  };
  const [waterfall, setWaterfall] = useState<WaterfallType>({});
  const currentApplication = ['PERIODOGRAM', 'WATERFALL'] as Application;

  return (
    <>
      <Periodogram
        data={data}
        currentApplication={currentApplication}
        scanDisplay={scanDisplay}
        setScanDisplay={setScanDisplay}
        scanOptions={scanOptions}
        chart={chart}
        setChart={setChart}
        waterfall={waterfall}
        setWaterfall={setWaterfall}
      />
      {/* <Waterfall
        data={data}
        currentApplication={currentApplication}
        scanDisplay={scanDisplay}
        setScanDisplay={setScanDisplay}
        scanOptions={scanOptions}
        setScanOptions={setScanOptions}
        chart={chart}
        setChart={setChart}
        waterfall={waterfall}
        setWaterfall={setWaterfall}
      /> */}
    </>
  );
};

export { WaterfallVisualization };
