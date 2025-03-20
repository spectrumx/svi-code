import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import JSZip from 'jszip';

import LoadingSpinner from '../components/LoadingSpinner';
import SpectrogramVizContainer from '../components/spectrogram/SpectrogramVizContainer';
import WaterfallVizContainer from '../components/waterfall/WaterfallVizContainer';
import {
  VisualizationStateDetail,
  getVisualization,
  downloadVizFiles,
} from '../apiClient/visualizationService';
import { FilesWithContent } from '../components/types';
import { RadioHoundCaptureSchema } from '../components/waterfall/types';

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
        console.log('vizState.captures', vizState.captures);

        // Download the ZIP file containing all files
        const zipBlob = await downloadVizFiles(vizId);

        // Parse the ZIP file
        const zip = new JSZip();
        const zipContent = await zip.loadAsync(zipBlob);

        // Process each file in the ZIP
        const files: FilesWithContent = {};

        // Process each capture in the visualization state
        for (const capture of vizState.captures) {
          const captureDir = zipContent.folder(capture.id.toString());
          if (!captureDir) {
            console.warn(
              `Capture directory not found for capture ID ${capture.id}`,
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
            if (vizState.capture_type === 'rh') {
              parsedContent = JSON.parse(await content.text());
              const validationResult =
                RadioHoundCaptureSchema.safeParse(parsedContent);
              isValid = validationResult.success;

              if (!isValid) {
                console.warn(
                  `Invalid RadioHound file content for ${file.name}: ${validationResult.error}`,
                );
              }
            }

            // Add the file to our files object
            files[file.id] = {
              id: file.id,
              name: file.name,
              fileContent: parsedContent,
              isValid,
            };
          }
        }

        setVisualizationState(vizState);
        console.log('files', files);
        setFiles(files);
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
