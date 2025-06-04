import { Form, OverlayTrigger, Tooltip } from 'react-bootstrap';
import { SpectrogramSettings } from './SpectrogramVizContainer';
import _ from 'lodash';

// Powers of 2 from 64 to 65536
const fftSizeOptions = Array.from({ length: 11 }, (_, i) => Math.pow(2, i + 6));

// Colormap options
const colormapOptions = [
  'magma',
  'viridis',
  'plasma',
  'inferno',
  'cividis',
  'turbo',
  'jet',
  'hot',
  'cool',
  'rainbow',
];

interface SpectrogramControlsProps {
  settings: SpectrogramSettings;
  setSettings: (settings: SpectrogramSettings) => void;
  numSubchannels?: number;
}

const SpectrogramControls = ({
  settings,
  setSettings,
  numSubchannels,
}: SpectrogramControlsProps) => {
  // Separate handlers for different input types
  const handleSelectChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings({
      ...settings,
      [name]: name === 'colormap' ? value : Number(value),
    });
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings({
      ...settings,
      [name]: Number(value),
    });
  };

  return (
    <Form>
      {numSubchannels && numSubchannels > 1 && (
        <Form.Group className="mb-3">
          <Form.Label>
            <div className="d-flex align-items-center gap-1">
              Subchannel
              <OverlayTrigger
                placement="right"
                overlay={
                  <Tooltip id="subchannel-tooltip">
                    Select which subchannel to visualize in the spectrogram
                  </Tooltip>
                }
              >
                <i
                  className="bi bi-info-circle text-muted"
                  aria-hidden="true"
                />
              </OverlayTrigger>
            </div>
          </Form.Label>
          <Form.Select
            name="subchannel"
            value={settings.subchannel}
            onChange={handleSelectChange}
          >
            {Array.from({ length: numSubchannels }, (_, i) => (
              <option key={i} value={i}>
                {i}
              </option>
            ))}
          </Form.Select>
        </Form.Group>
      )}

      <Form.Group className="mb-3">
        <Form.Label>
          <div className="d-flex align-items-center gap-1">
            FFT Size
            <OverlayTrigger
              placement="right"
              overlay={
                <Tooltip id="fft-size-tooltip">
                  Larger values provide better frequency resolution but lower
                  time resolution
                </Tooltip>
              }
            >
              <i className="bi bi-info-circle text-muted" aria-hidden="true" />
            </OverlayTrigger>
          </div>
        </Form.Label>
        <Form.Select
          name="fftSize"
          value={settings.fftSize}
          onChange={handleSelectChange}
        >
          {fftSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Form.Select>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>
          <div className="d-flex align-items-center gap-1">
            Window Standard Deviation (samples)
            <OverlayTrigger
              placement="right"
              overlay={
                <Tooltip id="std-dev-tooltip">
                  Controls the width of the Gaussian window. Larger values
                  provide better frequency resolution but lower time resolution
                </Tooltip>
              }
            >
              <i className="bi bi-info-circle text-muted" aria-hidden="true" />
            </OverlayTrigger>
          </div>
        </Form.Label>
        <Form.Control
          type="number"
          name="stdDev"
          value={settings.stdDev}
          onChange={handleNumberChange}
          min="10"
          max="500"
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>
          <div className="d-flex align-items-center gap-1">
            Hop Size (samples)
            <OverlayTrigger
              placement="right"
              overlay={
                <Tooltip id="hop-size-tooltip">
                  Controls the time step between consecutive FFTs. Smaller
                  values provide better time resolution
                </Tooltip>
              }
            >
              <i className="bi bi-info-circle text-muted" aria-hidden="true" />
            </OverlayTrigger>
          </div>
        </Form.Label>
        <Form.Control
          type="number"
          name="hopSize"
          value={settings.hopSize}
          onChange={handleNumberChange}
          min="100"
          max="1000"
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>
          <div className="d-flex align-items-center gap-1">
            Colormap
            <OverlayTrigger
              placement="right"
              overlay={
                <Tooltip id="colormap-tooltip">
                  Choose a color scheme for the spectrogram visualization
                </Tooltip>
              }
            >
              <i className="bi bi-info-circle text-muted" aria-hidden="true" />
            </OverlayTrigger>
          </div>
        </Form.Label>
        <Form.Select
          name="colormap"
          value={settings.colormap}
          onChange={handleSelectChange}
        >
          {colormapOptions.map((cmap) => (
            <option key={cmap} value={cmap}>
              {_.capitalize(cmap)}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    </Form>
  );
};

export default SpectrogramControls;
