import React from 'react';
import { Form } from 'react-bootstrap';
import { CaptureSource, CAPTURE_SOURCES } from '../../apiClient/fileService';

interface SourceFilterProps {
  selectedSources: CaptureSource[];
  onSourceChange: (source: CaptureSource) => void;
  className?: string;
}

export const SourceFilter: React.FC<SourceFilterProps> = ({
  selectedSources,
  onSourceChange,
  className,
}) => {
  return (
    <div className={className}>
      <h6>Filter by Source</h6>
      <Form.Group controlId="sourceFilter">
        {Object.keys(CAPTURE_SOURCES).map((sourceKey) => {
          const sourceValue = sourceKey as CaptureSource;
          return (
            <Form.Check
              key={sourceValue}
              type="checkbox"
              label={CAPTURE_SOURCES[sourceValue].name}
              value={sourceValue}
              checked={selectedSources.includes(sourceValue)}
              onChange={() => onSourceChange(sourceValue)}
            />
          );
        })}
      </Form.Group>
    </div>
  );
};
