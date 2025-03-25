import { useCallback } from 'react';

import apiClient from '.';
import { useAppContext } from '../utils/AppContext';
import { z as zod } from 'zod';
import { getBaseFilename, FileMetadataSchema } from './fileService';

export const CAPTURE_TYPES = {
  rh: { name: 'RadioHound' },
  drf: { name: 'Digital RF' },
  sigmf: { name: 'SigMF' },
} as const;
export const CaptureTypeSchema = zod.enum(['rh', 'drf', 'sigmf']);
export type CaptureType = keyof typeof CAPTURE_TYPES;

export const CAPTURE_SOURCES = {
  sds: { name: 'SDS' },
  svi_public: { name: 'SVI Public' },
  svi_user: { name: 'SVI User' },
} as const;
export const CaptureSourceSchema = zod.enum(['sds', 'svi_public', 'svi_user']);
export type CaptureSource = keyof typeof CAPTURE_SOURCES;

export const CaptureSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  owner: zod.number(),
  created_at: zod.string(),
  timestamp: zod.string(),
  type: CaptureTypeSchema,
  source: CaptureSourceSchema,
  files: zod.array(FileMetadataSchema),
});
export type Capture = zod.infer<typeof CaptureSchema>;

const CapturesResponseSchema = zod.array(CaptureSchema);

export const getCaptures = async (filters?: {
  min_frequency?: string;
  max_frequency?: string;
  start_time?: string;
  end_time?: string;
  source?: CaptureSource[];
}): Promise<Capture[]> => {
  try {
    const params = new URLSearchParams();

    if (filters?.min_frequency)
      params.append('min_frequency', filters.min_frequency);
    if (filters?.max_frequency)
      params.append('max_frequency', filters.max_frequency);
    if (filters?.start_time) params.append('start_time', filters.start_time);
    if (filters?.end_time) params.append('end_time', filters.end_time);
    if (filters?.source && filters.source.length > 0) {
      params.append('source', filters.source.join(','));
    }

    const response = await apiClient.get(
      `/api/captures/list/?${params.toString()}`,
    );
    const captures = CapturesResponseSchema.parse(response.data);
    return captures;
  } catch (error) {
    console.error('Error fetching captures:', error);
    throw error;
  }
};

export const useSyncCaptures = () => {
  const { setCaptures } = useAppContext();

  const syncCaptures = useCallback(
    async (filters?: {
      min_frequency?: string;
      max_frequency?: string;
      start_time?: string;
      end_time?: string;
      source?: CaptureSource[];
    }) => {
      const captures = await getCaptures(filters);
      setCaptures(captures);
    },
    [setCaptures],
  );

  return syncCaptures;
};

export const getCapture = async (captureId: string): Promise<Capture> => {
  const response = await apiClient.get(`/api/captures/${captureId}/`);
  return CaptureSchema.parse(response.data);
};

export const postCaptures = async (
  type: CaptureType,
  files: File[],
  name?: string,
): Promise<void> => {
  const formData = new FormData();
  const finalName = name ?? inferCaptureName(files, type);

  if (finalName) {
    formData.append('name', finalName);
  }

  files.forEach((file) => {
    formData.append('uploaded_files', file);
  });

  formData.append('type', type);

  await apiClient.post('/api/captures/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};

export const inferCaptureName = (
  files: File[],
  type: CaptureType,
): string | undefined => {
  if (type !== 'rh' || files.length === 1) {
    return getBaseFilename(files[0].name);
  }
  return undefined;
};
