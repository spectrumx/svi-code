import { AxiosError } from 'axios';
import { z as zod } from 'zod';

import apiClient from '.';
import { SpectrogramSettings } from '../components/spectrogram/SpectrogramVizContainer';

const CreateSpectrogramResponseSchema = zod.object({
  status: zod.string().optional(),
  job_id: zod.number().optional(),
  message: zod.string().optional(),
  detail: zod.string().optional(),
});

export type CreateSpectrogramResponse = zod.infer<
  typeof CreateSpectrogramResponseSchema
>;

/**
 * Creates a spectrogram generation job for a specific visualization
 * @param visualizationUUID - The UUID of the visualization to generate spectrogram for
 * @param width - The width of the output image in pixels
 * @param height - The height of the output image in pixels
 * @returns Promise containing the job response
 */
export const postSpectrogramJob = async (
  visualizationUUID: string,
  width: number,
  height: number,
  settings: SpectrogramSettings,
): Promise<CreateSpectrogramResponse> => {
  try {
    const response = await apiClient.post(
      `/api/visualizations/${visualizationUUID}/create_spectrogram/`,
      {
        width: width,
        height: height,
        config: settings,
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

export type JobStatus =
  | 'pending'
  | 'submitted'
  | 'running'
  | 'fetching_results'
  | 'completed'
  | 'failed'
  | 'error';

export const ACTIVE_JOB_STATUSES: JobStatus[] = [
  'pending',
  'submitted',
  'running',
  'fetching_results',
];

export interface JobMetadata {
  user_id: string;
  type: string;
  status: JobStatus;
  created_at: string;
  updated_at: string;
  local_files: string[];
  remote_files: string[];
  config: Record<string, unknown>;
  memory_warning?: string;
  results_id?: string;
}

export interface JobResponse {
  // Whether the request was successful (not the job status)
  status: "success" | "error";
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
