import { useState, useEffect} from 'react';
import { useParams } from 'react-router';
import { Row, Col, Button } from 'react-bootstrap';

import Spectrogram from '../components/spectrogram';
import SpectrogramControls from '../components/spectrogram/SpectrogramControls';
import { JobStatusDisplay } from '../components/JobStatusDisplay';
import {
  postSpectrogramJob,
  getJobMetadata,
  getJobResults,
} from '../apiClient/jobService';


 //test code  -mm
//const width =  8.0;
//const height = 6.0;
  // test code ends -mm 

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


   

export interface SpectrogramSettings {
  fftSize: number;
  width: number, // add  -mm
  height: number, // add - mm
}

export interface JobInfo {
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
      width: (window.innerWidth / 100), // added to increase/decrease size of spectrogram image
      height: (window.innerHeight / 100), // added to increase/decrease size of spectrogram image
    });
  const [spectrogramUrl, setSpectrogramUrl] = useState<string | null>(null);

  const [jobInfo, setJobInfo] = useState<JobInfo>({
    job_id: null,
    status: null,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const createSpectrogramJob = async () => {
    setIsSubmitting(true);

    try {
      const response = await postSpectrogramJob(
        datasetId as string,
        spectrogramSettings.fftSize,
        spectrogramSettings.width,
        spectrogramSettings.height,
      );
      setJobInfo({
        job_id: response.job_id ?? null,
        status: response.data?.status ?? null,
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
              message: 'Fetching spectrogram results...',
              results_id: resultsId,
            }));
            await fetchSpectrogramImage(resultsId); // change here -mm
          } else {
            setJobInfo((prevStatus) => ({
              ...prevStatus,
              status: newStatus,
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
  }, [jobInfo.job_id, spectrogramUrl]);

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
            <JobStatusDisplay isSubmitting={isSubmitting} jobInfo={jobInfo} />
          </div>
        </Col>
        <Col>
          <Spectrogram
            imageUrl={spectrogramUrl}
            hasError={jobInfo.status === 'failed'}
          />
        </Col>
      </Row>
    </>
  );
};

export default SpectrogramPage;
