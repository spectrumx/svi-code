import { useCallback, useState, useEffect } from 'react';
import { z as zod } from 'zod';

import apiClient from '.';
import { useAppContext } from '../utils/AppContext';
import {
  CaptureSource,
  CaptureType,
  CaptureTypeSchema,
  CaptureSourceSchema,
  CaptureSchema,
} from './captureService';
import { RadioHoundFileSchema } from '../components/waterfall/types';
import { FilesWithContent } from '../components/types';
import JSZip from 'jszip';

const VisualizationTypeSchema = zod.enum(['spectrogram', 'waterfall']);
export type VisualizationType = zod.infer<typeof VisualizationTypeSchema>;

export interface VisualizationTypeInfo {
  name: VisualizationType;
  description: string;
  icon: string;
  supportedCaptureTypes: CaptureType[];
  multipleSelection: boolean;
}

export const VISUALIZATION_TYPES: VisualizationTypeInfo[] = [
  {
    name: 'spectrogram',
    description: 'Visualize signal strength across frequency and time',
    icon: 'bi-graph-up',
    supportedCaptureTypes: ['sigmf', 'drf'],
    multipleSelection: false,
  },
  {
    name: 'waterfall',
    description:
      'View signal data as a scrolling waterfall display with periodogram',
    icon: 'bi-water',
    supportedCaptureTypes: ['rh'],
    multipleSelection: false,
  },
];

const BaseVisualizationRecordSchema = zod.object({
  uuid: zod.string(),
  name: zod.string(),
  owner: zod.string(),
  type: VisualizationTypeSchema,
  capture_type: CaptureTypeSchema,
  capture_source: CaptureSourceSchema,
  settings: zod.record(zod.string(), zod.any()),
  created_at: zod.string(),
  updated_at: zod.string(),
});

const VisualizationRecordSchema = BaseVisualizationRecordSchema.extend({
  capture_ids: zod.array(zod.string()),
});

export type VisualizationRecord = zod.infer<typeof VisualizationRecordSchema>;

const VisualizationRecordDetailSchema = BaseVisualizationRecordSchema.extend({
  captures: zod.array(CaptureSchema),
  is_saved: zod.boolean(),
  expiration_date: zod.string().nullable(),
});

export type VisualizationRecordDetail = zod.infer<
  typeof VisualizationRecordDetailSchema
>;

export interface CreateVisualizationRequest {
  name?: string;
  type: VisualizationType;
  capture_ids: string[];
  capture_type: CaptureType;
  capture_source: CaptureSource;
  settings?: Record<string, any>;
}

export const getVisualizations = async (): Promise<VisualizationRecord[]> => {
  try {
    const response = await apiClient.get('/api/visualizations/');
    return zod.array(VisualizationRecordSchema).parse(response.data);
  } catch (error) {
    console.error('Error fetching visualizations:', error);
    throw error;
  }
};

export const getDetailedVisualizations = async (): Promise<
  VisualizationRecordDetail[]
> => {
  try {
    const response = await apiClient.get('/api/visualizations/', {
      params: { detailed: true },
    });
    return zod.array(VisualizationRecordDetailSchema).parse(response.data);
  } catch (error) {
    console.error('Error fetching detailed visualizations:', error);
    throw error;
  }
};

export const getVisualization = async (
  id: string,
): Promise<VisualizationRecordDetail> => {
  const response = await apiClient.get(`/api/visualizations/${id}/`);
  return VisualizationRecordDetailSchema.parse(response.data);
};

export const postVisualization = async (
  request: CreateVisualizationRequest,
): Promise<VisualizationRecordDetail> => {
  try {
    const response = await apiClient.post('/api/visualizations/', request);
    return VisualizationRecordDetailSchema.parse(response.data);
  } catch (error) {
    console.error('Error creating visualization:', error);
    throw error;
  }
};

export const saveVisualization = async (
  id: string,
): Promise<VisualizationRecordDetail> => {
  const response = await apiClient.post(`/api/visualizations/${id}/save/`);
  return VisualizationRecordDetailSchema.parse(response.data);
};

export const updateVisualization = async (
  id: string,
  newData: Partial<Pick<VisualizationRecordDetail, 'name' | 'settings'>>,
): Promise<VisualizationRecordDetail> => {
  const response = await apiClient.patch(`/api/visualizations/${id}/`, newData);
  return VisualizationRecordDetailSchema.parse(response.data);
};

export const deleteVisualization = async (id: string): Promise<boolean> => {
  const response = await apiClient.delete(`/api/visualizations/${id}/`);
  return response.status === 204;
};

export const useSyncVisualizations = () => {
  const { setVisualizations } = useAppContext();

  const syncVisualizations = useCallback(async () => {
    const visualizations = await getVisualizations();
    setVisualizations(visualizations);
  }, [setVisualizations]);

  return syncVisualizations;
};

/**
 * Downloads all files associated with a visualization as a ZIP file.
 * @param id - The ID of the visualization
 * @returns A blob containing the ZIP file
 */
export const downloadVizFiles = async (id: string): Promise<Blob> => {
  const response = await apiClient.get(
    `/api/visualizations/${id}/download_files/`,
    {
      responseType: 'blob',
    },
  );
  return response.data;
};

export const useVisualizationFiles = (vizRecord: VisualizationRecordDetail) => {
  const [files, setFiles] = useState<FilesWithContent>({});
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFiles = async () => {
      setIsLoading(true);

      try {
        // Download the ZIP file containing all files
        const zipBlob = await downloadVizFiles(vizRecord.uuid);

        // Parse the ZIP file
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(zipBlob);

        // Process each file in the ZIP
        const files: FilesWithContent = {};

        // Process each capture in the visualization state
        for (const capture of vizRecord.captures) {
          const captureDir = zipContent.folder(capture.uuid);
          if (!captureDir) {
            console.warn(
              `Capture directory not found for capture ID ${capture.uuid}`,
            );
            continue;
          }

          // Process each file in the capture
          for (const file of capture.files) {
            const zipFile = captureDir.file(file.name);
            if (!zipFile) {
              console.warn(`File not found: ${file.name}`);
              continue;
            }

            const content = await (zipFile as JSZip.JSZipObject).async('blob');
            let parsedContent: unknown = content;
            let isValid: boolean | undefined;

            // Validate RadioHound files
            if (vizRecord.capture_type === 'rh') {
              parsedContent = JSON.parse(await content.text());
              const validationResult =
                RadioHoundFileSchema.safeParse(parsedContent);
              isValid = validationResult.success;

              if (!isValid) {
                console.warn(
                  `Invalid RadioHound file content for ${file.name}: ${validationResult.error}`,
                );
              }
            }

            // Add the file to our files object
            files[file.uuid] = {
              uuid: file.uuid,
              name: file.name,
              fileContent: parsedContent,
              isValid,
            };
          }
        }

        setFiles(files);
      } catch (error) {
        console.error('Error fetching visualization files:', error);
        setError('Failed to fetch visualization files');
      } finally {
        setIsLoading(false);
      }
    };
    fetchFiles();
  }, [vizRecord]);

  return { files, isLoading, error };
};
