import { useState } from 'react';
import { useParams } from 'react-router';
import Stack from 'react-bootstrap/Stack';

import Spectrogram from '../components/spectrogram';
import SpectrogramControls from '../components/spectrogram/SpectrogramControls';

export interface SpectrogramSettings {
  fftSize: number;
}

const SpectrogramPage = () => {
  const { datasetId } = useParams();
  const [spectrogramSettings, setSpectrogramSettings] =
    useState<SpectrogramSettings>({
      fftSize: 1024,
    });

  return (
    <>
      <h5>Spectrogram for dataset {datasetId}</h5>
      <Stack direction="horizontal" gap={3}>
        <SpectrogramControls
          settings={spectrogramSettings}
          setSettings={setSpectrogramSettings}
        />
        <Spectrogram />
      </Stack>
    </>
  );
};

export default SpectrogramPage;
