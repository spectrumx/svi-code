import { Form } from 'react-bootstrap';
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
              {_.capitalize(cmap)}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    </Form>
  );
};

export default SpectrogramControls;
