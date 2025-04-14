import { useState, useCallback, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Row, Col, Card, Tooltip, OverlayTrigger } from 'react-bootstrap';
import _ from 'lodash';

import Button from '../components/Button';
import { useAppContext } from '../utils/AppContext';
import {
  useSyncCaptures,
  CaptureType,
  CAPTURE_TYPE_INFO,
} from '../apiClient/captureService';
import {
  postVisualization,
  VisualizationType,
  VISUALIZATION_TYPES,
} from '../apiClient/visualizationService';
import CaptureSearch from '../components/CaptureSearch';
import LoadingSpinner from '../components/LoadingSpinner';

/**
 * A wizard-style page for creating new visualizations
 * Guides users through selecting a capture and visualization type
 */
const NewVisualizationPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { captures } = useAppContext();
  const syncCaptures = useSyncCaptures();
  const [isFetchingCaptures, setIsFetchingCaptures] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [selectedCaptureId, setSelectedCaptureId] = useState<string | null>(
    null,
  );
  const [selectedVizType, setSelectedVizType] =
    useState<VisualizationType | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Handle URL query parameters
  useEffect(() => {
    const captureId = searchParams.get('captureId');
    const vizType = searchParams.get('vizType') as VisualizationType | null;

    if (captureId && vizType) {
      setSelectedCaptureId(captureId);
      setSelectedVizType(vizType);
      setCurrentStep(3);
    } else if (captureId) {
      setSelectedCaptureId(captureId);
      setCurrentStep(2);
    }
  }, [searchParams]);

  // Get selected capture and its type
  const selectedCapture = useMemo(
    () => captures.find((c) => c.uuid === selectedCaptureId),
    [captures, selectedCaptureId],
  );

  // Sort visualization types with compatible ones first
  const sortedVisualizationTypes = useMemo(() => {
    if (!selectedCapture) return VISUALIZATION_TYPES;

    return _.partition(VISUALIZATION_TYPES, (vizType) =>
      vizType.supportedCaptureTypes.includes(selectedCapture.type),
    ).flat();
  }, [selectedCapture]);

  const handleCaptureSelect = useCallback((ids: string[]) => {
    setSelectedCaptureId(ids[0] || null);
    if (ids.length > 0) {
      setSelectedVizType(null);
      setCurrentStep(2);
    }
  }, []);

  const handleVizTypeSelect = useCallback(async (type: VisualizationType) => {
    setSelectedVizType(type);
    setCurrentStep(3);
  }, []);

  const handleCreateVisualization = async () => {
    if (!selectedVizType || !selectedCaptureId) {
      return;
    }

    setIsCreating(true);
    setError(null);

    try {
      const source = selectedCapture?.source;
      if (!source) {
        throw new Error('No source found for selected capture');
      }
      const visualizationRecord = await postVisualization({
        type: selectedVizType,
        capture_ids: [selectedCaptureId],
        capture_type: selectedCapture?.type as CaptureType,
        capture_source: source,
        settings: {},
      });

      navigate(`/visualization/${visualizationRecord.uuid}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to create visualization',
      );
    } finally {
      setIsCreating(false);
    }
  };

  const renderCaptureSelectionStep = () => (
    <div>
      <CaptureSearch
        captures={captures}
        selectedCaptureIds={selectedCaptureId ? [selectedCaptureId] : []}
        setSelectedCaptureIds={handleCaptureSelect}
      />
    </div>
  );

  const renderVizTypeStep = () => (
    <div>
      <Row className="g-4">
        {sortedVisualizationTypes.map((visualizationType) => {
          const typeIsSupported =
            selectedCapture &&
            visualizationType.supportedCaptureTypes.includes(
              selectedCapture.type,
            );

          const cardContent = (
            <>
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
                    (type) => CAPTURE_TYPE_INFO[type].name,
                  )}
                </span>
              </Card.Text>
            </>
          );

          const card = (
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
              <Card.Body>{cardContent}</Card.Body>
            </Card>
          );

          const tooltipContent =
            selectedCapture && !typeIsSupported ? (
              <Tooltip id={`tooltip-${visualizationType.name}`}>
                This visualization is not available for{' '}
                {CAPTURE_TYPE_INFO[selectedCapture.type].name} captures.
              </Tooltip>
            ) : null;

          return (
            <Col key={visualizationType.name} md={6}>
              {tooltipContent ? (
                <OverlayTrigger placement="top" overlay={tooltipContent}>
                  {card}
                </OverlayTrigger>
              ) : (
                card
              )}
            </Col>
          );
        })}
      </Row>
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
              {renderStepHeader(1, 'Select Capture')}
              {currentStep >= 1 && (
                <div className={currentStep > 1 ? 'opacity-75' : ''}>
                  {renderCaptureSelectionStep()}
                </div>
              )}
            </div>

            {/* Step 2 */}
            {currentStep >= 2 && (
              <div className="mb-4">
                {renderStepHeader(2, 'Select Visualization Type')}
                <div className={currentStep > 2 ? 'opacity-75' : ''}>
                  {renderVizTypeStep()}
                </div>
              </div>
            )}

            {/* Step 3 */}
            {currentStep >= 3 && (
              <div className="mb-4">
                {error && (
                  <div className="alert alert-danger mt-3" role="alert">
                    {error}
                  </div>
                )}
                <div className="d-flex gap-2 mt-3">
                  <Button
                    variant="primary"
                    onClick={handleCreateVisualization}
                    disabled={!selectedVizType || isCreating}
                  >
                    {isCreating ? 'Creating...' : 'Create Visualization'}
                  </Button>
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
