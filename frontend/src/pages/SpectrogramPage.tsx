import { useState, useEffect } from 'react';
import { useParams } from 'react-router';
import { Row, Col, Alert, Spinner, Button } from 'react-bootstrap';
import _ from 'lodash';

import apiClient from '../apiClient';
import Spectrogram from '../components/spectrogram';
import SpectrogramControls from '../components/spectrogram/SpectrogramControls';

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
      const response = await apiClient.get(
        `/api/jobs/job-data/${resultsId}/?download=true`,
        {
          responseType: 'blob',
        },
      );
      const imageBlob = new Blob([response.data], { type: 'image/png' });
      const imageUrl = URL.createObjectURL(imageBlob);
      setSpectrogramUrl(imageUrl);
      setJobStatus({
        job_id: null,
        status: null,
      });
    } catch (error) {
      console.error('Error fetching spectrogram image:', error);
      setJobStatus((prevStatus) => ({
        ...prevStatus,
        status: 'failed',
        message: 'Failed to fetch spectrogram results',
      }));
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

          if (newStatus === 'completed' && resultsId) {
            clearInterval(interval);
            setJobStatus((prevStatus) => ({
              ...prevStatus,
              status: 'fetching_results',
              message: 'Fetching spectrogram results...',
              results_id: resultsId,
            }));
            await fetchSpectrogramImage(resultsId);
          } else {
            setJobStatus((prevStatus) => ({
              ...prevStatus,
              status: newStatus,
              message: response.data.message,
              results_id: resultsId,
            }));
          }

          if (newStatus === 'failed') {
            console.log('Clearing interval');
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Error fetching job status:', error);
          clearInterval(interval);
        }
      }, 2000);
    }

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
      fetching_results: 'info',
      completed: 'success',
      failed: 'danger',
    };

    const isActive =
      isSubmitting ||
      ['pending', 'submitted', 'running', 'fetching_results'].includes(
        jobStatus.status || '',
      );

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
                Job status:{' '}
                {_.capitalize(
                  jobStatus.status?.replace('_', ' ') || 'Status missing',
                )}
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
      <br />
      <Row>
        <Col xs={3} style={{ maxWidth: 200 }}>
          <div className="d-flex flex-column gap-3">
            <SpectrogramControls
              settings={spectrogramSettings}
              setSettings={setSpectrogramSettings}
            />
            <Button onClick={createSpectrogramJob} disabled={isSubmitting}>
              Generate Spectrogram
            </Button>
            {renderJobStatus()}
          </div>
        </Col>
        <Col>
          <Spectrogram
            imageUrl={spectrogramUrl}
            hasError={jobStatus.status === 'failed'}
          />
        </Col>
      </Row>
    </>
  );
};

export default SpectrogramPage;
