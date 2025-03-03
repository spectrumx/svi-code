import { NavLink } from 'react-router';
import Nav from 'react-bootstrap/Nav';
import Container from 'react-bootstrap/Container';
import Navbar from 'react-bootstrap/esm/Navbar';
import Dropdown from 'react-bootstrap/Dropdown';

import { useAppContext } from '../utils/AppContext';
import { API_HOST, LOGIN_URL } from '../apiClient';

const Navlinks = () => {
  const { username } = useAppContext();

  return (
    <Navbar expand="lg" className="main-nav">
      <Container className="primary-menu">
        <Navbar.Toggle aria-controls="basic-navbar-nav" />
        <Navbar.Collapse id="basic-navbar-nav">
          <Nav className="me-auto">
            <ul>
              {username && (
                <>
                  <NavLink to="/dashboard">Dashboard</NavLink>
                  <NavLink to="/workspace">Workspace</NavLink>
                  <NavLink to="/mydata">My Data</NavLink>
                  <NavLink to="/search">Search</NavLink>
                </>
              )}
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
                <Nav.Link href={LOGIN_URL}>Login</Nav.Link>
              )}
            </ul>
          </Nav>
        </Navbar.Collapse>
      </Container>
    </Navbar>
  );
};

export default Navlinks;
