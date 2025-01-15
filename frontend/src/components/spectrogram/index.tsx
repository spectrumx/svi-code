
import { useState, useEffect} from 'react';
import { useParams } from 'react-router';
import { Row, Col, Button } from 'react-bootstrap';



interface SpectrogramProps {
  imageUrl: string | null;
  hasError: boolean;
}

/**
 * Renders a spectrogram visualization or placeholder based on provided image URL
 * @param imageUrl - URL of the spectrogram image to display
 * @param hasError - Whether there was an error generating the spectrogram
 */
const MyComponent: React.FC = () => {
  const [windowDimensions, setWindowDimensions] = useState({
    width: window.innerWidth,
    height: window.innerHeight,
  });
  useEffect(() => {
    const handleResize = () => {
      setWindowDimensions({
        width: window.innerWidth,
        height: window.innerHeight,
      });
    };

    window.addEventListener('resize', handleResize);

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div>
      <p>Width: {windowDimensions.width}</p>
      <p>Height: {windowDimensions.height}</p>
    </div>
  );
};

const Spectrogram = ({ imageUrl, hasError }: SpectrogramProps) => {
  return (
    <div
      style={{
        width: '100%',
        height: 500,
        backgroundColor: imageUrl && !hasError ? 'transparent' : '#f8f9fa',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {imageUrl ? (
        <img
          src={imageUrl}
          alt="Spectrogram visualization"
          style={{ maxWidth: '100%', maxHeight: '100%', aspectRatio: window.innerWidth/ window.innerHeight, objectFit: 'contain'}}
        />
      ) : (
        <p className="text-muted">
          {hasError
            ? 'Failed to generate spectrogram'
            : 'Generate a spectrogram using the controls'}
        </p>
      )}
    </div>
  );
};

export default Spectrogram;
