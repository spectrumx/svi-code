import { useCallback } from 'react';

import apiClient from '.';
import { useAppContext } from '../utils/AppContext';
import { z } from 'zod';

const FileMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  media_type: z.string(),
  timestamp: z.string(),
  source: z.string(),
});

export type FileMetadata = z.infer<typeof FileMetadataSchema>;

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

export const getFileContent = async (fileId: string): Promise<any> => {
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

const CaptureTypeSchema = z.enum(['drf', 'rh', 'sigmf']);
export type CaptureType = z.infer<typeof CaptureTypeSchema>;

const CaptureSourceSchema = z.enum(['sds', 'svi_public', 'svi_user']);
export type CaptureSource = z.infer<typeof CaptureSourceSchema>;

const CaptureSchema = z.object({
  id: z.string(),
  name: z.string(),
  owner: z.number(),
  created_at: z.string(),
  timestamp: z.string(),
  type: CaptureTypeSchema,
  source: CaptureSourceSchema,
  files: z.array(FileMetadataSchema),
});

export type Capture = z.infer<typeof CaptureSchema>;

export const getCaptures = async (): Promise<Capture[]> => {
  try {
    const response = await apiClient.get('/api/captures/list/');
    return z.array(CaptureSchema).parse(response.data);
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

export const postCapture = async (
  name: string,
  type: CaptureType,
  files: Blob[],
): Promise<void> => {
  const formData = new FormData();
  formData.append('name', name);
  formData.append('type', type);

  // Append each file to the uploaded_files array
  files.forEach((file) => {
    formData.append('uploaded_files', file);
  });

  await apiClient.post('/api/captures/list/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
};
