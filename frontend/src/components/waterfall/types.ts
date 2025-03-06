/**
 * Types for waterfall data and visualization.
 */

import {
  ChartDataSeriesOptions,
  ChartOptions,
  ChartAxisXOptions,
  ChartAxisYOptions,
} from 'canvasjs';

export interface Data extends ChartDataSeriesOptions {
  // Custom prop
  _id?: string;
}

interface AxisXOptions extends ChartAxisXOptions {
  // Props in CanvasJS that are missing in the
  // DefinitelyTyped type definition
  titlePadding?: number;
}

// Omit title prop because title messes up the plot left alignment
interface AxisYOptions extends Omit<ChartAxisYOptions, 'title'> {
  // Props in CanvasJS that are missing in the
  // DefinitelyTyped type definition
  labelPlacement?: 'inside' | 'outside';
  labelPadding?: number;
  // Custom props
  absoluteMaximum?: number;
  absoluteMinimum?: number;
}

export interface Chart extends Omit<ChartOptions, 'data' | 'axisY' | 'axisX'> {
  data: Data[];
  axisY: AxisYOptions;
  axisX: AxisXOptions;
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

export type DataPoint = {
  x: number;
  y?: number;
  label?: string;
};

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
