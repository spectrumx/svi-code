import { useCallback } from 'react';

import apiClient from '.';
import { useAppContext } from '../utils/AppContext';
import { z } from 'zod';

export type IntegratedResponse = {
  id: number;
  name: string;
  timestamp: string;
  frequency: number;
  location: string;
  source: string;
  captureformat: string;
}[];

export const getIntegratedView = async () => {
  const response = await apiClient.get('/api/integratedview/');
  return response.data as IntegratedResponse;
};

const CaptureTypeSchema = z.enum(['drf', 'rh', 'sigmf']);
export type CaptureType = z.infer<typeof CaptureTypeSchema>;

const CaptureSourceSchema = z.enum(['sds', 'svi_public', 'svi_user']);
export type CaptureSource = z.infer<typeof CaptureSourceSchema>;

const CaptureSchema = z.object({
  id: z.number(),
  name: z.string(),
  owner: z.number(),
  created_at: z.string(),
  timestamp: z.string(),
  type: CaptureTypeSchema,
  source: CaptureSourceSchema,
});

export type Capture = z.infer<typeof CaptureSchema>;

export const getCaptures = async (): Promise<Capture[]> => {
  try {
    const response = await apiClient.get('/api/captures/');
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

export type SigMFFilePair = {
  id: number;
  data_file_name: string;
  meta_file_name: string;
};

export type SigMFFilePairResponse = SigMFFilePair[];

export const getSigMFFilePairs = async () => {
  const response = await apiClient.get('/api/sigmf-file-pairs/');
  return response.data as SigMFFilePairResponse;
};

export const useSyncSigMFFilePairs = () => {
  const { setSigMFFilePairs } = useAppContext();
  const syncSigMFFilePairs = useCallback(async () => {
    setSigMFFilePairs(await getSigMFFilePairs());
  }, [setSigMFFilePairs]);
  return syncSigMFFilePairs;
};

export const postSigMFFilePair = async (dataFile: Blob, metaFile: Blob) => {
  const formData = new FormData();
  formData.append('data_file', dataFile);
  formData.append('meta_file', metaFile);

  const response = await apiClient.post('/api/sigmf-file-pairs/', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return response;
};

const FileMetadataSchema = z.object({
  id: z.number(),
  name: z.string(),
  content_url: z.string(),
  media_type: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
});

export type FileMetadata = z.infer<typeof FileMetadataSchema>;

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
