import Container from 'react-bootstrap/Container';
import Nav from 'react-bootstrap/Nav';
import Navbar from 'react-bootstrap/Navbar';
import Dropdown from 'react-bootstrap/Dropdown';
import { NavLink } from 'react-router';
import { api_host } from '../apiClient';
import { useAppContext } from '../utils/AppContext';
import Navlinks from './Navlinks';
import { Image } from 'react-bootstrap';
import logo from '../img/logo.svg';

const Header = () => {
  const context = useAppContext();

  return (
    <>
      <div className="rainbow-bar"></div>
      <Navbar expand="lg" className="bg-body-tertiary site-header">
        <Container className="container">
          <div className="header-content">
            <div>
              <NavLink to="/">
                <Navbar.Brand className="logo">
                  <Image src={logo} alt="SpectrumX Logo" />
                </Navbar.Brand>
              </NavLink>
            </div>
            <div>
              <Navlinks />
            </div>
          </div>
        </Container>
      </Navbar>
    </>
  );
};

export default Header;
