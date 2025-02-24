import React from 'react';
import { Button, ButtonGroup, Form } from 'react-bootstrap';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlayClick: () => void;
  playbackSpeed: number;
  onSpeedChange: (speed: number) => void;
}

/**
 * Component for controlling waterfall playback with play/pause and speed controls
 */
export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  onPlayClick,
  playbackSpeed,
  onSpeedChange,
}) => {
  // Predefined speed options in captures per second
  const speedOptions = [0.5, 1, 2, 5];

  return (
    <div className="d-flex align-items-center gap-2">
      <ButtonGroup>
        <Button
          variant={isPlaying ? 'secondary' : 'primary'}
          onClick={onPlayClick}
          aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
        >
          <i className={`bi bi-${isPlaying ? 'pause-fill' : 'play-fill'}`} />
        </Button>
      </ButtonGroup>
      <Form.Group className="d-flex align-items-center gap-2">
        <Form.Label className="mb-0" htmlFor="speedSelect">
          Speed:
        </Form.Label>
        <Form.Select
          id="speedSelect"
          value={playbackSpeed}
          onChange={(e) => onSpeedChange(Number(e.target.value))}
          style={{ width: 'auto' }}
          aria-label="Playback speed"
        >
          {speedOptions.map((speed) => (
            <option key={speed} value={speed}>
              {speed} fps
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    </div>
  );
};

export default React.memo(PlaybackControls);
