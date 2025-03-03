import Nav from 'react-bootstrap/Nav';
import Container from 'react-bootstrap/Container';
import { NavLink } from 'react-router';
import Navbar from 'react-bootstrap/esm/Navbar';
import { useAppContext } from '../utils/AppContext';
import Dropdown from 'react-bootstrap/Dropdown';
// import NavDropdown from 'react-bootstrap/NavDropdown';
import { API_HOST } from '../apiClient';

const Navlinks = () => {
  const { username } = useAppContext();

  return (
    <Navbar expand="lg" className="main-nav">
      <Container className="primary-menu">
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <ul>
              <NavLink to="/dashboard">Dashboard</NavLink>
              <NavLink to="/workspace">Workspace</NavLink>
              <NavLink to="/mydata">My Data</NavLink>
              <NavLink to="/search">Search</NavLink>
              {username ? (
                <Dropdown className="nav-item-dropdown">
                  <Dropdown.Toggle id="dropdown-basic" className="nav-link">
                    {username}
                  </Dropdown.Toggle>
                  <Dropdown.Menu>
                    <Dropdown.Item href={API_HOST + '/accounts/logout'}>
                      Logout
                    </Dropdown.Item>
                  </Dropdown.Menu>
                </Dropdown>
              ) : (
                <Nav.Link href={API_HOST + '/accounts/auth0/login'}>
                  Login
                </Nav.Link>
              )}
            </ul>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navlinks;
