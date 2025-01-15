import apiClient from '.';

export type SigMFFilePairResponse = {
  id: number;
  data_file_name: string;
  meta_file_name: string;
}[];

export type CaptureResponse = {
  name: string;
  timestamp: string;
  frequency: number;
  location: string;
  file_path: string;
}[];

export type IntegratedResponse = {
  id: number;
  name: string;
  timestamp: string;
  frequency: number;
  location: string;
  source: string;
  captureformat: string;
}[];

// integrated response captured here
export const getIntegratedView = async () => {
  const response = await apiClient.get('/api/integratedview/');
  return response.data as IntegratedResponse;
};


export const getCapture = async () => {
  const response = await apiClient.get('/api/captures/');
  return response.data as CaptureResponse;
};


export const getDatasets = async () => {
  const response = await apiClient.get('/api/sigmf-file-pairs/');
  return response.data as SigMFFilePairResponse;
};


export const postDataset = async (dataFile: Blob, metaFile: Blob) => {
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
