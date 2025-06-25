import { useState, useEffect } from 'react';
import { Row, Col, Button, Alert } from 'react-bootstrap';

import { SpectrogramVisualization } from '.';
import SpectrogramControls from './SpectrogramControls';
import { JobStatusDisplay } from '../JobStatusDisplay';
import {
  postSpectrogramJob,
  getJobMetadata,
  getJobResults,
} from '../../apiClient/jobService';
import { VizContainerProps } from '../types';

// How long to wait between job status polls to the server
const POLL_INTERVAL = 3000;

export interface SpectrogramSettings {
  fftSize: number;
  stdDev: number;
  hopSize: number;
  colormap: string;
  subchannel?: number;
}

export type JobStatus =
  | 'pending'
  | 'submitted'
  | 'running'
  | 'fetching_results'
  | 'completed'
  | 'failed'
  | 'error';

export const ACTIVE_JOB_STATUSES: JobStatus[] = [
  'pending',
  'submitted',
  'running',
  'fetching_results',
];

export interface JobInfo {
  job_id: number | null;
  status: JobStatus | null;
  message?: string;
  results_id?: string;
}

const SpectrogramVizContainer = ({
  visualizationRecord,
}: VizContainerProps) => {
  const [spectrogramSettings, setSpectrogramSettings] =
    useState<SpectrogramSettings>({
      fftSize: 1024,
      stdDev: 100,
      hopSize: 500,
      colormap: 'magma',
    });
  const [spectrogramUrl, setSpectrogramUrl] = useState<string | null>(null);
  const [jobInfo, setJobInfo] = useState<JobInfo>({
    job_id: null,
    status: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createSpectrogramJob = async () => {
    setIsSubmitting(true);
    const width = window.innerWidth / 100;
    const height = window.innerHeight / 100;

    try {
      const response = await postSpectrogramJob(
        visualizationRecord.uuid,
        width,
        height,
        spectrogramSettings,
      );
      setJobInfo({
        job_id: response.job_id ?? null,
        status: response.status as JobStatus | null,
        message: response.message ?? response.detail,
      });
    } catch (error) {
      console.error('Error creating spectrogram job:', error);
      setJobInfo((prevStatus) => ({
        ...prevStatus,
        status: 'failed',
        message: 'Failed to create spectrogram job',
      }));
    } finally {
      setIsSubmitting(false);
    }
  };

  const fetchSpectrogramImage = async (resultsId: string) => {
    try {
      const imageBlob = await getJobResults(resultsId);
      const imageUrl = URL.createObjectURL(imageBlob);
      setSpectrogramUrl(imageUrl);
      setJobInfo({
        job_id: null,
        status: null,
      });
    } catch (error) {
      console.error('Error fetching spectrogram image:', error);
      setJobInfo((prevStatus) => ({
        ...prevStatus,
        status: 'failed',
        message: 'Failed to fetch spectrogram results',
      }));
    }
  };

  const handleSaveSpectrogram = async () => {
    if (!spectrogramUrl) return;

    try {
      // Fetch the image blob
      const response = await fetch(spectrogramUrl);
      const blob = await response.blob();

      // Create a download link
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;

      // Generate filename based on timestamp and visualization UUID
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `spectrogram-${visualizationRecord.uuid}-${timestamp}.png`;

      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    } catch (error) {
      console.error('Error saving spectrogram:', error);
      setJobInfo((prevStatus) => ({
        ...prevStatus,
        status: 'error',
        message: 'Failed to save spectrogram',
      }));
    }
  };

  // Request a spectrogram on mount with the default settings
  useEffect(() => {
    createSpectrogramJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * Once a job is created, periodically poll the server to check its status
   */
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (jobInfo.job_id) {
      interval = setInterval(async () => {
        try {
          if (jobInfo.job_id === null) {
            clearInterval(interval);
            return;
          }

          const response = await getJobMetadata(jobInfo.job_id);

          const newStatus = response.data?.status ?? null;
          const resultsId = response.data?.results_id;

          if (newStatus === 'completed' && resultsId) {
            clearInterval(interval);
            setJobInfo((prevStatus) => ({
              ...prevStatus,
              status: 'fetching_results',
              results_id: resultsId,
              message: undefined,
            }));
            await fetchSpectrogramImage(resultsId);
          } else {
            setJobInfo((prevStatus) => ({
              ...prevStatus,
              status: newStatus as JobStatus | null,
              message: response.message,
              results_id: resultsId,
            }));
          }

          if (newStatus === 'failed') {
            clearInterval(interval);
          }
        } catch (error) {
          console.error('Error fetching job status:', error);
          clearInterval(interval);
          setJobInfo((prevStatus) => ({
            ...prevStatus,
            status: 'failed',
            message: error instanceof Error ? error.message : 'Unknown error',
          }));
        }
      }, POLL_INTERVAL);
    }

    return () => {
      if (interval) {
        clearInterval(interval);
      }
      if (spectrogramUrl) {
        URL.revokeObjectURL(spectrogramUrl);
      }
    };
  }, [jobInfo.job_id, spectrogramUrl]);

  if (!visualizationRecord.uuid) {
    return (
      <Alert variant="warning">
        <Alert.Heading>No Visualization Data Found</Alert.Heading>
        <p>No visualization data found!</p>
      </Alert>
    );
  }

  return (
    <div>
      <Row>
        <Col xs={3} style={{ maxWidth: 200 }}>
          <div className="d-flex flex-column gap-3">
            <SpectrogramControls
              settings={spectrogramSettings}
              setSettings={setSpectrogramSettings}
              numSubchannels={
                visualizationRecord.captures?.[0]?.subchannels ?? undefined
              }
            />
            <Button onClick={createSpectrogramJob} disabled={isSubmitting}>
              Generate Spectrogram
            </Button>
            <JobStatusDisplay isSubmitting={isSubmitting} jobInfo={jobInfo} />
          </div>
        </Col>
        <Col>
          <SpectrogramVisualization
            imageUrl={spectrogramUrl}
            isLoading={
              isSubmitting ||
              (jobInfo.status
                ? ACTIVE_JOB_STATUSES.includes(jobInfo.status)
                : false)
            }
            hasError={jobInfo.status === 'failed' || jobInfo.status === 'error'}
            onSave={handleSaveSpectrogram}
          />
        </Col>
      </Row>
    </div>
  );
};

export default SpectrogramVizContainer;
