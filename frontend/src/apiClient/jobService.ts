import { AxiosError } from 'axios';
import { z } from 'zod';

import apiClient from '.';

const CreateSpectrogramResponseSchema = z.object({
  status: z.string().optional(),
  job_id: z.number().optional(),
  message: z.string().optional(),
  detail: z.string().optional(),
});

export type CreateSpectrogramResponse = z.infer<
  typeof CreateSpectrogramResponseSchema
>;

/**
 * Creates a spectrogram generation job for a specific capture
 * @param captureId - The ID of the capture to generate spectrogram for
//  * @param fftSize - The FFT size parameter for spectrogram generation
 * @param width - The width of the output image in pixels
 * @param height - The height of the output image in pixels
 * @returns Promise containing the job response
 */
export const postSpectrogramJob = async (
  captureId: number,
  // fftSize: number,
  width: number,
  height: number,
): Promise<CreateSpectrogramResponse> => {
  try {
    const response = await apiClient.post(
      `/api/captures/${captureId}/create_spectrogram/`,
      {
        // fft_size: fftSize,
        width: width,
        height: height,
      },
    );

    return CreateSpectrogramResponseSchema.parse(response.data);
  } catch (error) {
    // Check if it's an axios error with response data
    if (error instanceof AxiosError && error.response?.data) {
      // Try to parse the error response using the same schema
      // as it may contain valid status and message fields
      try {
        return CreateSpectrogramResponseSchema.parse(error.response.data);
      } catch (parseError) {
        // If parsing fails, return a generic error response
        return {
          status: 'error',
          message: 'Failed to parse error response from server',
        };
      }
    }

    // Handle network or other errors
    return {
      status: 'error',
      message:
        error instanceof Error ? error.message : 'An unknown error occurred',
    };
  }
};

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
export const getJobResults = async (resultsId: string): Promise<Blob> => {
  const response = await apiClient.get(
    `/api/jobs/job-data/${resultsId}/?download=true`,
    {
      responseType: 'blob',
    },
  );
  return response.data;
};
