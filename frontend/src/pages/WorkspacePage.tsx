import { useEffect } from 'react';
import { Link } from 'react-router';
import { Container, Row, Col } from 'react-bootstrap';
import _ from 'lodash';

import { useAppContext } from '../utils/AppContext';
import Button from '../components/Button';
import { VisualizationCard } from '../components/VisualizationCard';
import { useSyncVisualizations } from '../apiClient/visualizationService';

const WorkspacePage = () => {
  const { username, visualizations: vizRecords } = useAppContext();
  const syncVisualizations = useSyncVisualizations();

  useEffect(() => {
    syncVisualizations();
  }, [syncVisualizations]);

  const sortedVizRecords = _.sortBy(vizRecords, 'created_at').reverse();

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
      {sortedVizRecords.length > 0 ? (
        <Row>
          {sortedVizRecords.map((vizRecord) => (
            <Col key={vizRecord.id} xs={12} md={6} lg={4} className="mb-3">
              <VisualizationCard vizRecord={vizRecord} />
            </Col>
          ))}
        </Row>
      ) : username ? (
        <div className="text-center py-5">
          <i className="bi bi-graph-up display-4 text-muted mb-3"></i>
          <p className="lead">No visualizations created. Make one now!</p>
        </div>
      ) : (
        <div className="text-center py-5">
          <i className="bi bi-person-circle display-4 text-muted mb-3"></i>
          <p className="lead">Please log in to create a visualization.</p>
        </div>
      )}
    </Container>
  );
};

export default WorkspacePage;
