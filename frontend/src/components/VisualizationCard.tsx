import React, { useEffect, useState } from 'react';
import { Card } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import _ from 'lodash';

import {
  CAPTURE_TYPE_INFO,
  CAPTURE_SOURCES,
} from '../apiClient/captureService';
import {
  VISUALIZATION_TYPES,
  VisualizationRecord,
  getVisualization,
} from '../apiClient/visualizationService';
import './components.css';

interface VisualizationCardProps {
  vizRecord: VisualizationRecord;
  onDeleteClick?: (vizRecord: VisualizationRecord) => void;
}

/**
 * Custom hook to fetch the total number of files across all captures in a visualization
 */
const useVisualizationFileCount = (uuid: string) => {
  const [fileCount, setFileCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchFileCount = async () => {
      try {
        setIsLoading(true);
        const data = await getVisualization(uuid);
        const totalFiles = data.captures.reduce(
          (sum, capture) => sum + (capture.files?.length ?? 0),
          0,
        );
        setFileCount(totalFiles);
      } catch (err) {
        setError(
          err instanceof Error
            ? err
            : new Error('Failed to fetch visualization details'),
        );
        console.error('Error fetching visualization details:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchFileCount();
  }, [uuid]);

  return { fileCount, isLoading, error };
};

/**
 * A card component that displays visualization information and navigates to the visualization
 * details page when clicked.
 */
export const VisualizationCard: React.FC<VisualizationCardProps> = ({
  vizRecord,
  onDeleteClick,
}) => {
  const navigate = useNavigate();
  const { fileCount, isLoading, error } = useVisualizationFileCount(
    vizRecord.uuid,
  );
  const visualizationType = VISUALIZATION_TYPES.find(
    (v) => v.name === vizRecord.type,
  );

  const handleCardClick = (e: React.MouseEvent) => {
    // Prevent navigation if clicking the delete button
    if ((e.target as HTMLElement).closest('.delete-button')) {
      e.preventDefault();
      e.stopPropagation();
      return;
    }
    navigate(`/visualization/${vizRecord.uuid}`);
  };

  return (
    <Card
      onClick={handleCardClick}
      className="mb-3 visualization-card"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/visualization/${vizRecord.uuid}`);
        }
      }}
    >
      <Card.Body>
        <div className="d-flex justify-content-between align-items-start">
          <Card.Title className="d-flex align-items-center">
            <i
              className={`bi ${visualizationType?.icon ?? 'bi-graph-up'} me-2`}
            ></i>
            {vizRecord.name}
          </Card.Title>
          {onDeleteClick && (
            <button
              className="btn btn-link delete-button"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                onDeleteClick?.(vizRecord);
              }}
              aria-label="Delete visualization"
            >
              <i className="bi bi-trash text-danger"></i>
            </button>
          )}
        </div>
        <Card.Text>
          <span className="text-muted">
            Created {new Date(vizRecord.created_at).toLocaleString()}
          </span>
          <br />
          <strong> Type: </strong>
          {_.startCase(vizRecord.type)}
          <br />
          <strong>Capture Type:</strong>{' '}
          {CAPTURE_TYPE_INFO[vizRecord.capture_type].name}
          <br />
          <strong>Source:</strong>{' '}
          {CAPTURE_SOURCES[vizRecord.capture_source].name}
          <br />
          <strong>Total Files:</strong>{' '}
          {isLoading ? (
            <span className="text-muted">Loading...</span>
          ) : error ? (
            <span className="text-danger">Error loading files</span>
          ) : (
            (fileCount ?? 'Unknown')
          )}
        </Card.Text>
      </Card.Body>
    </Card>
  );
};
