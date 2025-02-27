import React from 'react';
import { Button, ButtonGroup, Form } from 'react-bootstrap';
import _ from 'lodash';

interface PlaybackControlsProps {
  isPlaying: boolean;
  onPlayClick: () => void;
  playbackSpeed: string;
  onSpeedChange: (speed: string) => void;
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
  const speedOptions = ['0.5 fps', '1 fps', '2 fps', '5 fps', 'realtime'];

  return (
    <div className="d-flex align-items-center gap-2">
      <ButtonGroup>
        <Button
          variant={isPlaying ? 'secondary' : 'primary'}
          onClick={onPlayClick}
          aria-label={isPlaying ? 'Pause playback' : 'Start playback'}
          className={isPlaying ? 'blinking-button' : ''}
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
          onChange={(e) => onSpeedChange(e.target.value)}
          style={{ width: 'auto' }}
          aria-label="Playback speed"
        >
          {speedOptions.map((speed) => (
            <option key={speed} value={speed}>
              {_.capitalize(speed)}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    </div>
  );
};

export default React.memo(PlaybackControls);
