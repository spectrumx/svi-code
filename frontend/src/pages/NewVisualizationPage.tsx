import { useState, useCallback, useEffect } from 'react';
import { Link } from 'react-router';
import { Row, Col, Card } from 'react-bootstrap';
import _ from 'lodash';

import Button from '../components/Button';
import CaptureTable from '../components/CaptureTable';
import { useAppContext } from '../utils/AppContext';
import { SpectrogramSettings } from './SpectrogramPage';
import { useSyncCaptures, CaptureType } from '../apiClient/fileService';
import { Capture } from '../apiClient/fileService';

interface VisualizationType {
  name: 'spectrogram' | 'waterfall';
  description: string;
  icon: string;
  supportedCaptureTypes: CaptureType[];
}

export const VISUALIZATION_TYPES: VisualizationType[] = [
  {
    name: 'spectrogram',
    description: 'Visualize signal strength across frequency and time',
    icon: 'bi-graph-up',
    supportedCaptureTypes: ['sigmf'],
  },
  {
    name: 'waterfall',
    description:
      'View signal data as a scrolling waterfall display with periodogram',
    icon: 'bi-water',
    supportedCaptureTypes: ['rh'],
  },
];

/**
 * A wizard-style page for creating new visualizations
 * Guides users through selecting data source, visualization type, and configuration
 */
