import { useCallback } from 'react';

import apiClient from '.';
import { useAppContext } from '../utils/AppContext';
import { z as zod } from 'zod';

const FileMetadataSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  content_url: zod.string(),
  media_type: zod.string(),
  created_at: zod.string(),
  updated_at: zod.string(),
});

export type FileMetadata = zod.infer<typeof FileMetadataSchema>;

export const getFileMetadata = async (
  fileId: number,
): Promise<FileMetadata> => {
  try {
    const response = await apiClient.get(`/api/files/${fileId}/`);
    return FileMetadataSchema.parse(response.data);
  } catch (error) {
    console.error('Error fetching file:', error);
    throw error;
  }
};

export const getFileContent = async (fileId: number): Promise<any> => {
  const response = await apiClient.get(`/api/files/${fileId}/content/`);
  return response.data;
};

export const getFiles = async (): Promise<FileMetadata[]> => {
  const response = await apiClient.get('/api/files/');
  return response.data;
};

export const useSyncFiles = () => {
  const { setFiles } = useAppContext();
  const syncFiles = useCallback(async () => {
    setFiles(await getFiles());
  }, [setFiles]);
  return syncFiles;
};

export const CAPTURE_TYPES = {
  rh: { name: 'RadioHound' },
  drf: { name: 'Digital RF' },
  sigmf: { name: 'SigMF' },
} as const;
const CaptureTypeSchema = zod.enum(['rh', 'drf', 'sigmf']);
export type CaptureType = keyof typeof CAPTURE_TYPES;

export const CAPTURE_SOURCES = {
  sds: { name: 'SDS' },
  svi_public: { name: 'SVI Public' },
  svi_user: { name: 'SVI User' },
} as const;
const CaptureSourceSchema = zod.enum(['sds', 'svi_public', 'svi_user']);
export type CaptureSource = keyof typeof CAPTURE_SOURCES;

const CaptureSchema = zod.object({
  id: zod.number(),
  name: zod.string(),
  owner: zod.number(),
  created_at: zod.string(),
  timestamp: zod.string(),
  type: CaptureTypeSchema,
  source: CaptureSourceSchema,
  files: zod.array(FileMetadataSchema),
});
export type Capture = zod.infer<typeof CaptureSchema>;

export const getCaptures = async (): Promise<Capture[]> => {
  try {
    const response = await apiClient.get('/api/captures/');
    return zod.array(CaptureSchema).parse(response.data);
  } catch (error) {
    console.error('Error fetching captures:', error);
    throw error;
  }
};

export const useSyncCaptures = () => {
  const { setCaptures } = useAppContext();
  const syncCaptures = useCallback(async () => {
    setCaptures(await getCaptures());
  }, [setCaptures]);
  return syncCaptures;
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

export const getBaseFilename = (filename: string): string => {
  // Remove last extension from filename
  return filename.split('.').slice(0, -1).join('.');
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
