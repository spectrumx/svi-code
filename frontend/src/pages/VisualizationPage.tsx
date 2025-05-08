import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Form, Button, Tooltip, OverlayTrigger } from 'react-bootstrap';

import LoadingSpinner from '../components/LoadingSpinner';
import SpectrogramVizContainer from '../components/spectrogram/SpectrogramVizContainer';
import WaterfallVizContainer from '../components/waterfall/WaterfallVizContainer';
import {
  VisualizationRecordDetail,
  getVisualization,
  updateVisualization,
  saveVisualization,
} from '../apiClient/visualizationService';

/**
 * Router component for visualization pages.
 * Fetches visualization data based on URL parameter and renders the appropriate visualization component.
 */
const VisualizationPage = () => {
  const { id: vizId } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [visualizationRecord, setVisualizationRecord] =
    useState<VisualizationRecordDetail | null>(null);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const fetchVisualizationRecord = async () => {
      if (!vizId) {
        setError('No visualization ID provided');
        setIsLoading(false);
        return;
      }

      try {
        const vizRecord = await getVisualization(vizId);
        setEditedName(vizRecord.name);
        setVisualizationRecord(vizRecord);
      } catch (err) {
        setError(
          err instanceof Error ? err.message : 'Failed to load visualization',
        );
      } finally {
        setIsLoading(false);
      }
    };

    fetchVisualizationRecord();
  }, [vizId]);

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditedName(e.target.value);
  };

  const handleNameSubmit = async () => {
    if (
      !vizId ||
      !visualizationRecord ||
      editedName === visualizationRecord.name
    ) {
      setIsEditingName(false);
      return;
    }

    if (editedName === '') {
      setIsEditingName(false);
      setEditedName(visualizationRecord.name);
      return;
    }

    setIsSaving(true);
    try {
      let updatedRecord = await updateVisualization(vizId, {
        name: editedName,
      });
      if (!visualizationRecord.is_saved) {
        updatedRecord = await saveVisualization(vizId);
      }

      setVisualizationRecord(updatedRecord);
      setIsEditingName(false);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to update visualization name',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!vizId || !visualizationRecord) return;

    setIsSaving(true);
    try {
      const updatedRecord = await saveVisualization(vizId);
      setVisualizationRecord(updatedRecord);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to save visualization',
      );
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="d-flex justify-content-center align-items-center h-100">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="alert alert-danger" role="alert">
        {error}
      </div>
    );
  }

  if (!visualizationRecord) {
    return (
      <div className="alert alert-danger" role="alert">
        No visualization found!
      </div>
    );
  }

  const VizContainer =
    visualizationRecord.type === 'spectrogram'
      ? SpectrogramVizContainer
      : visualizationRecord.type === 'waterfall'
        ? WaterfallVizContainer
        : null;

  return (
    <div className="container-fluid page-container-wide">
      <div className="d-flex align-items-center justify-content-between mb-4">
        {isEditingName ? (
          <div className="d-flex align-items-center gap-2">
            <Form.Control
              type="text"
              value={editedName}
              onChange={handleNameChange}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleNameSubmit();
                } else if (e.key === 'Escape') {
                  setIsEditingName(false);
                  setEditedName(visualizationRecord.name);
                }
              }}
              autoFocus
              disabled={isSaving}
            />
            <Button
              variant="outline-success"
              size="sm"
              onClick={handleNameSubmit}
              disabled={isSaving}
              aria-label="Save name"
            >
              <i className="bi bi-check-lg" />
            </Button>
            <Button
              variant="outline-danger"
              size="sm"
              onClick={() => {
                setIsEditingName(false);
                setEditedName(visualizationRecord.name);
              }}
              disabled={isSaving}
              aria-label="Cancel edit"
            >
              <i className="bi bi-x-lg" />
            </Button>
          </div>
        ) : (
          <div className="d-flex align-items-center gap-2">
            <h2
              className="mb-0 cursor-pointer"
              onClick={() => setIsEditingName(true)}
              style={{ cursor: 'pointer' }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  setIsEditingName(true);
                }
              }}
            >
              {visualizationRecord.name}
            </h2>
            <Button
              variant="outline-secondary"
              size="sm"
              onClick={() => setIsEditingName(true)}
              aria-label="Edit name"
              style={{ marginLeft: '0.75rem' }}
            >
              <i className="bi bi-pencil" />
            </Button>
          </div>
        )}
        {!visualizationRecord.is_saved && (
          <OverlayTrigger
            placement="top"
            overlay={
              <Tooltip id="tooltip-save-visualization">
                Save this visualization to your Workspace
              </Tooltip>
            }
          >
            <Button variant="primary" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                'Saving...'
              ) : (
                <span>
                  <i className="bi bi-floppy-fill me-2"></i>Save Visualization
                </span>
              )}
            </Button>
          </OverlayTrigger>
        )}
      </div>
      {VizContainer ? (
        <VizContainer visualizationRecord={visualizationRecord} />
      ) : (
        <div className="alert alert-danger" role="alert">
          Unsupported visualization type: {visualizationRecord.type}
        </div>
      )}
    </div>
  );
};

export default VisualizationPage;
