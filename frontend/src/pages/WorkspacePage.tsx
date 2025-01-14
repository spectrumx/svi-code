import { useState } from 'react';
import { Link } from 'react-router';

import Button from '../components/Button';

interface Visualization {
  id: string;
  name: string;
}

const WorkspacePage = () => {
  const [visualizations, _setVisualizations] = useState<Visualization[]>([]);

  return (
    <>
      <Link to="/visualization/new">
        <Button variant="primary">
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
      ) : (
        <div>No visualizations created. Make one now!</div>
      )}
    </>
  );
};

export default WorkspacePage;
