/**
 * Types for waterfall data and visualization.
 */

import {
  ChartDataSeriesOptions,
  ChartOptions,
  ChartAxisXOptions,
  ChartAxisYOptions,
} from 'canvasjs';
import { z as zod } from 'zod';

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

/**
 * RadioHound format (.rh/.rh.json) capture for periodograms
 *
 * Schema definition:
 * https://github.com/spectrumx/schema-definitions/tree/master/definitions/sds/metadata-formats/radiohound
 */
const RequestedSchema = zod.object({
  fmin: zod.number().optional(),
  fmax: zod.number().optional(),
  span: zod.number().optional(),
  rbw: zod.number().optional(),
  samples: zod.number().optional(),
  gain: zod.number().optional(),
});

const RadioHoundMetadataSchema = zod.object({
  data_type: zod.string(),
  fmax: zod.number(),
  fmin: zod.number(),
  gps_lock: zod.boolean(),
  nfft: zod.number(),
  scan_time: zod.number(),
  archive_result: zod.boolean().optional(),
  // Deprecated fields
  xcount: zod.number().optional(),
  xstart: zod.number().optional(),
  xstop: zod.number().optional(),
  suggested_gain: zod.number().optional(),
  uncertainty: zod.number().optional(),
  archiveResult: zod.boolean().optional(),
});

const RadioHoundCustomFieldsSchema = zod
  .object({
    requested: RequestedSchema,
  })
  .catchall(zod.unknown());

export const RadioHoundFileSchema = zod.object({
  data: zod.string(),
  gain: zod.number(),
  latitude: zod.number(),
  longitude: zod.number(),
  mac_address: zod.string(),
  metadata: RadioHoundMetadataSchema,
  sample_rate: zod.number(),
  short_name: zod.string(),
  timestamp: zod.string(),
  type: zod.string(),
  version: zod.string(),
  altitude: zod.number().optional(),
  center_frequency: zod.number().optional(),
  custom_fields: RadioHoundCustomFieldsSchema.optional(),
  hardware_board_id: zod.string().optional(),
  hardware_version: zod.string().optional(),
  scan_group: zod.string().optional(),
  software_version: zod.string().optional(),
  // Deprecated fields
  batch: zod.number().optional(),
  m4s_min: zod.string().optional(),
  m4s_max: zod.string().optional(),
  m4s_mean: zod.string().optional(),
  m4s_median: zod.string().optional(),
  requested: RequestedSchema.optional(),
});

export type RadioHoundFile = zod.infer<typeof RadioHoundFileSchema>;

export type FloatArray = Float32Array | Float64Array;

export interface ScanState {
  isScanActive: boolean;
  lastScanOptions: ScanOptionsType | undefined;
  receivedHeatmap: boolean;
  scansRequested: number;
  allData: number[][];
  yMin: number;
  yMax: number;
  xMin?: number;
  xMax?: number;
  spinner: boolean;
  periodogram?: RadioHoundFile | number[];
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
