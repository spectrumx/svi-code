import { Form } from 'react-bootstrap';
import { SpectrogramSettings } from '../../pages/SpectrogramPage';

// Powers of 2 from 64 to 65536
const fftSizeOptions = Array.from({ length: 11 }, (_, i) => Math.pow(2, i + 6));

interface SpectrogramControlsProps {
  settings: SpectrogramSettings;
  setSettings: (settings: SpectrogramSettings) => void;
}

const SpectrogramControls = ({
  settings,
  setSettings,
}: SpectrogramControlsProps) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const { name, value } = e.target;
    setSettings({
      ...settings,
      [name]: Number(value),
    });
  };

  return (
    <Form>
      <Form.Group>
        <Form.Label>FFT Size [dummy control]</Form.Label>
        <Form.Select
          name="fftSize"
          value={settings.fftSize}
          onChange={handleChange}
        >
          {fftSizeOptions.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </Form.Select>
      </Form.Group>
    </Form>
  );
};

export default SpectrogramControls;
