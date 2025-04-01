import Container from 'react-bootstrap/Container';
import Navbar from 'react-bootstrap/Navbar';
import { NavLink } from 'react-router';
import Navlinks from './Navlinks';
import { Image } from 'react-bootstrap';
import logo from '../img/logo.svg';

const Header = () => {
  return (
    <>
      <div className="rainbow-bar"></div>
      <Navbar expand="lg" className="site-header">
        <Container fluid className="px-3">
          <div className="header-content">
            <div className="logo-container">
              <NavLink to="/" className="no-underline">
                <Navbar.Brand className="logo">
                  <Image src={logo} alt="SpectrumX Logo" />
                  <span className="logo-text">
                    Spectrum Visualization Interface
                  </span>
                </Navbar.Brand>
              </NavLink>
            </div>
            <div className="nav-container">
              <Navlinks />
            </div>
          </div>
        </Container>
      </Navbar>
    </>
  );
};

export default Header;
