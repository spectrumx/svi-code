import Card from 'react-bootstrap/Card';
import { Link } from 'react-router';

import { getLoginUrlWithRedirect } from '../apiClient';
import { useAppContext } from '../utils/AppContext';

const LandingPage = () => {
  const { username } = useAppContext();

  return (
    <section className="hero">
      <div className="container">
        <h1>SpectrumX Visualizations & Interface</h1>
        <div className="hero-content">
          <div className="hero-boxes">
            <Card className="hero-box">
              <Card.Body>
                <Card.Title>About the SVI</Card.Title>
                <Card.Text>
                  The SVI is a platform for visualizing and analyzing
                  radio-frequency spectrum data
                </Card.Text>
              </Card.Body>
            </Card>
            <Card className="hero-box">
              <Card.Body>
                <Card.Title>My Data</Card.Title>
                <Card.Text>Upload your own spectrum data to the SVI</Card.Text>
              </Card.Body>
              <Card.Footer>
                <Link
                  to={username ? 'mydata' : getLoginUrlWithRedirect('/mydata')}
                  reloadDocument={!username}
                  className="btn btn-primary px-4"
                >
                  Go to My Data
                </Link>
              </Card.Footer>
            </Card>
            <Card className="hero-box">
              <Card.Body>
                <Card.Title>Workspace</Card.Title>
                <Card.Text>Visualize recordings that you've uploaded</Card.Text>
              </Card.Body>
              <Card.Footer>
                <Link
                  to={
                    username
                      ? 'workspace'
                      : getLoginUrlWithRedirect('/workspace')
                  }
                  reloadDocument={!username}
                  className="btn btn-primary px-4"
                >
                  Go to Workspace
                </Link>
              </Card.Footer>
            </Card>
          </div>
        </div>
      </div>
    </section>
  );
};

export default LandingPage;
