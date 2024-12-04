import { useState } from 'react';
import { Form, Row, Col } from 'react-bootstrap';

const SpectrogramControls = () => {
  const [settings, setSettings] = useState({
    minFreq: 0,
    maxFreq: 8000,
    windowSize: 2048,
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setSettings((prev) => ({
      ...prev,
      [name]: Number(value),
    }));
  };

  return (
    <Form>
      <Row className="mb-3">
        <Col>
          <Form.Group>
            <Form.Label>Min Frequency (Hz)</Form.Label>
            <Form.Control
              type="number"
              name="minFreq"
              value={settings.minFreq}
              onChange={handleChange}
            />
          </Form.Group>
        </Col>
        <Col>
          <Form.Group>
            <Form.Label>Max Frequency (Hz)</Form.Label>
            <Form.Control
              type="number"
              name="maxFreq"
              value={settings.maxFreq}
              onChange={handleChange}
            />
          </Form.Group>
        </Col>
      </Row>
    </Form>
  );
};

export default SpectrogramControls;
