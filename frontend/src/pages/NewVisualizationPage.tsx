import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Row, Col, Card } from 'react-bootstrap';
import _ from 'lodash';

import Button from '../components/Button';
import { useAppContext } from '../utils/AppContext';
import { SpectrogramSettings } from '../components/spectrogram/SpectrogramVizContainer';
import {
  useSyncCaptures,
  CaptureType,
  CAPTURE_TYPES,
} from '../apiClient/captureService';
import {
  postVisualization,
  VisualizationType,
  VISUALIZATION_TYPES,
  VisualizationTypeInfo,
} from '../apiClient/visualizationService';
import CaptureSearch from '../components/CaptureSearch';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * A wizard-style page for creating new visualizations
 * Guides users through selecting data source, visualization type, and configuration
 */
const NewVisualizationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { captures } = useAppContext();
  const syncCaptures = useSyncCaptures();
  const [isFetchingCaptures, setIsFetchingCaptures] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCaptureType, setSelectedCaptureType] =
    useState<CaptureType | null>(null);
  const [selectedVizType, setSelectedVizType] =
    useState<VisualizationType | null>(null);
  const [selectedCaptureIds, setSelectedCaptureIds] = useState<string[]>([]);
  const [spectrogramSettings, setSpectrogramSettings] =
    useState<SpectrogramSettings>({
      fftSize: 1024,
    });
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle URL query parameters
  useEffect(() => {
    const captureType = searchParams.get('captureType') as CaptureType | null;
    const vizType = searchParams.get('vizType') as VisualizationType | null;
    const selectedCaptures =
      searchParams.get('selectedCaptures')?.split(',') || [];

    // Set the appropriate step based on provided parameters
    if (selectedCaptures.length > 0 && vizType && captureType) {
      setCurrentStep(4); // If captures are selected, go to the final step
    } else if (vizType && captureType) {
      setCurrentStep(3); // If visualization type is selected, go to capture selection
    } else if (captureType) {
      setCurrentStep(2); // If capture type is selected, go to visualization type selection
    }

    // Set parameters regardless of step
    if (selectedCaptures.length > 0) {
      setSelectedCaptureIds(selectedCaptures);
    }
    if (captureType) {
      setSelectedCaptureType(captureType);
    }
    if (vizType) {
      setSelectedVizType(vizType);
    }
  }, [searchParams]);

  // Filter captures based on selected type
  const filteredCaptures = selectedCaptureType
    ? captures.filter((capture) => capture.type === selectedCaptureType)
    : captures;

  // Check if a visualization type is supported for a given capture type
  const isSupported = (
    visualizationType: VisualizationTypeInfo,
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

  const selectionMode = useMemo(() => {
    if (!selectedVizType) return 'single';
    const vizType = VISUALIZATION_TYPES.find(
      (type) => type.name === selectedVizType,
    );
    return vizType?.multipleSelection ? 'multiple' : 'single';
  }, [selectedVizType]);

  const handleCaptureSelect = useCallback((ids: string[]) => {
    setSelectedCaptureIds(ids);
    if (ids.length > 0) {
      setCurrentStep(4);
    } else {
      setCurrentStep(3);
    }
  }, []);

  const handleVizTypeSelect = useCallback(async (type: VisualizationType) => {
    setSelectedVizType(type);
    setSelectedCaptureIds([]);
    setCurrentStep(3);
  }, []);

  const handleCreateVisualization = async () => {
    if (
      !selectedVizType ||
      !selectedCaptureType ||
      selectedCaptureIds.length === 0
    ) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const source = captures.find(
        (c) => c.id === selectedCaptureIds[0],
      )?.source;
      if (!source) {
        throw new Error('No source found for selected captures');
      }
      const visualizationRecord = await postVisualization({
        type: selectedVizType,
        capture_ids: selectedCaptureIds,
        capture_type: selectedCaptureType,
        capture_source: source,
        settings: selectedVizType === 'spectrogram' ? spectrogramSettings : {},
      });

      navigate(`/visualization/${visualizationRecord.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create visualization',
      );
    } finally {
      setIsCreating(false);
    }
  };

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
                setSelectedVizType(null);
                setCurrentStep(2);
              }}
              onKeyPress={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setSelectedCaptureType(type);
                  setSelectedVizType(null);
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
                typeIsSupported && handleVizTypeSelect(visualizationType.name)
              }
              onKeyPress={(e) => {
                if (typeIsSupported && (e.key === 'Enter' || e.key === ' ')) {
                  handleVizTypeSelect(visualizationType.name);
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

  const renderDataSourceStep = () => (
    <div>
      <h6>
        Select {selectionMode === 'multiple' ? 'one or more' : 'a'}{' '}
        {CAPTURE_TYPES[selectedCaptureType!].name}{' '}
        {selectionMode === 'multiple' ? 'captures' : 'capture'} to visualize:
      </h6>
      <CaptureSearch
        captures={filteredCaptures}
        selectedCaptureIds={selectedCaptureIds}
        setSelectedCaptureIds={handleCaptureSelect}
        tableProps={{
          selectionMode,
        }}
        hideCaptureTypeFilter
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
  );

  const renderExtraConfigStep = () => (
    <div>
      {selectedVizType === 'spectrogram' && (
        <div>
          <h6>Spectrogram Settings:</h6>
          <label htmlFor="fftSize" style={{ marginRight: '10px' }}>
            FFT Size:
          </label>
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
      {error && (
        <div className="alert alert-danger mt-3" role="alert">
          {error}
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
    setIsFetchingCaptures(true);
    syncCaptures().finally(() => setIsFetchingCaptures(false));
  }, [syncCaptures]);

  return (
    <div className="page-container">
      <h5>Create a New Visualization</h5>
      <div className="mt-4">
        {captures.length === 0 && isFetchingCaptures ? (
          <div className="d-flex flex-column align-items-center">
            <div className="me-2">
              <LoadingSpinner />
            </div>
            <div>Syncing captures...</div>
          </div>
        ) : (
          <>
            {/* Step 1 */}
            <div className="mb-4">
              {renderStepHeader(1, 'Select Capture Type')}
              {currentStep >= 1 && (
                <div className={currentStep > 1 ? 'opacity-75' : ''}>
                  {renderCaptureTypeStep()}
                </div>
              )}
            </div>

            {/* Step 2 */}
            {currentStep >= 2 && (
              <div className="mb-4">
                {renderStepHeader(2, 'Select Visualization Type')}
                <div className={currentStep > 2 ? 'opacity-75' : ''}>
                  {renderVizTypeStep()}
                  {currentStep === 2 && (
                    <div className="d-flex gap-2 mt-3">
                      <Button
                        variant="secondary"
                        onClick={() => {
                          setCurrentStep((prev) => prev - 1);
                          setSelectedCaptureType(null);
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
                {renderStepHeader(
                  3,
                  `Choose ${
                    selectionMode === 'multiple' ? 'one or more' : 'a'
                  } Capture${
                    selectionMode === 'multiple' ? 's' : ''
                  } to Visualize`,
                )}
                <div className={currentStep > 3 ? 'opacity-75' : ''}>
                  {renderDataSourceStep()}
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

            {/* Step 4 */}
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
                        setSelectedCaptureIds([]);
                      }}
                    >
                      Back
                    </Button>
                    <Button
                      variant="primary"
                      onClick={handleCreateVisualization}
                      disabled={
                        !selectedVizType ||
                        selectedCaptureIds.length === 0 ||
                        isCreating
                      }
                    >
                      {isCreating ? 'Creating...' : 'Create Visualization'}
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NewVisualizationPage;
