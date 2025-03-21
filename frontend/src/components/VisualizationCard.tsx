import React from 'react';
import { Card } from 'react-bootstrap';
import { useNavigate } from 'react-router';
import _ from 'lodash';

import {
  CAPTURE_TYPES,
  CAPTURE_SOURCES,
  CaptureType,
  CaptureSource,
} from '../apiClient/fileService';
import {
  VISUALIZATION_TYPES,
  VisualizationType,
} from '../apiClient/visualizationService';

interface VisualizationCardProps {
  id: number;
  type: VisualizationType;
  captureType: CaptureType;
  captureSource: CaptureSource;
  captures: string[];
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
  captures,
}) => {
  const navigate = useNavigate();
  const visualizationType = VISUALIZATION_TYPES.find((v) => v.name === type);

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
          <i
            className={`bi ${visualizationType?.icon ?? 'bi-graph-up'} me-2`}
          ></i>
          {_.startCase(type)}
        </Card.Title>
        <Card.Text>
          <strong>Capture Type:</strong> {CAPTURE_TYPES[captureType].name}
          <br />
          <strong>Source:</strong> {CAPTURE_SOURCES[captureSource].name}
          <br />
          <strong>Number of Captures:</strong> {captures.length}
        </Card.Text>
      </Card.Body>
    </Card>
  );
};
