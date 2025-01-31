import { CSSProperties, useMemo } from 'react';
import { Button, Table } from 'react-bootstrap';
import _ from 'lodash';

import { formatHertz } from './index';
import { RadioHoundCapture } from './types';

export interface ScanDetailProps {
  data: object | undefined;
  label: string;
  labelStyle: CSSProperties;
  value: string | (() => string) | (() => JSX.Element);
}

export function ScanDetail({ label, labelStyle, value }: ScanDetailProps) {
  return (
    <>
      <span style={labelStyle}>{label}</span>{' '}
      {value !== undefined ? value() : ''}
    </>
  );
}

interface ScanDetailsProps {
  capture: RadioHoundCapture;
}

function ScanDetails({ capture }: ScanDetailsProps) {
  function downloadJSON() {
    const element = document.createElement('a');
    const file = new Blob([JSON.stringify(capture, null, 4)], {
      type: 'text/plain',
    });
    element.href = URL.createObjectURL(file);
    element.download =
      capture.short_name +
      ' ' +
      formatHertz(capture.metadata.fmin) +
      '-' +
      formatHertz(capture.metadata.fmax) +
      '.json';
    document.body.appendChild(element); // Required for this to work in FireFox
    element.click();
  }

  const labelStyle = useMemo(
    () => ({
      //fontFamily: 'Segoe UI, Arial, Helvetica',
      fontSize: 16,
      width: '100%',
    }),
    [],
  );

  const scanDetails = useMemo(
    () =>
      [
        {
          label: 'Node:',
          value: () =>
            _.has(capture, 'short_name')
              ? _.get(capture, 'short_name') +
                (_.get(capture, 'mac_address')
                  ? ` (${_.get(capture, 'mac_address')})`
                  : '')
              : '',
        },
        {
          label: 'Scan Time:',
          value: () =>
            _.has(capture, 'metadata.scan_time')
              ? Math.round(
                  Number(_.get(capture, 'metadata.scan_time')) * 1000,
                ) /
                  1000 +
                's'
              : '',
        },
        {
          label: 'Sample Rate:',
          value: () =>
            _.has(capture, 'sample_rate') ? (
              <span>{_.get(capture, 'sample_rate')}</span>
            ) : (
              ''
            ),
        },
        {
          label: 'Gain:',
          value: () =>
            _.has(capture, 'gain') ? <span>{_.get(capture, 'gain')}</span> : '',
        },
        {
          label: 'Freq Min:',
          value: () =>
            _.has(capture, 'metadata.fmin') ? (
              <span>{formatHertz(_.get(capture, 'metadata.fmin'))}</span>
            ) : (
              ''
            ),
        },
        {
          label: 'Freq Max:',
          value: () =>
            _.has(capture, 'metadata.fmax') ? (
              <span>{formatHertz(_.get(capture, 'metadata.fmax', 0))}</span>
            ) : (
              ''
            ),
        },
        {
          label: 'Num of Samples:',
          value: () =>
            _.has(capture, 'metadata.xcount') ? (
              <span>{_.get(capture, 'metadata.xcount')}</span>
            ) : (
              ''
            ),
        },
        {
          label: 'Timestamp:',
          value: () =>
            capture !== undefined && _.has(capture, 'timestamp') ? (
              <span>
                {_.get(capture, 'timestamp').substring(0, 19).replace('T', ' ')}{' '}
                (UTC)
              </span>
            ) : (
              ''
            ),
        },
        {
          label: 'GPS Lock:',
          value: () =>
            capture !== undefined && _.has(capture, 'metadata.gps_lock') ? (
              <span>
                {_.get(capture, 'metadata.gps_lock') ? 'True' : 'False'}
              </span>
            ) : (
              ''
            ),
        },
        {
          label: 'Job:',
          value: () =>
            capture !== undefined && _.has(capture, 'metadata.name') ? (
              <span>{_.get(capture, 'metadata.name')}</span>
            ) : (
              ''
            ),
        },
      ].map((detail) => ({
        labelStyle,
        ...detail,
      })) as ScanDetailProps[],
    [capture, labelStyle],
  );
  // console.log('scanDetails', scanDetails, scanDetails[0])

  const rows = [];
  for (let i = 0; i < scanDetails.length; i += 2) {
    const detail1 = scanDetails[i];
    const detail2 = scanDetails[i + 1];

    rows.push({
      key: i,
      data: (
        <>
          <td key={i}>
            <ScanDetail {...detail1} />
          </td>
          <td key={i + 1}>
            <ScanDetail {...detail2} />
          </td>
        </>
      ),
    });
  }

  return (
    <div style={labelStyle}>
      <div style={{ fontWeight: '700' }}>Details</div>
      <Table striped bordered size="sm">
        <tbody>
          {rows.map((row) => (
            <tr key={row.key}>{row.data}</tr>
          ))}
          <tr>
            <td>Comments:</td>
            <td>
              {' '}
              {'metadata' in capture &&
                capture.metadata !== undefined &&
                'comments' in capture.metadata && (
                  <span>{capture.metadata.comments}</span>
                )}
            </td>
          </tr>
        </tbody>
      </Table>

      {Object.keys(capture).length > 0 && (
        <Button onClick={downloadJSON} variant="outline-primary" size="sm">
          Download Data
        </Button>
      )}
    </div>
  );
}

export default ScanDetails;
