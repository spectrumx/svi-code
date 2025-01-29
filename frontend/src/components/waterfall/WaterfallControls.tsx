import React, { useCallback } from 'react';
import { Form, InputGroup } from 'react-bootstrap';

import { WaterfallSettings } from '../../pages/WaterfallPage';

interface WaterfallControlsProps {
  settings: WaterfallSettings;
  setSettings: (settings: WaterfallSettings) => void;
  numCaptures: number;
}

export const WaterfallControls: React.FC<WaterfallControlsProps> = ({
  settings,
  setSettings,
  numCaptures,
}: WaterfallControlsProps) => {
  // Handle capture index changes from either slider or number input
  const handleCaptureIndexChange = useCallback(
    (newValue: number) => {
      // Ensure the value stays within bounds
      const boundedValue = Math.max(0, Math.min(newValue, numCaptures - 1));
      setSettings({
        ...settings,
        captureIndex: boundedValue,
      });
    },
    [settings, setSettings, numCaptures],
  );

  // Handle keyboard arrow keys for fine-tuning
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handleCaptureIndexChange(settings.captureIndex - 1);
        e.preventDefault();
      } else if (e.key === 'ArrowRight') {
        handleCaptureIndexChange(settings.captureIndex + 1);
        e.preventDefault();
      }
    },
    [settings.captureIndex, handleCaptureIndexChange],
  );

  return (
    <Form>
      <Form.Group>
        <Form.Label htmlFor="captureIndexSlider">Capture Index</Form.Label>
        <InputGroup>
          <Form.Range
            id="captureIndexSlider"
            name="captureIndex"
            value={settings.captureIndex + 1}
            min={1}
            max={numCaptures}
            onChange={(e) =>
              handleCaptureIndexChange(Number(e.target.value) - 1)
            }
            onKeyDown={handleKeyDown}
            aria-label="Capture index slider"
          />
          <InputGroup.Text>
            <Form.Control
              type="number"
              value={settings.captureIndex + 1}
              onChange={(e) =>
                handleCaptureIndexChange(Number(e.target.value) - 1)
              }
              onKeyDown={handleKeyDown}
              min={1}
              max={numCaptures}
              style={{ width: '80px' }}
              aria-label="Capture index number input"
            />
          </InputGroup.Text>
          <InputGroup.Text>of {numCaptures}</InputGroup.Text>
        </InputGroup>
      </Form.Group>
    </Form>
  );
};

export default React.memo(WaterfallControls);
