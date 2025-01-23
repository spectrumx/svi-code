import { useCallback } from 'react';

import apiClient from '.';
import { useAppContext } from '../utils/AppContext';
import { z } from 'zod';

export type SigMFFilePair = {
  id: number;
  data_file_name: string;
  meta_file_name: string;
};

export type SigMFFilePairResponse = SigMFFilePair[];

export const getSigMFCaptures = async () => {
  const response = await apiClient.get('/api/sigmf-file-pairs/');
  return response.data as SigMFFilePairResponse;
};

export const useSyncCaptures = () => {
  const { setCaptures } = useAppContext();
  const syncCaptures = useCallback(async () => {
    setCaptures(await getSigMFCaptures());
  }, [setCaptures]);
  return syncCaptures;
};

export const postSigMFCapture = async (dataFile: Blob, metaFile: Blob) => {
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
