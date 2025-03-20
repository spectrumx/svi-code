import { Table } from 'react-bootstrap';
import _ from 'lodash';

import { formatHertz } from './index';
import { RadioHoundCapture } from './types';

interface DetailRowProps {
  label: string;
  value?: string;
}

function DetailRow({ label, value }: DetailRowProps): JSX.Element {
  return (
    <tr>
      <td>{label}</td>
      <td>{value ?? ''}</td>
    </tr>
  );
}

interface ScanDetailsProps {
  capture: RadioHoundCapture;
}

export function ScanDetails({ capture }: ScanDetailsProps): JSX.Element {
  // const downloadUrl = useMemo(() => {
  //   const blob = new Blob([JSON.stringify(capture, null, 4)], {
  //     type: 'application/json',
  //   });
  //   return URL.createObjectURL(blob);
  // }, [capture]);

  // const fileName = useMemo(() => {
  //   return `${capture.short_name} ${formatHertz(
  //     capture.metadata?.fmin ?? 0,
  //   )}-${formatHertz(capture.metadata?.fmax ?? 0)}.json`;
  // }, [capture]);

  // Clean up the URL when component unmounts
  // useEffect(() => {
  //   return () => {
  //     if (downloadUrl) {
  //       URL.revokeObjectURL(downloadUrl);
  //     }
  //   };
  // }, [downloadUrl]);

  // Helper function to safely get nested values
  const getCaptureValue = <T,>(
    path: string,
    defaultValue?: T,
  ): T | undefined => {
    return _.get(capture, path, defaultValue) as T;
  };

  return (
    <div>
      <h5>Details</h5>
      <Table striped bordered size="sm">
        <tbody>
          <DetailRow
            label="Node"
            value={`${getCaptureValue('short_name')}${
              getCaptureValue('mac_address')
                ? ` (${getCaptureValue('mac_address')})`
                : ''
            }`}
          />
          <DetailRow
            label="Scan Time"
            value={
              getCaptureValue('metadata.scan_time')
                ? `${
                    Math.round(
                      Number(getCaptureValue('metadata.scan_time')) * 1000,
                    ) / 1000
                  }s`
                : undefined
            }
          />
          <DetailRow
            label="Sample Rate"
            value={getCaptureValue('sample_rate')}
          />
          <DetailRow label="Gain" value={getCaptureValue('gain')} />
          <DetailRow
            label="Frequency Minimum"
            value={
              getCaptureValue('metadata.fmin')
                ? formatHertz(getCaptureValue('metadata.fmin') as number)
                : undefined
            }
          />
          <DetailRow
            label="Frequency Maximum"
            value={
              getCaptureValue('metadata.fmax')
                ? formatHertz(getCaptureValue('metadata.fmax') as number)
                : undefined
            }
          />
          <DetailRow
            label="Number of Samples"
            value={
              typeof getCaptureValue('metadata.xcount') === 'number'
                ? (
                    getCaptureValue('metadata.xcount') as number
                  ).toLocaleString()
                : undefined
            }
          />
          <DetailRow
            label="Timestamp"
            value={
              getCaptureValue('timestamp')
                ? getCaptureValue<string>('timestamp')
                : undefined
            }
          />
          <DetailRow
            label="GPS Lock"
            value={
              getCaptureValue('metadata.gps_lock') !== undefined
                ? getCaptureValue('metadata.gps_lock')
                  ? 'True'
                  : 'False'
                : undefined
            }
          />
          <DetailRow label="Job" value={getCaptureValue('metadata.name')} />
          <DetailRow
            label="Comments"
            value={getCaptureValue('metadata.comments')}
          />
        </tbody>
      </Table>
      {/* <Button as="a" href={downloadUrl} download={fileName}>
        Download Data
      </Button> */}
    </div>
  );
}

export default ScanDetails;
