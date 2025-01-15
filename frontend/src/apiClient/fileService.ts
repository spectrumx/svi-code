import { useCallback } from 'react';

import apiClient from '.';
import { useAppContext } from '../utils/AppContext';

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
