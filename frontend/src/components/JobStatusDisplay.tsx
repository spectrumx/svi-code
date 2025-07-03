import { Alert, Spinner } from 'react-bootstrap';
import _ from 'lodash';

import { ACTIVE_JOB_STATUSES } from '../apiClient/jobService';
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
    (jobInfo.status && ACTIVE_JOB_STATUSES.includes(jobInfo.status));

  // Check for memory warning in job info
  const hasMemoryWarning = jobInfo.memory_warning || (jobInfo.message && jobInfo.message.includes('memory_warning'));

  return (
    <div className="d-flex flex-column gap-2">
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

      {/* Show memory warning if present */}
      {hasMemoryWarning && (
        <Alert variant="warning" className="mb-0">
          <Alert.Heading>
            <i className="bi bi-exclamation-triangle me-2"></i>
            Memory Usage Warning
          </Alert.Heading>
          <p className="mb-0">
            This job may use significant memory. The system will attempt to process it,
            but performance may be affected. Consider using smaller datasets or different
            processing parameters if issues occur.
          </p>
        </Alert>
      )}
    </div>
  );
};

export { JobStatusDisplay };
