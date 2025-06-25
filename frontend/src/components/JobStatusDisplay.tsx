import { Alert, Spinner } from 'react-bootstrap';
import _ from 'lodash';

import { JobInfo } from './spectrogram/SpectrogramVizContainer';

interface JobStatusDisplayProps {
  isSubmitting: boolean;
  jobInfo: JobInfo;
}

/**
 * Displays the current status of a job with appropriate styling and loading indicators
 */
const JobStatusDisplay = ({ isSubmitting, jobInfo }: JobStatusDisplayProps) => {
  if (!isSubmitting && !jobInfo.job_id && !jobInfo.message) return null;

  const variants: { [key: string]: string } = {
    info: 'info',
    pending: 'info',
    submitted: 'info',
    running: 'primary',
    fetching_results: 'info',
    completed: 'success',
    failed: 'danger',
    error: 'danger',
  };

  const isActive =
    isSubmitting ||
    ['pending', 'submitted', 'running', 'fetching_results'].includes(
      jobInfo.status || '',
    );

  return (
    <Alert variant={isSubmitting ? 'info' : variants[jobInfo.status || 'info']}>
      <div className="d-flex align-items-center">
        {isActive && (
          <div>
            <Spinner
              animation="border"
              size="sm"
              className="me-2"
              variant={
                isSubmitting ? 'info' : variants[jobInfo.status || 'info']
              }
            />
          </div>
        )}
        <div>
          {isSubmitting ? (
            'Creating spectrogram job...'
          ) : (
            <>
              Job status:{' '}
              {_.capitalize(
                jobInfo.status?.replace('_', ' ') || 'Status missing',
              )}
              {jobInfo.message && <div>{jobInfo.message}</div>}
            </>
          )}
        </div>
      </div>
    </Alert>
  );
};

export { JobStatusDisplay };
