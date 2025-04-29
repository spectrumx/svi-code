import { useCallback } from 'react';
import { z as zod } from 'zod';

import apiClient from '.';
import { useAppContext } from '../utils/AppContext';
import {
  getBaseFilename,
  FileMetadataSchema,
  DJANGO_MAX_FILES_UPLOAD,
} from './fileService';
import { sortByDate } from '../utils/utils';

export const CaptureTypeSchema = zod.enum(['rh', 'drf', 'sigmf']);
export type CaptureType = zod.infer<typeof CaptureTypeSchema>;

export interface CaptureTypeInfo {
  name: string;
  fileExtensions: string[];
  minFiles: number;
  maxFiles: number;
  uploadInstructions: string;
}

export const CAPTURE_TYPE_INFO: Record<CaptureType, CaptureTypeInfo> = {
  rh: {
    name: 'RadioHound',
    fileExtensions: ['.json', '.rh'],
    minFiles: 1,
    maxFiles: DJANGO_MAX_FILES_UPLOAD,
    uploadInstructions: `Upload one or more RadioHound files (max of ${DJANGO_MAX_FILES_UPLOAD}).`,
  },
  drf: {
    name: 'Digital RF',
    fileExtensions: ['.zip'],
    minFiles: 1,
    maxFiles: 1,
    uploadInstructions: 'Upload a ZIP archive of a single Digital RF channel.',
  },
  sigmf: {
    name: 'SigMF',
    fileExtensions: ['.sigmf-data', '.sigmf-meta'],
    minFiles: 2,
    maxFiles: 2,
    uploadInstructions: 'Upload one .sigmf-data and one .sigmf-meta file.',
  },
};

export const CAPTURE_SOURCES = {
  sds: { name: 'SDS' },
  svi_user: { name: 'SVI User' },
  svi_public: { name: 'SVI Public' },
} as const;
export const CaptureSourceSchema = zod.enum(['sds', 'svi_user', 'svi_public']);
export type CaptureSource = keyof typeof CAPTURE_SOURCES;

export const CaptureSchema = zod.object({
  uuid: zod.string(),
  name: zod.string(),
  owner: zod.string(),
  created_at: zod.string(),
  timestamp: zod.string(),
  type: CaptureTypeSchema,
  source: CaptureSourceSchema,
  files: zod.array(FileMetadataSchema),
  min_freq: zod.number().optional().nullable(),
  max_freq: zod.number().optional().nullable(),
  scan_time: zod.number().optional().nullable(),
  end_time: zod.string().optional().nullable(),
});
export type Capture = zod.infer<typeof CaptureSchema>;

const CapturesResponseSchema = zod.array(CaptureSchema);

export const getCapturesWithFilters = async (filters?: {
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
    const sortedCaptures = captures.sort((a, b) =>
      sortByDate(a, b, 'timestamp'),
    );
    return sortedCaptures;
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
      const captures = await getCapturesWithFilters(filters);
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

export const postCapture = async (
  type: CaptureType,
  files: File[],
  name?: string,
): Promise<void> => {
  const formData = new FormData();

  const finalName = name ?? inferCaptureName(files);
  formData.append('name', finalName);

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

export const inferCaptureName = (files: File[]): string => {
  return getBaseFilename(files[0].name);
};
