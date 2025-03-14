import { useEffect, useState } from 'react';
import { useParams, Navigate } from 'react-router';

import LoadingSpinner from '../components/LoadingSpinner';
import SpectrogramPage from './SpectrogramPage';
import WaterfallPage from './WaterfallPage';
import {
  Visualization,
  getVisualization,
  getVisualizations,
  useSyncVisualizations,
} from '../apiClient/visualizationService';
import { useAppContext } from '../utils/AppContext';

interface SpectrogramPageProps {
  captureId: string;
  settings: Record<string, any>;
}

interface WaterfallPageProps {
  captureIds: string[];
  settings: Record<string, any>;
}

// Type assertion to handle component props
const SpectrogramPageWithProps =
  SpectrogramPage as React.FC<SpectrogramPageProps>;
const WaterfallPageWithProps = WaterfallPage as React.FC<WaterfallPageProps>;

/**
 * Router component for visualization pages.
 * Fetches visualization data based on URL parameter and renders the appropriate visualization component.
 */
const VisualizationPage = () => {
  const { id } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visualization, setVisualization] = useState<Visualization | null>(
    null,
  );

  useEffect(() => {
    const fetchVisualization = async () => {
      if (!id) {
        setError('No visualization ID provided');
        setIsLoading(false);
        return;
      }

      try {
        const viz = await getVisualization(id);
        setVisualization(viz);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load visualization',
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisualization();
  }, [id]);

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

  if (!visualization) {
    return <Navigate to="/visualizations" replace />;
  }

  return (
    <div className="page-container">
      <h1>Type: {visualization.type}</h1>
      <p>
        Captures ({visualization.capture_ids.length}):{' '}
        {visualization.capture_ids.join(', ')}
      </p>
      <p>Capture Type: {visualization.capture_type}</p>
      <p>Capture Source: {visualization.capture_source}</p>
    </div>
  );

  // Route to the appropriate visualization page based on type
  // switch (visualization.type) {
  //   case 'spectrogram':
  //     return (
  //       <SpectrogramPageWithProps
  //         captureId={visualization.capture_ids[0]}
  //         settings={visualization.settings}
  //       />
  //     );
  //   case 'waterfall':
  //     return (
  //       <WaterfallPageWithProps
  //         captureIds={visualization.capture_ids}
  //         settings={visualization.settings}
  //       />
  //     );
  //   default:
  //     return (
  //       <div className="alert alert-danger" role="alert">
  //         Unsupported visualization type: {visualization.type}
  //       </div>
  //     );
  // }
};

export default VisualizationPage;
