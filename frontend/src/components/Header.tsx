import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import NavDropdown from 'react-bootstrap/NavDropdown';
import { NavLink } from 'react-router';
import { api_host } from '../apiClient';
import { useAppContext } from '../utils/AppContext';

const Header = () => {
  const context = useAppContext();

  return (
    <Navbar expand="lg" className="bg-body-tertiary">
      <Container>
        <NavLink to="/" className="nav-link">
          <Navbar.Brand>SpectrumX Visualization Platform</Navbar.Brand>
        </NavLink>
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <NavLink to="/" className="nav-link">
              Home/Dashboard
            </NavLink>
            <NavLink to="/workspace" className="nav-link">
              Workspace
            </NavLink>
            <NavLink to="/mydata" className="nav-link">
              My Data
            </NavLink>
            <NavLink to="/search" className="nav-link">
              Search
            </NavLink>
            <NavLink to="/tutorials" className="nav-link">
              Tutorials
            </NavLink>
            {context?.username ? (
              <NavDropdown title={context.username} id="basic-nav-dropdown">
                <NavDropdown.Item href="/token">API Token</NavDropdown.Item>
                <NavDropdown.Item href="#action/3.2">Settings</NavDropdown.Item>
                <NavDropdown.Divider />
                <NavDropdown.Item href={api_host + '/accounts/logout'}>
                  Logout
                </NavDropdown.Item>
              </NavDropdown>
            ) : (
              <Nav.Link href={api_host + '/accounts/auth0/login'}>
                Login
              </Nav.Link>
            )}
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Header;
