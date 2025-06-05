import { Table } from 'react-bootstrap';
import _ from 'lodash';

import { formatHertz } from '../../utils/utils';
import { WaterfallFile } from './types';

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
  waterfallFile: WaterfallFile;
}

export function ScanDetails({ waterfallFile }: ScanDetailsProps): JSX.Element {
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
  const getScanValue = <T,>(path: string, defaultValue?: T): T | undefined => {
    return _.get(waterfallFile, path, defaultValue) as T;
  };

  return (
    <div>
      <h5>Details</h5>
      <Table striped bordered size="sm" className="scan-details-table">
        <tbody>
          <DetailRow
            label="Node"
            value={`${getScanValue('device_name')}${
              getScanValue('mac_address')
                ? ` (${getScanValue('mac_address')})`
                : ''
            }`}
          />
          <DetailRow
            label="Scan Time"
            value={
              getScanValue('custom_fields.scan_time')
                ? `${
                    Math.round(
                      Number(getScanValue('custom_fields.scan_time')) * 1000,
                    ) / 1000
                  }s`
                : undefined
            }
          />
          <DetailRow label="Sample Rate" value={getScanValue('sample_rate')} />
          <DetailRow label="Gain" value={getScanValue('gain')} />
          <DetailRow
            label="Frequency Minimum"
            value={
              getScanValue('min_frequency')
                ? formatHertz(getScanValue('min_frequency') as number)
                : undefined
            }
          />
          <DetailRow
            label="Frequency Maximum"
            value={
              getScanValue('max_frequency')
                ? formatHertz(getScanValue('max_frequency') as number)
                : undefined
            }
          />
          <DetailRow
            label="Number of Samples"
            value={
              typeof getScanValue('nfft') === 'number'
                ? (getScanValue('nfft') as number).toLocaleString()
                : undefined
            }
          />
          <DetailRow
            label="Timestamp"
            value={
              getScanValue('timestamp')
                ? getScanValue<string>('timestamp')
                : undefined
            }
          />
          <DetailRow
            label="GPS Lock"
            value={
              getScanValue('custom_fields.gps_lock') !== undefined
                ? getScanValue('custom_fields.gps_lock')
                  ? 'True'
                  : 'False'
                : undefined
            }
          />
          <DetailRow
            label="Job"
            value={getScanValue('custom_fields.job_name')}
          />
          <DetailRow
            label="Comments"
            value={getScanValue('custom_fields.comments')}
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
