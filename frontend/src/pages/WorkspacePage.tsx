import { useState } from 'react';
import { Link } from 'react-router';

import { useAppContext } from '../utils/AppContext';
import Button from '../components/Button';

interface Visualization {
  id: string;
  name: string;
}

const WorkspacePage = () => {
  const { username } = useAppContext();
  const [visualizations, _setVisualizations] = useState<Visualization[]>([]);

  return (
    <div className="page-container">
      <Link to="/visualization/new">
        <Button
          variant="primary"
          disabled={!username}
          disabledHelpText="You must be logged in to create a visualization"
        >
          <i className="bi bi-plus-lg" style={{ marginRight: '5px' }}></i>
          Create Visualization
        </Button>
      </Link>
      <br />
      <hr />
      <h5>Visualizations</h5>
      {visualizations.length > 0 ? (
        visualizations.map((visualization) => (
          <Button key={visualization.id}>{visualization.name}</Button>
        ))
      ) : username ? (
        <div>No visualizations created. Make one now!</div>
      ) : (
        <div>
          <p>Please log in to create a visualization.</p>
        </div>
      )}
    </div>
  );
};

export default WorkspacePage;
