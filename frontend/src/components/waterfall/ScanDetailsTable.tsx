import { Table } from 'react-bootstrap';
import _ from 'lodash';

import { formatHertz } from './index';
import { RadioHoundFile } from './types';

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
  rhFile: RadioHoundFile;
}

export function ScanDetails({ rhFile }: ScanDetailsProps): JSX.Element {
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
  const getRhFileValue = <T,>(
    path: string,
    defaultValue?: T,
  ): T | undefined => {
    return _.get(rhFile, path, defaultValue) as T;
  };

  return (
    <div>
      <h5>Details</h5>
      <Table striped bordered size="sm" className="scan-details-table">
        <tbody>
          <DetailRow
            label="Node"
            value={`${getRhFileValue('short_name')}${
              getRhFileValue('mac_address')
                ? ` (${getRhFileValue('mac_address')})`
                : ''
            }`}
          />
          <DetailRow
            label="Scan Time"
            value={
              getRhFileValue('metadata.scan_time')
                ? `${
                    Math.round(
                      Number(getRhFileValue('metadata.scan_time')) * 1000,
                    ) / 1000
                  }s`
                : undefined
            }
          />
          <DetailRow
            label="Sample Rate"
            value={getRhFileValue('sample_rate')}
          />
          <DetailRow label="Gain" value={getRhFileValue('gain')} />
          <DetailRow
            label="Frequency Minimum"
            value={
              getRhFileValue('metadata.fmin')
                ? formatHertz(getRhFileValue('metadata.fmin') as number)
                : undefined
            }
          />
          <DetailRow
            label="Frequency Maximum"
            value={
              getRhFileValue('metadata.fmax')
                ? formatHertz(getRhFileValue('metadata.fmax') as number)
                : undefined
            }
          />
          <DetailRow
            label="Number of Samples"
            value={
              typeof getRhFileValue('metadata.xcount') === 'number'
                ? (getRhFileValue('metadata.xcount') as number).toLocaleString()
                : undefined
            }
          />
          <DetailRow
            label="Timestamp"
            value={
              getRhFileValue('timestamp')
                ? getRhFileValue<string>('timestamp')
                : undefined
            }
          />
          <DetailRow
            label="GPS Lock"
            value={
              getRhFileValue('metadata.gps_lock') !== undefined
                ? getRhFileValue('metadata.gps_lock')
                  ? 'True'
                  : 'False'
                : undefined
            }
          />
          <DetailRow label="Job" value={getRhFileValue('metadata.name')} />
          <DetailRow
            label="Comments"
            value={getRhFileValue('metadata.comments')}
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
