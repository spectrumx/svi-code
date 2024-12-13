import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import Stack from 'react-bootstrap/Stack';
import Alert from 'react-bootstrap/Alert';
import Spinner from 'react-bootstrap/Spinner';
import _ from 'lodash';

import apiClient from '../apiClient';
import Spectrogram from '../components/spectrogram';
import SpectrogramControls from '../components/spectrogram/SpectrogramControls';
import { Button } from 'react-bootstrap';

export interface SpectrogramSettings {
  fftSize: number;
}

interface JobData {
  status: string;
  results_id?: string;
}

interface JobResponse {
  data?: JobData;
  message?: string;
}

interface JobStatus {
  job_id: number | null;
  status: string | null;
  message?: string;
  results_id?: string;
}

const SpectrogramPage = () => {
  const { datasetId } = useParams();
  const [spectrogramSettings, setSpectrogramSettings] =
    useState<SpectrogramSettings>({
      fftSize: 1024,
    });
  const [jobStatus, setJobStatus] = useState<JobStatus>({
    job_id: null,
    status: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [spectrogramUrl, setSpectrogramUrl] = useState<string | null>(null);

  const createSpectrogramJob = async () => {
    setIsSubmitting(true);
    try {
      const response = await apiClient.post(
        `/api/sigmf-file-pairs/${datasetId}/create_spectrogram/`,
        {
          fft_size: spectrogramSettings.fftSize,
        },
      );
      setJobStatus({
        job_id: response.data.job_id,
        status: response.data.status,
      });
      console.log('Job created:', response.data);
    } catch (error) {
      console.error('Error creating spectrogram job:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchSpectrogramImage = async (resultsId: string) => {
    console.log('Fetching spectrogram image:', resultsId);
    try {
      const response = await apiClient.get(`/api/jobs/job-data/${resultsId}/`, {
        responseType: 'blob',
      });
      const imageBlob = new Blob([response.data], { type: 'image/png' });
      const imageUrl = URL.createObjectURL(imageBlob);
      setSpectrogramUrl(imageUrl);
    } catch (error) {
      console.error('Error fetching spectrogram image:', error);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (jobStatus.job_id) {
      interval = setInterval(async () => {
        try {
          const response = await apiClient.get<JobResponse>(
            `/api/jobs/job-metadata/${jobStatus.job_id}/`,
          );

          const newStatus = response.data.data?.status ?? null;
          const resultsId = response.data.data?.results_id;

          console.log('New status:', newStatus);
          console.log('Results ID:', resultsId);

          setJobStatus((prevStatus) => ({
            ...prevStatus,
            status: newStatus,
            message: response.data.message,
            results_id: resultsId,
          }));

          // If job is completed and we have a results_id, fetch the spectrogram
          if (newStatus === 'completed' && resultsId) {
            await fetchSpectrogramImage(resultsId);
          }

          // Clear interval if job is completed or failed
          if (newStatus && ['completed', 'failed'].includes(newStatus)) {
            console.log('Clearing interval');
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Error fetching job status:', error);
          clearInterval(interval);
        }
      }, 2000);
    }

    // Clean up function to clear interval and revoke object URL
    return () => {
      if (interval) {
        clearInterval(interval);
      }
      if (spectrogramUrl) {
        URL.revokeObjectURL(spectrogramUrl);
      }
    };
  }, [jobStatus.job_id]);

  const renderJobStatus = () => {
    if (!isSubmitting && !jobStatus.job_id) return null;

    const variants: { [key: string]: string } = {
      pending: 'info',
      submitted: 'info',
      running: 'primary',
      completed: 'success',
      failed: 'danger',
    };

    const isActive =
      isSubmitting ||
      ['pending', 'submitted', 'running'].includes(jobStatus.status || '');

    return (
      <Alert
        variant={isSubmitting ? 'info' : variants[jobStatus.status || 'info']}
      >
        <div className="d-flex align-items-center">
          {isActive && (
            <Spinner
              animation="border"
              size="sm"
              className="me-2"
              variant={
                isSubmitting ? 'info' : variants[jobStatus.status || 'info']
              }
            />
          )}
          <div>
            {isSubmitting ? (
              'Creating spectrogram job...'
            ) : (
              <>
                Job status: {_.capitalize(jobStatus.status || 'Status missing')}
                {jobStatus.message && <div>Info: {jobStatus.message}</div>}
              </>
            )}
          </div>
        </div>
      </Alert>
    );
  };

  return (
    <>
      <h5>Spectrogram for dataset {datasetId}</h5>
      <Stack direction="horizontal" gap={3}>
        <div style={{ width: 200, height: '100%' }}>
          <Stack
            direction="vertical"
            gap={3}
            className="h-100"
            style={{ alignItems: 'stretch' }}
          >
            <SpectrogramControls
              settings={spectrogramSettings}
              setSettings={setSpectrogramSettings}
            />
            <Button onClick={createSpectrogramJob} disabled={isSubmitting}>
              Generate Spectrogram
            </Button>
            {renderJobStatus()}
          </Stack>
        </div>
        {spectrogramUrl ? (
          <div>
            <img
              src={spectrogramUrl}
              alt="Spectrogram visualization"
              style={{ maxWidth: '100%', height: 'auto' }}
            />
          </div>
        ) : (
          <div
            className="d-flex justify-content-center align-items-center"
            style={{ minHeight: '400px' }}
          >
            <p className="text-muted">
              {jobStatus.status === 'failed'
                ? 'Failed to generate spectrogram'
                : 'Generate a spectrogram using the controls'}
            </p>
          </div>
        )}
      </Stack>
    </>
  );
};

export default SpectrogramPage;
