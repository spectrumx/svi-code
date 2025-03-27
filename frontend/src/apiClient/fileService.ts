import { useCallback } from 'react';

import apiClient from '.';
import { useAppContext } from '../utils/AppContext';
import { z as zod } from 'zod';
import { CaptureSource } from './captureService';

export const DJANGO_MAX_FILES_UPLOAD = 1000;

export const FileMetadataSchema = zod.object({
  id: zod.string(),
  name: zod.string(),
  content_url: zod.string().optional(),
  media_type: zod.string().optional(),
  created_at: zod.string().optional(),
  updated_at: zod.string().optional(),
});

export type FileMetadata = zod.infer<typeof FileMetadataSchema>;

export const getFileMetadata = async (
  fileId: string,
): Promise<FileMetadata> => {
  try {
    const response = await apiClient.get(`/api/files/${fileId}/`);
    return FileMetadataSchema.parse(response.data);
  } catch (error) {
    console.error('Error fetching file:', error);
    throw error;
  }
};

type FileSource = CaptureSource | 'svi';

export const getFileContent = async (
  fileId: string,
  source: FileSource,
  signal?: AbortSignal,
): Promise<any> => {
  const response = await apiClient.get(`/api/files/${fileId}/content/`, {
    params: { source },
    signal,
  });
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

export const getBaseFilename = (filename: string): string => {
  // Remove last extension from filename
  return filename.split('.').slice(0, -1).join('.');
};
