import { Alert, Spinner } from 'react-bootstrap';
import _ from 'lodash';

import { JobInfo } from '../pages/SpectrogramPage';

interface JobStatusProps {
  isSubmitting: boolean;
  jobInfo: JobInfo;
}

/**
 * Displays the current status of a job with appropriate styling and loading indicators
 */
const JobStatus = ({ isSubmitting, jobInfo }: JobStatusProps) => {
  if (!isSubmitting && !jobInfo.job_id) return null;

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
      jobInfo.status || '',
    );

  return (
    <Alert variant={isSubmitting ? 'info' : variants[jobInfo.status || 'info']}>
      <div className="d-flex align-items-center">
        {isActive && (
          <Spinner
            animation="border"
            size="sm"
            className="me-2"
            variant={isSubmitting ? 'info' : variants[jobInfo.status || 'info']}
          />
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

export { JobStatus };
