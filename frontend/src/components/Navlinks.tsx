import Nav from 'react-bootstrap/Nav';
import Container from 'react-bootstrap/Container';
import { NavLink } from 'react-router';
import Navbar from 'react-bootstrap/esm/Navbar';

const Navlinks = () => {
  return (
    <Navbar expand="lg" className="bg-body-tertiary">
      <Container>
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
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navlinks;