const NewVisualizationPage = () => {
  const { captures } = useAppContext();
  const syncCaptures = useSyncCaptures();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedType, setSelectedType] = useState<
    VisualizationType['name'] | null
  >(null);
  const [selectedCapture, setSelectedCapture] = useState<Capture | null>(null);

  // For now, we're just displaying all RadioHound captures in the
  // waterfall visualization
  const finalCaptureId =
    selectedType === 'waterfall' ? '' : String(selectedCapture?.id);

  const [spectrogramSettings, setSpectrogramSettings] =
    useState<SpectrogramSettings>({
      fftSize: 1024,
    });

  // Check if a visualization type is supported for a given capture type
  const isSupported = (
    visualizationType: VisualizationType,
    captureType: CaptureType,
  ) => visualizationType.supportedCaptureTypes.includes(captureType);

  // List supported visualization types first
  const sortedVisualizationTypes = selectedCapture
    ? _.partition(VISUALIZATION_TYPES, (visualizationType) =>
        isSupported(visualizationType, selectedCapture.type),
      ).flat()
    : VISUALIZATION_TYPES;

  const handleCaptureSelect = useCallback(
    (id: number) => {
      setSelectedCapture(captures.find((capture) => capture.id === id) || null);
      setCurrentStep(2);
    },
    [captures],
  );

  const handleTypeSelect = useCallback(
    async (type: VisualizationType['name']) => {
      setSelectedType(type);
      setCurrentStep(3);
    },
    [],
  );

  const renderChooseCaptureStep = () => (
    <div>
      <h6>Select a capture to visualize:</h6>
      <CaptureTable
        captures={captures}
        selectedId={selectedCapture?.id}
        onSelect={handleCaptureSelect}
      />
    </div>
  );

  const renderVisualizationTypeStep = () => (
    <Row className="g-4">
      {sortedVisualizationTypes.map((visualizationType) => {
        const typeIsSupported = selectedCapture
          ? isSupported(visualizationType, selectedCapture.type)
          : false;

        return (
          <Col key={visualizationType.name} md={6}>
            <Card
              role={typeIsSupported ? 'button' : 'presentation'}
              tabIndex={typeIsSupported ? 0 : -1}
              className={`h-100 ${
                selectedType === visualizationType.name ? 'border-primary' : ''
              }`}
              style={{
                opacity: typeIsSupported ? 1 : 0.5,
                cursor: typeIsSupported ? 'pointer' : 'not-allowed',
              }}
              onClick={() =>
                typeIsSupported && handleTypeSelect(visualizationType.name)
              }
              onKeyPress={(e) => {
                if (typeIsSupported && (e.key === 'Enter' || e.key === ' ')) {
                  handleTypeSelect(visualizationType.name);
                }
              }}
            >
              <Card.Body>
                <Card.Title>
                  <i className={`bi ${visualizationType.icon} me-2`}></i>
                  {visualizationType.name.charAt(0).toUpperCase() +
                    visualizationType.name.slice(1)}
                </Card.Title>
                <Card.Text>
                  {visualizationType.description}
                  <br />
                  <span className="text-muted">
                    <span>Supported capture types: </span>
                    {visualizationType.supportedCaptureTypes.join(', ')}
                  </span>
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        );
      })}
    </Row>
  );

  const renderExtraConfigStep = () => (
    <div>
      {selectedType === 'spectrogram' && (
        <div>
          <h6>Spectrogram Settings:</h6>
          <label htmlFor="fftSize">FFT Size:</label>
          <select
            id="fftSize"
            value={spectrogramSettings.fftSize}
            onChange={(e) =>
              setSpectrogramSettings({
                ...spectrogramSettings,
                fftSize: Number(e.target.value),
              })
            }
          >
            <option value="512">512</option>
            <option value="1024">1024</option>
            <option value="2048">2048</option>
            <option value="4096">4096</option>
          </select>
        </div>
      )}
      {selectedType === 'waterfall' && (
        <div>
          <h6>Waterfall Settings:</h6>
          <p>No additional configuration needed</p>
        </div>
      )}
    </div>
  );

  const renderStepHeader = (stepNumber: number, title: string) => {
    const isCompleted = currentStep > stepNumber;
    const isCurrent = currentStep === stepNumber;

    return (
      <div className="d-flex align-items-center gap-2 mb-3">
        <div
          className={`rounded-circle d-flex align-items-center justify-content-center`}
          style={{
            width: '32px',
            height: '32px',
            border: '2px solid',
            borderColor: isCompleted
              ? 'var(--bs-success)'
              : isCurrent
                ? 'var(--bs-primary)'
                : 'var(--bs-gray)',
          }}
        >
          {isCompleted ? (
            <i className="bi bi-check-lg text-success" />
          ) : (
            <span className={isCurrent ? 'text-primary' : 'text-muted'}>
              {stepNumber}
            </span>
          )}
        </div>
        <h5 className={isCurrent ? 'text-primary mb-0' : 'text-muted mb-0'}>
          {title}
        </h5>
      </div>
    );
  };

  useEffect(() => {
    syncCaptures();
  }, [syncCaptures]);

  return (
    <div className="page-container">
      <h5>Create a New Visualization</h5>
      <div className="mt-4">
        {/* Step 1 */}
        <div className="mb-4">
          {renderStepHeader(1, 'Select Data Source')}
          {currentStep >= 1 && (
            <div className={currentStep > 1 ? 'opacity-75' : ''}>
              {renderChooseCaptureStep()}
            </div>
          )}
        </div>

        {/* Step 2 */}
        {currentStep >= 2 && (
          <div className="mb-4">
            {renderStepHeader(2, 'Choose Visualization Type')}
            <div className={currentStep > 2 ? 'opacity-75' : ''}>
              {renderVisualizationTypeStep()}
              {currentStep === 2 && (
                <div className="d-flex gap-2 mt-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCurrentStep((prev) => prev - 1);
                      setSelectedType(null);
                      setSelectedCapture(null);
                    }}
                  >
                    Back
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 3 */}
        {currentStep >= 3 && (
          <div className="mb-4">
            {renderStepHeader(3, 'Configure Settings')}
            <div>
              {renderExtraConfigStep()}
              <div className="d-flex gap-2 mt-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCurrentStep((prev) => prev - 1);
                    setSelectedType(null);
                  }}
                >
                  Back
                </Button>
                <Link to={`/visualization/${selectedType}/${finalCaptureId}`}>
                  <Button
                    variant="primary"
                    disabled={!selectedType || !selectedCapture?.id}
                  >
                    Create Visualization
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NewVisualizationPage;
