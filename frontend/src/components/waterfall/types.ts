/**
 * Types for waterfall data and visualization.
 */

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

/**
 * RadioHound format (.rh) capture for periodograms
 *
 * Schema definition:
 * https://github.com/spectrumx/schema-definitions/tree/master/definitions/sds/metadata-formats/radiohound
 *
 * TODO: Update this type to match schema
 */
export interface RadioHoundCapture {
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
  lastScanOptions: ScanOptionsType | undefined;
  receivedHeatmap: boolean;
  scansRequested: number;
  // I inferred allData's type, but it doesn't seem correct
  allData: (Data | RadioHoundCapture | number[])[];
  yMin: number;
  yMax: number;
  xMin?: number;
  xMax?: number;
  spinner: boolean;
  periodogram?: RadioHoundCapture | number[];
  heatmapData: Data[];
  scaleMin: number | undefined;
  scaleMax: number | undefined;
}

export interface WaterfallType
  extends Pick<ScanState, 'periodogram' | 'xMin' | 'xMax'>,
    Partial<
      Pick<ScanState, 'scaleMin' | 'scaleMax' | 'yMin' | 'yMax' | 'allData'>
    > {}

export type ApplicationType =
  | 'WATERFALL'
  | 'PERIODOGRAM'
  | 'PERIODOGRAM_SINGLE'
  | 'PERIODOGRAM_MULTI';
