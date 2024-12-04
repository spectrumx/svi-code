import { useParams } from 'react-router';
import Stack from 'react-bootstrap/Stack';
import Spectrogram from '../components/spectrogram';
import SpectrogramControls from '../components/spectrogram/SpectrogramControls';

const SpectrogramPage = () => {
  const { datasetId } = useParams();

  return (
    <>
      <h5>Spectrogram for dataset {datasetId}</h5>
      <Stack direction="horizontal" gap={3}>
        <SpectrogramControls />
        <Spectrogram />
      </Stack>
    </>
  );
};

export default SpectrogramPage;
