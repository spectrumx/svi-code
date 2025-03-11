import React from 'react';
import { Form } from 'react-bootstrap';

interface DateTimeFilterProps {
  startTime: string;
  endTime: string;
  onStartTimeChange: (value: string) => void;
  onEndTimeChange: (value: string) => void;
  className?: string;
}

export const DateTimeFilter: React.FC<DateTimeFilterProps> = ({
  startTime,
  endTime,
  onStartTimeChange,
  onEndTimeChange,
  className,
}) => {
  return (
    <div className={className}>
      <h6>Filter by Date & Time</h6>
      <Form.Group controlId="startTime">
        <Form.Label>Start Time</Form.Label>
        <Form.Control
          type="datetime-local"
          value={startTime}
          onChange={(e) => onStartTimeChange(e.target.value)}
        />
      </Form.Group>
      <Form.Group controlId="endTime" className="mt-2">
        <Form.Label>End Time</Form.Label>
        <Form.Control
          type="datetime-local"
          value={endTime}
          onChange={(e) => onEndTimeChange(e.target.value)}
        />
      </Form.Group>
    </div>
  );
};
