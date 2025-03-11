import React from 'react';
import { Form } from 'react-bootstrap';

interface FrequencyFilterProps {
  minFrequency: string;
  maxFrequency: string;
  onMinFrequencyChange: (value: string) => void;
  onMaxFrequencyChange: (value: string) => void;
  className?: string;
}

export const FrequencyFilter: React.FC<FrequencyFilterProps> = ({
  minFrequency,
  maxFrequency,
  onMinFrequencyChange,
  onMaxFrequencyChange,
  className,
}) => {
  return (
    <div className={className}>
      <h6>Filter by Frequency</h6>
      <Form.Group controlId="minFrequency">
        <Form.Label>Min Frequency (Hz)</Form.Label>
        <Form.Control
          type="number"
          placeholder="Enter min freq"
          value={minFrequency}
          onChange={(e) => onMinFrequencyChange(e.target.value)}
        />
      </Form.Group>

      <Form.Group controlId="maxFrequency" className="mt-2">
        <Form.Label>Max Frequency (Hz)</Form.Label>
        <Form.Control
          type="number"
          placeholder="Enter max freq"
          value={maxFrequency}
          onChange={(e) => onMaxFrequencyChange(e.target.value)}
        />
      </Form.Group>
    </div>
  );
};
