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
import { FilesWithData } from '../components/types';

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
  const [files, setFiles] = useState<FilesWithData>({});

  useEffect(() => {
    const fetchVisualization = async () => {
      if (!vizId) {
        setError('No visualization ID provided');
        setIsLoading(false);
        return;
      }

      try {
        const vizState = await getVisualization(vizId);
        const files: FilesWithData = {};

        for (const capture of vizState.captures) {
          for (const file of capture.files) {
            const fileData = await getFileContent(file.id, capture.source);
            files[file.id] = {
              ...file,
              fileData,
            };
          }
        }

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
