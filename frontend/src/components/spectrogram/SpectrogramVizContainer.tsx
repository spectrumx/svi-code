import { useState, useEffect } from 'react';
import { Row, Col, Button, Alert } from 'react-bootstrap';

import { SpectrogramVisualization } from '.';
import SpectrogramControls from './SpectrogramControls';
import { JobStatusDisplay } from '../JobStatusDisplay';
import {
  postSpectrogramJob,
  getJobMetadata,
  getJobResults,
  JobStatus,
  ACTIVE_JOB_STATUSES,
} from '../../apiClient/jobService';
import { VizContainerProps } from '../types';

// How long to wait between job status polls to the server
const POLL_INTERVAL = 5000; // 5 seconds
const STALE_JOB_TIMEOUT = 30 * 60 * 1000; // 30 minutes in milliseconds
const MAX_POLL_RETRIES = 10;

export interface SpectrogramSettings {
  fftSize: number;
  stdDev: number;
  hopSize: number;
  colormap: string;
}

export interface JobInfo {
  job_id: number | null;
  status: JobStatus | null;
  requested_at?: number;
  message?: string;
  results_id?: string;
  memory_warning?: string;
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
  const [pollRetries, setPollRetries] = useState(0);

  const createSpectrogramJob = async () => {
    setIsSubmitting(true);
    const width = window.innerWidth / 100;
    const height = window.innerHeight / 100;
    const requested_at = Date.now();

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
        requested_at,
        memory_warning: undefined,
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
   * with timeout and stale job handling
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

          // Check if the job has been running too long (stale job detection)
          const timeSinceJobStart = jobInfo.requested_at ? Date.now() - jobInfo.requested_at : 0;
          if (timeSinceJobStart > STALE_JOB_TIMEOUT) {
            clearInterval(interval);
            setJobInfo((prevStatus) => ({
              ...prevStatus,
              status: 'failed',
              message: 'Job appears to be stale and may have been abandoned. Please try again.',
            }));
            return;
          }

          const response = await getJobMetadata(jobInfo.job_id);

          const newStatus = response.data?.status ?? null;
          const memoryWarning = response.data?.memory_warning;
          const resultsId = response.data?.results_id;
          const error = response.data?.error;

          if (newStatus === 'completed' && resultsId) {
            clearInterval(interval);
            setJobInfo((prevStatus) => ({
              ...prevStatus,
              status: 'fetching_results',
              results_id: resultsId,
              message: undefined,
              memory_warning: undefined,
            }));
            await fetchSpectrogramImage(resultsId);
          } else {
            setJobInfo((prevStatus) => ({
              ...prevStatus,
              status: newStatus as JobStatus | null,
              message: prevStatus.message ?? error ?? response.message,
              memory_warning: prevStatus.memory_warning ?? memoryWarning,
            }));
          }

          if (newStatus === 'failed') {
            clearInterval(interval);
          }
        } catch (error) {
          console.error(`Error polling job ${jobInfo.job_id} status:`, error);
          setPollRetries(pollRetries + 1);
          if (pollRetries >= MAX_POLL_RETRIES) {
            clearInterval(interval);
            setJobInfo((prevStatus) => ({
              ...prevStatus,
              status: 'failed',
              message: 'Failed to get job status.',
            }));
          }
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
  }, [jobInfo.job_id, jobInfo.requested_at, spectrogramUrl, pollRetries]);

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
