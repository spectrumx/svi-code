import React from 'react';
import { Card } from 'react-bootstrap';
import { useNavigate } from 'react-router';

interface VisualizationCardProps {
  id: number;
  type: string;
  captureType: string;
  captureSource: string;
  captureCount: number;
}

/**
 * A card component that displays visualization information and navigates to the visualization
 * details page when clicked.
 */
export const VisualizationCard: React.FC<VisualizationCardProps> = ({
  id,
  type,
  captureType,
  captureSource,
  captureCount,
}) => {
  const navigate = useNavigate();

  return (
    <Card
      onClick={() => navigate(`/visualization/${id}`)}
      className="mb-3 visualization-card"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          navigate(`/visualization/${id}`);
        }
      }}
    >
      <Card.Body>
        <Card.Title className="d-flex align-items-center">
          <i className="bi bi-graph-up me-2"></i>
          {type}
        </Card.Title>
        <Card.Text>
          <strong>Capture Type:</strong> {captureType}
        </Card.Text>
        <Card.Text>
          <strong>Source:</strong> {captureSource}
        </Card.Text>
        <Card.Text className="mb-0">
          <strong>Number of Captures:</strong> {captureCount}
        </Card.Text>
      </Card.Body>
    </Card>
  );
};
