import { Form } from 'react-bootstrap';
import { SpectrogramSettings } from './SpectrogramVizContainer';

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
}

const SpectrogramControls = ({
  settings,
  setSettings,
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
      <Form.Group className="mb-3">
        <Form.Label>FFT Size</Form.Label>
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
        <Form.Text className="text-muted">
          Larger values provide better frequency resolution but lower time
          resolution
        </Form.Text>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Window Standard Deviation (samples)</Form.Label>
        <Form.Control
          type="number"
          name="stdDev"
          value={settings.stdDev}
          onChange={handleNumberChange}
          min="10"
          max="500"
        />
        <Form.Text className="text-muted">
          Controls the width of the Gaussian window. Larger values provide
          better frequency resolution but lower time resolution
        </Form.Text>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Hop Size (samples)</Form.Label>
        <Form.Control
          type="number"
          name="hopSize"
          value={settings.hopSize}
          onChange={handleNumberChange}
          min="100"
          max="1000"
        />
        <Form.Text className="text-muted">
          Controls the time step between consecutive FFTs. Smaller values
          provide better time resolution
        </Form.Text>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Colormap</Form.Label>
        <Form.Select
          name="colormap"
          value={settings.colormap}
          onChange={handleSelectChange}
        >
          {colormapOptions.map((cmap) => (
            <option key={cmap} value={cmap}>
              {cmap}
            </option>
          ))}
        </Form.Select>
        <Form.Text className="text-muted">
          Choose a color scheme for the spectrogram visualization
        </Form.Text>
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Figure Width (inches)</Form.Label>
        <Form.Control
          type="number"
          name="width"
          value={settings.width}
          onChange={handleNumberChange}
          min="4"
          max="20"
          step="0.5"
        />
      </Form.Group>

      <Form.Group className="mb-3">
        <Form.Label>Figure Height (inches)</Form.Label>
        <Form.Control
          type="number"
          name="height"
          value={settings.height}
          onChange={handleNumberChange}
          min="4"
          max="20"
          step="0.5"
        />
      </Form.Group>
    </Form>
  );
};

export default SpectrogramControls;
