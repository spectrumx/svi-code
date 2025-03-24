import { useCallback } from 'react';
import { z as zod } from 'zod';

import apiClient from '.';
import { useAppContext } from '../utils/AppContext';
import {
  CaptureSource,
  CaptureType,
  CaptureTypeSchema,
  CaptureSourceSchema,
  CaptureSchema,
} from './fileService';

const VisualizationTypeSchema = zod.enum(['spectrogram', 'waterfall']);
export type VisualizationType = zod.infer<typeof VisualizationTypeSchema>;

export interface VisualizationTypeInfo {
  name: VisualizationType;
  description: string;
  icon: string;
  supportedCaptureTypes: CaptureType[];
  multipleSelection: boolean;
}

export const VISUALIZATION_TYPES: VisualizationTypeInfo[] = [
  {
    name: 'spectrogram',
    description: 'Visualize signal strength across frequency and time',
    icon: 'bi-graph-up',
    supportedCaptureTypes: ['sigmf'],
    multipleSelection: false,
  },
  {
    name: 'waterfall',
    description:
      'View signal data as a scrolling waterfall display with periodogram',
    icon: 'bi-water',
    supportedCaptureTypes: ['rh'],
    multipleSelection: true,
  },
];

const BaseVisualizationRecordSchema = zod.object({
  id: zod.number(),
  owner: zod.string(),
  type: VisualizationTypeSchema,
  capture_type: CaptureTypeSchema,
  capture_source: CaptureSourceSchema,
  settings: zod.record(zod.string(), zod.any()),
  created_at: zod.string(),
  updated_at: zod.string(),
});

const VisualizationRecordSchema = BaseVisualizationRecordSchema.extend({
  capture_ids: zod.array(zod.string()),
});

export type VisualizationRecord = zod.infer<typeof VisualizationRecordSchema>;

const VisualizationRecordDetailSchema = BaseVisualizationRecordSchema.extend({
  captures: zod.array(CaptureSchema),
});

export type VisualizationRecordDetail = zod.infer<
  typeof VisualizationRecordDetailSchema
>;

export interface CreateVisualizationRequest {
  type: VisualizationType;
  capture_ids: string[];
  capture_type: CaptureType;
  capture_source: CaptureSource;
  settings?: Record<string, any>;
}

export const getVisualizations = async (): Promise<VisualizationRecord[]> => {
  try {
    const response = await apiClient.get('/api/visualizations/');
    return zod.array(VisualizationRecordSchema).parse(response.data);
  } catch (error) {
    console.error('Error fetching visualizations:', error);
    throw error;
  }
};

export const getVisualization = async (
  id: string,
): Promise<VisualizationRecordDetail> => {
  const response = await apiClient.get(`/api/visualizations/${id}/`);
  return VisualizationRecordDetailSchema.parse(response.data);
};

export const createVisualization = async (
  request: CreateVisualizationRequest,
): Promise<VisualizationRecordDetail> => {
  try {
    const response = await apiClient.post('/api/visualizations/', request);
    return VisualizationRecordDetailSchema.parse(response.data);
  } catch (error) {
    console.error('Error creating visualization:', error);
    throw error;
  }
};

export const useSyncVisualizations = () => {
  const { setVisualizations } = useAppContext();

  const syncVisualizations = useCallback(async () => {
    const visualizations = await getVisualizations();
    setVisualizations(visualizations);
  }, [setVisualizations]);

  return syncVisualizations;
};

/**
 * Downloads all files associated with a visualization as a ZIP file.
 * @param id - The ID of the visualization
 * @returns A blob containing the ZIP file
 */
export const downloadVizFiles = async (id: string): Promise<Blob> => {
  const response = await apiClient.get(
    `/api/visualizations/${id}/download_files/`,
    {
      responseType: 'blob',
    },
  );
  return response.data;
};
