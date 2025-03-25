import { useCallback } from 'react';
import { z as zod } from 'zod';

import apiClient from '.';
import { useAppContext } from '../utils/AppContext';
import {
  CaptureSource,
  CaptureType,
  CaptureSourceSchema,
  CaptureTypeSchema,
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

const VisualizationSchema = zod.object({
  id: zod.number(),
  owner: zod.string(),
  type: VisualizationTypeSchema,
  capture_ids: zod.array(zod.string()),
  capture_type: CaptureTypeSchema,
  capture_source: CaptureSourceSchema,
  settings: zod.record(zod.string(), zod.any()),
  created_at: zod.string(),
  updated_at: zod.string(),
});

export type Visualization = zod.infer<typeof VisualizationSchema>;

export interface CreateVisualizationRequest {
  type: VisualizationType;
  capture_ids: string[];
  capture_type: CaptureType;
  capture_source: CaptureSource;
  settings?: Record<string, any>;
}

export const getVisualizations = async (): Promise<Visualization[]> => {
  try {
    const response = await apiClient.get('/api/visualizations/');
    return zod.array(VisualizationSchema).parse(response.data);
  } catch (error) {
    console.error('Error fetching visualizations:', error);
    throw error;
  }
};

export const getVisualization = async (id: string): Promise<Visualization> => {
  const response = await apiClient.get(`/api/visualizations/${id}`);
  return VisualizationSchema.parse(response.data);
};

export const createVisualization = async (
  request: CreateVisualizationRequest,
): Promise<Visualization> => {
  try {
    const response = await apiClient.post('/api/visualizations/', request);
    return VisualizationSchema.parse(response.data);
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
