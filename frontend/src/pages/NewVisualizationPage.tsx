import { useState, useCallback, useEffect, useMemo } from 'react';
import { Link } from 'react-router';
import { Row, Col, Card } from 'react-bootstrap';
import _ from 'lodash';

import Button from '../components/Button';
import CaptureTable from '../components/CaptureTable';
import { useAppContext } from '../utils/AppContext';
import { SpectrogramSettings } from './SpectrogramPage';
import {
  useSyncCaptures,
  CaptureType,
  CAPTURE_TYPES,
} from '../apiClient/fileService';

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
  const [selectedCaptureType, setSelectedCaptureType] =
    useState<CaptureType | null>(null);
  const [selectedVizType, setSelectedVizType] = useState<
    VisualizationType['name'] | null
  >(null);
  const [selectedCaptureIds, setSelectedCaptureIds] = useState<number[]>([]);

  // Filter captures based on selected type
  const filteredCaptures = selectedCaptureType
    ? captures.filter((capture) => capture.type === selectedCaptureType)
    : captures;

  // For now, we're just displaying all RadioHound captures in the
  // waterfall visualization
  const captureIdParam =
    selectedVizType === 'waterfall' ? '' : String(selectedCaptureIds[0]);

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
  const sortedVisualizationTypes = selectedCaptureType
    ? _.partition(VISUALIZATION_TYPES, (visualizationType) =>
        isSupported(visualizationType, selectedCaptureType),
      ).flat()
    : VISUALIZATION_TYPES;

  // Get unique capture types from available captures
  const availableCaptureTypes = useMemo(() => {
    const types = new Set(captures.map((capture) => capture.type));
    return Object.entries(CAPTURE_TYPES)
      .filter(([type]) => types.has(type as CaptureType))
      .map(([type, details]) => ({ type: type as CaptureType, ...details }));
  }, [captures]);

  const handleCaptureSelect = useCallback((ids: number[]) => {
    setSelectedCaptureIds(ids);
    setCurrentStep(3);
  }, []);

  const handleTypeSelect = useCallback(
    async (type: VisualizationType['name']) => {
      setSelectedVizType(type);
      setCurrentStep(4);
    },
    [],
  );

  const renderCaptureTypeStep = () => (
    <Row className="g-4">
      {availableCaptureTypes.length > 0 ? (
        availableCaptureTypes.map(({ type, name }) => (
          <Col key={type} md={4}>
            <Card
              role="button"
              tabIndex={0}
              className={`h-100 ${
                selectedCaptureType === type ? 'border-primary' : ''
              }`}
              style={{ cursor: 'pointer' }}
              onClick={() => {
                setSelectedCaptureType(type);
                setCurrentStep(2);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedCaptureType(type);
                  setCurrentStep(2);
                }
              }}
            >
              <Card.Body>
                <Card.Text>
                  <b>{name}</b>
                </Card.Text>
              </Card.Body>
            </Card>
          </Col>
        ))
      ) : (
        <Col>
          <div className="text-center text-muted">
            <p>No captures available. Please upload some captures first.</p>
          </div>
        </Col>
      )}
    </Row>
  );

  const renderVizTypeStep = () => (
    <Row className="g-4">
      {sortedVisualizationTypes.map((visualizationType) => {
        const typeIsSupported = selectedCaptureType
          ? isSupported(visualizationType, selectedCaptureType)
          : false;

        return (
          <Col key={visualizationType.name} md={6}>
            <Card
              role={typeIsSupported ? 'button' : 'presentation'}
              tabIndex={typeIsSupported ? 0 : -1}
              className={`h-100 ${
                selectedVizType === visualizationType.name
                  ? 'border-primary'
                  : ''
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
                    {visualizationType.supportedCaptureTypes.map(
                      (type) => CAPTURE_TYPES[type].name,
                    )}
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
      {selectedVizType === 'spectrogram' && (
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
      {selectedVizType === 'waterfall' && (
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
        {/* Step 1 - Select Capture Type */}
        <div className="mb-4">
          {renderStepHeader(1, 'Select Capture Type')}
          {currentStep >= 1 && (
            <div className={currentStep > 1 ? 'opacity-75' : ''}>
              {renderCaptureTypeStep()}
            </div>
          )}
        </div>

        {/* Step 2 - Select Data Source */}
        {currentStep >= 2 && (
          <div className="mb-4">
            {renderStepHeader(2, 'Select Data Source')}
            <div className={currentStep > 2 ? 'opacity-75' : ''}>
              <div>
                <h6>
                  Select a {CAPTURE_TYPES[selectedCaptureType!].name} capture to
                  visualize:
                </h6>
                <CaptureTable
                  captures={filteredCaptures}
                  selectedIds={selectedCaptureIds}
                  onSelect={handleCaptureSelect}
                  selectionMode="single"
                />
                {currentStep === 2 && (
                  <div className="d-flex gap-2 mt-3">
                    <Button
                      variant="secondary"
                      onClick={() => {
                        setCurrentStep((prev) => prev - 1);
                        setSelectedCaptureType(null);
                        setSelectedCaptureIds([]);
                      }}
                    >
                      Back
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3 - Choose Visualization Type */}
        {currentStep >= 3 && (
          <div className="mb-4">
            {renderStepHeader(3, 'Choose Visualization Type')}
            <div className={currentStep > 3 ? 'opacity-75' : ''}>
              {renderVizTypeStep()}
              {currentStep === 3 && (
                <div className="d-flex gap-2 mt-3">
                  <Button
                    variant="secondary"
                    onClick={() => {
                      setCurrentStep((prev) => prev - 1);
                      setSelectedVizType(null);
                    }}
                  >
                    Back
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Step 4 - Configure Settings */}
        {currentStep >= 4 && (
          <div className="mb-4">
            {renderStepHeader(4, 'Configure Settings')}
            <div>
              {renderExtraConfigStep()}
              <div className="d-flex gap-2 mt-3">
                <Button
                  variant="secondary"
                  onClick={() => {
                    setCurrentStep((prev) => prev - 1);
                    setSelectedVizType(null);
                  }}
                >
                  Back
                </Button>
                <Link
                  to={`/visualization/${selectedVizType}/${captureIdParam}`}
                >
                  <Button
                    variant="primary"
                    disabled={
                      !selectedVizType || selectedCaptureIds.length === 0
                    }
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
