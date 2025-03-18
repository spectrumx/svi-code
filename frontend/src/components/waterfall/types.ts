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
  labelPlacement?: 'inside' | 'outside';
  labelPadding?: number;
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

export interface Chart
  extends Omit<ChartOptions, 'data' | 'axisX' | 'axisX2' | 'axisY' | 'axisY2'> {
  data: Data[];
  axisX?: AxisXOptions;
  axisX2?: AxisXOptions;
  axisY?: AxisYOptions;
  axisY2?: AxisYOptions;
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

interface Requested {
  fmin?: number;
  fmax?: number;
  span?: number;
  rbw?: number;
  samples?: number;
  gain?: number;
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
  data: string;
  gain: number;
  latitude: number;
  longitude: number;
  mac_address: string;
  metadata: {
    data_type: string;
    fmax: number;
    fmin: number;
    gps_lock: boolean;
    nfft: number;
    scan_time: number;
    archive_result?: boolean;
    // Deprecated metadata fields
    xcount?: number;
    xstart?: number;
    xstop?: number;
    suggested_gain?: number;
    uncertainty?: number;
    archiveResult?: boolean;
  };
  sample_rate: number;
  short_name: string;
  timestamp: string;
  type: string;
  version: string;
  altitude?: number;
  center_frequency?: number;
  custom_fields?: {
    requested: Requested;
  } & Record<string, unknown>;
  hardware_board_id?: string;
  hardware_version?: string;
  scan_group?: string;
  software_version?: string;
  // Deprecated fields
  batch?: number;
  m4s_min?: string;
  m4s_max?: string;
  m4s_mean?: string;
  m4s_median?: string;
  requested?: Requested;
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
