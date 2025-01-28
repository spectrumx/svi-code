import { useState, useCallback } from 'react';
import { Link } from 'react-router';
import { Row, Col, Card } from 'react-bootstrap';

import Button from '../components/Button';
import DatasetTable from '../components/DatasetTable';
import { useAppContext } from '../utils/AppContext';
import { SpectrogramSettings } from './SpectrogramPage';
import { useSyncSigMFFilePairs, useSyncFiles } from '../apiClient/fileService';

interface VisualizationType {
  id: 'spectrogram' | 'waterfall';
  name: string;
  description: string;
  icon: string;
  supportedTypes: 'sigmf' | 'radiohound';
}

const VISUALIZATION_TYPES: VisualizationType[] = [
  {
    id: 'spectrogram',
    name: 'Spectrogram',
    description: 'Visualize signal strength across frequency and time',
    icon: 'bi-graph-up',
    supportedTypes: 'sigmf',
  },
  {
    id: 'waterfall',
    name: 'Waterfall',
    description:
      'View signal data as a scrolling waterfall display with periodogram',
    icon: 'bi-water',
    supportedTypes: 'radiohound',
  },
];

/**
 * A wizard-style page for creating new visualizations
 * Guides users through selecting visualization type, data source, and configuration
 */
const NewVisualizationPage = () => {
  const { sigMFFilePairs, files } = useAppContext();
  const syncSigMFFilePairs = useSyncSigMFFilePairs();
  const syncFiles = useSyncFiles();
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedType, setSelectedType] = useState<
    VisualizationType['id'] | null
  >(null);
  const [selectedCaptureId, setSelectedCaptureId] = useState<number | null>(
    null,
  );
  const [spectrogramSettings, setSpectrogramSettings] =
    useState<SpectrogramSettings>({
      fftSize: 1024,
    });

  // Handle type selection and advance to next step
  const handleTypeSelect = useCallback(
    async (type: VisualizationType['id']) => {
      setSelectedType(type);
      // Load appropriate data based on visualization type
      if (type === 'spectrogram') {
        await syncSigMFFilePairs();
      } else if (type === 'waterfall') {
        await syncFiles();
      }
      setCurrentStep(2);
    },
    [syncSigMFFilePairs, syncFiles],
  );

  // Get the appropriate datasets for the selected visualization type
  const getDatasets = useCallback(() => {
    const selectedVisType = VISUALIZATION_TYPES.find(
      (t) => t.id === selectedType,
    );
    if (!selectedVisType) return [];

    if (selectedVisType.supportedTypes === 'sigmf') {
      return sigMFFilePairs;
    } else if (selectedVisType.supportedTypes === 'radiohound') {
      // For now, just filter out any sigmf files
      return files.filter(
        (file) =>
          !file.name.endsWith('.sigmf-meta') &&
          !file.name.endsWith('.sigmf-data'),
      );
    }
    return [];
  }, [selectedType, sigMFFilePairs, files]);

  // Handle capture selection and advance to next step
  const handleCaptureSelect = useCallback((id: number) => {
    setSelectedCaptureId(id);
    setCurrentStep(3);
  }, []);

  const renderVisualizationTypeStep = () => (
    <Row className="g-4">
      {VISUALIZATION_TYPES.map((type) => (
        <Col key={type.id} md={6}>
          <Card
            role="button"
            tabIndex={0}
            className={`h-100 ${
              selectedType === type.id ? 'border-primary' : ''
            }`}
            onClick={() => handleTypeSelect(type.id)}
            onKeyPress={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                handleTypeSelect(type.id);
              }
            }}
          >
            <Card.Body>
              <Card.Title>
                <i className={`bi ${type.icon} me-2`}></i>
                {type.name}
              </Card.Title>
              <Card.Text>{type.description}</Card.Text>
            </Card.Body>
          </Card>
        </Col>
      ))}
    </Row>
  );

  const renderChooseCaptureStep = () => (
    <div>
      <h6>
        Select a {selectedType === 'spectrogram' ? 'SigMF capture' : 'file'} to
        visualize:
      </h6>
      <DatasetTable
        datasets={getDatasets()}
        selectedId={selectedCaptureId}
        onSelect={handleCaptureSelect}
        type={selectedType === 'spectrogram' ? 'sigmf' : 'file'}
      />
    </div>
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

  return (
    <div>
      <h5>Create a New Visualization</h5>
      <div className="mt-4">
        {/* Step 1 */}
        <div className="mb-4">
          {renderStepHeader(1, 'Choose Visualization Type')}
          {currentStep >= 1 && (
            <div className={currentStep > 1 ? 'opacity-75' : ''}>
              {renderVisualizationTypeStep()}
            </div>
          )}
        </div>

        {/* Step 2 */}
        {currentStep >= 2 && (
          <div className="mb-4">
            {renderStepHeader(2, 'Select Data Source')}
            <div className={currentStep > 2 ? 'opacity-75' : ''}>
              {renderChooseCaptureStep()}
              {currentStep === 2 && (
                <div className="d-flex gap-2 mt-3">
                  <Button
                    variant="secondary"
                    onClick={() => setCurrentStep((prev) => prev - 1)}
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
                  onClick={() => setCurrentStep((prev) => prev - 1)}
                >
                  Back
                </Button>
                <Link
                  to={`/visualization/${selectedType}/${selectedCaptureId}`}
                >
                  <Button
                    variant="primary"
                    disabled={!selectedType || !selectedCaptureId}
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
