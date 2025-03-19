import { useEffect, useState } from 'react';
import { useParams } from 'react-router';

import LoadingSpinner from '../components/LoadingSpinner';
import SpectrogramVizContainer from '../components/spectrogram/SpectrogramVizContainer';
import WaterfallVizContainer from '../components/waterfall/WaterfallVizContainer';
import {
  VisualizationStateDetail,
  getVisualization,
} from '../apiClient/visualizationService';
import { getFileContent } from '../apiClient/fileService';
import { FilesWithContent, FileWithContent } from '../components/types';
import { RadioHoundCaptureSchema } from '../components/waterfall/types';

/**
 * Helper function to add a delay between requests
 * @param ms - Delay in milliseconds
 * @returns Promise that resolves after the specified delay
 */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Router component for visualization pages.
 * Fetches visualization data based on URL parameter and renders the appropriate visualization component.
 */
const VisualizationPage = () => {
  const { id: vizId } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visualizationState, setVisualizationState] =
    useState<VisualizationStateDetail | null>(null);
  const [files, setFiles] = useState<FilesWithContent>({});

  useEffect(() => {
    const fetchVisualization = async () => {
      if (!vizId) {
        setError('No visualization ID provided');
        setIsLoading(false);
        return;
      }

      try {
        const vizState = await getVisualization(vizId);

        // Create an array of promises for concurrent file downloads with delays
        const fileDownloadPromises = vizState.captures.flatMap((capture) =>
          capture.files.map(async (file) => {
            // Add a small delay before each request
            await delay(500);
            const fileContent = await getFileContent(file.id, capture.source);
            let isValid: boolean | undefined;

            if (capture.type === 'rh') {
              const validationResult =
                RadioHoundCaptureSchema.safeParse(fileContent);
              isValid = validationResult.success;

              if (!isValid) {
                console.warn(
                  `Invalid RadioHound file content for ${file.id}: ${validationResult.error}`,
                );
              }
            }

            return {
              ...file,
              fileContent,
              isValid,
            };
          }),
        );

        // Download all files concurrently
        const downloadedFiles = await Promise.all(fileDownloadPromises);

        // Convert array of results to object
        const files: FilesWithContent = downloadedFiles.reduce(
          (currObj, file: FileWithContent) => ({
            ...currObj,
            [file.id]: file,
          }),
          {} as FilesWithContent,
        );

        setFiles(files);
        setVisualizationState(vizState);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load visualization',
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisualization();
  }, [vizId]);

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!visualizationState) {
    return (
      <div className="alert alert-danger" role="alert">
        No visualization found!
      </div>
    );
  }

  const VizContainer =
    visualizationState.type === 'spectrogram'
      ? SpectrogramVizContainer
      : visualizationState.type === 'waterfall'
        ? WaterfallVizContainer
        : null;

  return VizContainer ? (
    <VizContainer visualizationState={visualizationState} files={files} />
  ) : (
    <div className="alert alert-danger" role="alert">
      Unsupported visualization type: {visualizationState.type}
    </div>
  );
};

export default VisualizationPage;
