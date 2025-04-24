import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router';
import { Container, Row, Col, Modal } from 'react-bootstrap';
import _ from 'lodash';

import { useAppContext } from '../utils/AppContext';
import Button from '../components/Button';
import { VisualizationCard } from '../components/VisualizationCard';
import {
  useSyncVisualizations,
  deleteVisualization,
  VisualizationRecord,
} from '../apiClient/visualizationService';
import LoadingBlock from '../components/LoadingBlock';

const WorkspacePage = () => {
  const { username, visualizations: vizRecords } = useAppContext();
  const syncVisualizations = useSyncVisualizations();
  const [isLoading, setIsLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [vizToDelete, setVizToDelete] = useState<VisualizationRecord | null>(
    null,
  );
  const [isDeleting, setIsDeleting] = useState(false);

  const loadVisualizations = useCallback(async () => {
    setIsLoading(true);
    await syncVisualizations();
    setIsLoading(false);
  }, [syncVisualizations]);

  useEffect(() => {
    loadVisualizations();
  }, [loadVisualizations]);

  const sortedVizRecords = _.sortBy(vizRecords, 'created_at').reverse();

  const handleDeleteClick = (vizRecord: VisualizationRecord) => {
    setVizToDelete(vizRecord);
    setShowDeleteModal(true);
  };

  const handleDeleteConfirm = async () => {
    if (!vizToDelete) return;

    setIsDeleting(true);
    try {
      await deleteVisualization(vizToDelete.uuid);
      setShowDeleteModal(false);
      await loadVisualizations();
    } catch (err) {
      console.error('Error deleting visualization:', err);
    } finally {
      setShowDeleteModal(false);
      setIsDeleting(false);
      setVizToDelete(null);
    }
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h4 className="mb-0">My Visualizations</h4>
        <Link to="/visualization/new">
          <Button
            variant="primary"
            disabled={!username}
            disabledHelpText="You must be logged in to create a visualization"
          >
            <i className="bi bi-plus-lg me-2"></i>
            Create Visualization
          </Button>
        </Link>
      </div>
      <hr />
      {!username ? (
        <div className="text-center py-5">
          <i className="bi bi-person-circle display-4 text-muted mb-3"></i>
          <p className="lead">Please log in to create a visualization.</p>
        </div>
      ) : isLoading ? (
        <LoadingBlock message="Getting visualizations..." />
      ) : sortedVizRecords.length === 0 ? (
        <div className="text-center py-5">
          <i className="bi bi-graph-up display-4 text-muted mb-3"></i>
          <p className="lead">No saved visualizations. Make one now!</p>
        </div>
      ) : (
        <Row>
          {sortedVizRecords.map((vizRecord) => (
            <Col key={vizRecord.uuid} xs={12} md={6} lg={4} className="mb-3">
              <VisualizationCard
                vizRecord={vizRecord}
                onDeleteClick={handleDeleteClick}
              />
            </Col>
          ))}
        </Row>
      )}

      <Modal
        show={showDeleteModal && !!vizToDelete}
        onHide={() => {
          setShowDeleteModal(false);
          setVizToDelete(null);
        }}
      >
        <Modal.Header>
          <Modal.Title>Delete visualization "{vizToDelete?.name}"?</Modal.Title>
        </Modal.Header>
        <Modal.Footer className="d-flex justify-content-between">
          <Button
            variant="secondary"
            onClick={() => {
              setShowDeleteModal(false);
              setVizToDelete(null);
            }}
          >
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={handleDeleteConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </Button>
        </Modal.Footer>
      </Modal>
    </Container>
  );
};

export default WorkspacePage;
