import apiClient from '.';

export type SigMFFilePairResponse = {
  id: number;
  data_file_name: string;
  meta_file_name: string;
}[];

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
