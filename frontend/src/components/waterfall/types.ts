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

const WaterfallCustomFieldsSchema = zod
  .object({
    requested: zod
      .object({
        min_frequency: zod.number().optional(),
        max_frequency: zod.number().optional(),
      })
      .optional(),
    scan_time: zod.number().optional(),
    gain: zod.number().optional(),
    gps_lock: zod.boolean().optional(),
    job_name: zod.string().optional(),
    comments: zod.string().optional(),
  })
  .catchall(zod.unknown());

export const WaterfallFileSchema = zod.object({
  data: zod.string(),
  data_type: zod.string(),
  timestamp: zod.string(),
  min_frequency: zod.number(),
  max_frequency: zod.number(),
  num_samples: zod.number(),
  sample_rate: zod.number(),
  mac_address: zod.string(),
  device_name: zod.string().optional(),
  center_frequency: zod.number().optional(),
  custom_fields: WaterfallCustomFieldsSchema.optional(),
});
export type WaterfallFile = zod.infer<typeof WaterfallFileSchema>;

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
  periodogram?: WaterfallFile | number[];
  heatmapData: Data[];
  scaleMin: number | undefined;
  scaleMax: number | undefined;
}

export interface ScanWaterfallType
  extends Pick<ScanState, 'periodogram' | 'xMin' | 'xMax'>,
    Partial<
      Pick<ScanState, 'scaleMin' | 'scaleMax' | 'yMin' | 'yMax' | 'allData'>
    > {}
