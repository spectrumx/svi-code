import Image from 'react-bootstrap/Image';

import nsfLogo from '../img/nsf.svg';
import spectrumxLogo from '../img/spectrumx-rev.svg';

const Footer = () => {
  return (
    <footer className="site-footer">
      <div className="container">
        <div className="footer-content">
          <div className="footer-logos">
            <Image src={nsfLogo} alt="NSF Logo" />
            <Image src={spectrumxLogo} alt="SpectrumX Logo" />
          </div>
          <div className="footer-text">
            <p>
              NSF SpectrumX is an NSF Spectrum Innovation Center funded via
              Award 2132700 operated under cooperative agreement by the
              University of Notre Dame.
            </p>
          </div>
          <p className="copyright">©2024 SpectrumX | All Rights Reserved</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
