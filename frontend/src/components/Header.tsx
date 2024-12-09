import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Dropdown from 'react-bootstrap/Dropdown';
import { NavLink } from 'react-router';
import { api_host } from '../apiClient';
import { useAppContext } from '../utils/AppContext';
import Navlinks from './Navlinks';

const Header = () => {
  const context = useAppContext();

  return (
    <>
      <Navbar expand="lg" className="bg-body-tertiary sx-navbar">
        <Container>
          <NavLink to="/" className="nav-link">
            <Navbar.Brand className="sx-navbar-brand">
              SpectrumX Visualization Platform
            </Navbar.Brand>
          </NavLink>
          {context?.username ? (
            <Dropdown className="nav-item-dropdown">
              <Dropdown.Toggle id="dropdown-basic" className="nav-link">
                {context.username}
              </Dropdown.Toggle>
              <Dropdown.Menu>
                <NavLink to="/token" className="dropdown-item">
                  API Token
                </NavLink>
                <Dropdown.Divider />
                <Dropdown.Item href={api_host + '/accounts/logout'}>
                  Logout
                </Dropdown.Item>
              </Dropdown.Menu>
            </Dropdown>
          ) : (
            <Nav.Link href={api_host + '/accounts/auth0/login'}>Login</Nav.Link>
          )}
        </Container>
      </Navbar>
      <div className="rainbow-bar"></div>
      <Navlinks />
    </>
  );
};

export default Header;
