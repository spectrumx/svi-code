import React, { useCallback, useState, useEffect } from 'react';
import { Form, InputGroup, Button } from 'react-bootstrap';
import debounce from 'lodash/debounce';

import { WaterfallSettings } from '../../pages/WaterfallPage';
import _ from 'lodash';

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
  const captureIndexTextInputRef = React.useRef<HTMLInputElement>(null);
  // Local state for immediate UI updates
  const [localCaptureIndex, setLocalCaptureIndex] = useState(
    settings.captureIndex,
  );

  // Update local state when props change
  useEffect(() => {
    console.log('Updating local capture index from props');
    setLocalCaptureIndex(settings.captureIndex);
  }, [settings.captureIndex]);

  // Debounced function to update parent state
  const debouncedSetSettings = useCallback(
    debounce((newValue: number) => {
      console.log('Updating parent capture index from debounce');
      setSettings({
        ...settings,
        captureIndex: newValue,
      });
      setLocalCaptureIndex(newValue);
    }, 150),
    [settings, setSettings],
  );

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      console.log('Cancelling debounce');
      debouncedSetSettings.cancel();
    };
  }, [debouncedSetSettings]);

  const handleCaptureIndexChange = useCallback(
    (newValue: number) => {
      // Update local state immediately
      setLocalCaptureIndex(newValue);

      // Ensure the value stays within bounds
      const boundedValue = _.clamp(newValue, 0, numCaptures - 1);

      const focusedElement = document.activeElement;
      const isButtonDisabled =
        focusedElement?.tagName === 'BUTTON' &&
        (boundedValue === 0 || boundedValue === numCaptures - 1);

      if (isButtonDisabled) {
        // If disabled button is focused, move focus to text input
        captureIndexTextInputRef.current?.focus();
      }

      // Debounce the update to parent
      debouncedSetSettings(boundedValue);
    },
    [numCaptures, debouncedSetSettings],
  );

  // Handle keyboard arrow keys for any control
  const handleCaptureIndexKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowLeft':
        case 'ArrowDown':
          handleCaptureIndexChange(localCaptureIndex - 1);
          e.preventDefault();
          break;
        case 'ArrowRight':
        case 'ArrowUp':
          handleCaptureIndexChange(localCaptureIndex + 1);
          e.preventDefault();
          break;
      }
    },
    [localCaptureIndex, handleCaptureIndexChange],
  );

  return (
    <Form>
      <Form.Group>
        <Form.Label htmlFor="captureIndexSlider">Capture Index</Form.Label>
        <div
          className="d-flex align-items-center gap-2"
          style={{ marginBottom: '5px' }}
        >
          <span className="text-muted">1</span>
          <Form.Range
            id="captureIndexSlider"
            name="captureIndex"
            value={localCaptureIndex + 1}
            min={1}
            max={numCaptures}
            onChange={(e) =>
              handleCaptureIndexChange(Number(e.target.value) - 1)
            }
            onKeyDown={handleCaptureIndexKeyDown}
            aria-label="Capture index slider"
            tabIndex={0}
          />
          <span className="text-muted">{numCaptures}</span>
        </div>
        <div className="d-flex align-items-center gap-2">
          <InputGroup className="justify-content-center">
            <Button
              variant="secondary"
              onClick={() => handleCaptureIndexChange(localCaptureIndex - 1)}
              onKeyDown={handleCaptureIndexKeyDown}
              disabled={localCaptureIndex === 0}
              aria-label="Previous capture"
            >
              <i className="bi bi-chevron-left" />
            </Button>
            <InputGroup.Text>
              <Form.Control
                ref={captureIndexTextInputRef}
                type="number"
                value={localCaptureIndex + 1}
                onChange={(e) =>
                  handleCaptureIndexChange(Number(e.target.value) - 1)
                }
                onKeyDown={handleCaptureIndexKeyDown}
                min={1}
                max={numCaptures}
                style={{
                  // Hide up/down buttons
                  WebkitAppearance: 'none',
                  MozAppearance: 'textfield',
                  textAlign: 'center',
                }}
                aria-label="Capture index number input"
              />
            </InputGroup.Text>
            <Button
              variant="secondary"
              onClick={() => handleCaptureIndexChange(localCaptureIndex + 1)}
              onKeyDown={handleCaptureIndexKeyDown}
              disabled={localCaptureIndex === numCaptures - 1}
              aria-label="Next capture"
            >
              <i className="bi bi-chevron-right" />
            </Button>
          </InputGroup>
        </div>
      </Form.Group>
    </Form>
  );
};

export default React.memo(WaterfallControls);
