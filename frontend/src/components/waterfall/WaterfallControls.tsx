import React, { useCallback, useState, useEffect } from 'react';
import { Form, InputGroup, Button } from 'react-bootstrap';
import _ from 'lodash';
import debounce from 'lodash/debounce';

import { WaterfallSettings } from './WaterfallVizContainer';
import PlaybackControls from './PlaybackControls';
import './waterfall.css';

interface WaterfallControlsProps {
  settings: WaterfallSettings;
  setSettings: React.Dispatch<React.SetStateAction<WaterfallSettings>>;
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
    setLocalCaptureIndex(settings.captureIndex);
  }, [settings.captureIndex]);

  // Debounced function to update parent state
  const debouncedSetCaptureIndex = useCallback(
    debounce((newValue: number) => {
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
      debouncedSetCaptureIndex.cancel();
    };
  }, [debouncedSetCaptureIndex]);

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
      debouncedSetCaptureIndex(boundedValue);
    },
    [numCaptures, debouncedSetCaptureIndex],
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
        <div className="mt-3">
          <PlaybackControls
            isPlaying={settings.isPlaying}
            onPlayClick={() =>
              setSettings((prev) => ({ ...prev, isPlaying: !prev.isPlaying }))
            }
            playbackSpeed={settings.playbackSpeed}
            onSpeedChange={(speed) =>
              setSettings((prev) => ({ ...prev, playbackSpeed: speed }))
            }
          />
        </div>
        <br />
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
                className="capture-index-number-input"
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
