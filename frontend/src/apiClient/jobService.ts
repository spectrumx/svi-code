import apiClient from '.';

export interface JobMetadata {
  status: string;
  results_id?: string;
}

export interface JobResponse {
  data?: JobMetadata;
  message?: string;
  job_id?: number;
}

/**
 * Creates a spectrogram generation job for a specific dataset
 * @param datasetId - The ID of the dataset to generate spectrogram for
 * @param fftSize - The FFT size parameter for spectrogram generation
 * @returns Promise containing the job response
 */
export const postSpectrogramJob = async (
  datasetId: string,
  fftSize: number,
  width: number,
  height: number
): Promise<JobResponse> => {
  const response = await apiClient.post(
    `/api/sigmf-file-pairs/${datasetId}/create_spectrogram/`,
    {
      fft_size: fftSize,
      width: width,
      height: height
    },
  );
  return response.data;
};

/**
 * Fetches the metadata/status of a specific job
 * @param jobId - The ID of the job to fetch status for
 * @returns Promise containing the job metadata
 */
export const getJobMetadata = async (jobId: number): Promise<JobResponse> => {
  const response = await apiClient.get<JobResponse>(
    `/api/jobs/job-metadata/${jobId}/`,
  );
  return response.data;
};

/**
 * Fetches the result data for a completed job
 * @param resultsId - The ID of the results to fetch
 * @returns Promise containing the blob data
 */
// change here -- mm -- delete width and height params while undoing
export const getJobResults = async (resultsId: string): Promise<Blob> => {
  const response = await apiClient.get(
    `/api/jobs/job-data/${resultsId}/?download=true`,
    {
      responseType: 'blob',
    },
  );
  return response.data;
};
