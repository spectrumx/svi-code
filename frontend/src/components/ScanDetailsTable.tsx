import React from 'react';
import { Table, Button, Card } from 'react-bootstrap';
import Nav from 'react-bootstrap/Nav';

const ScanDetailsTable = () => {
  return (
    <Card className='p-2 my-0'>
        <Card.Header>
        <Nav variant="tabs" defaultActiveKey="#first">
          <Nav.Item>
            <Nav.Link href="#first">ScanDetails</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link href="#link">Markers</Nav.Link>
          </Nav.Item>
          <Nav.Item>
            <Nav.Link href="#link">Display</Nav.Link>
          </Nav.Item>
        </Nav>
      </Card.Header>
      <Card.Body>
        <Table striped bordered hover>
          <tbody>
            <tr>
              <th>Node</th>
              <td>Beagle V3.4-003 #1 (8827)</td>
              <th>Scan Time</th>
              <td>0.071s</td>
            </tr>
            <tr>
              <th>Sample Rate</th>
              <td>24,000,000</td>
              <th>Gain</th>
              <td>1</td>
            </tr>
            <tr>
              <th>Freq Min</th>
              <td>1.99 GHz</td>
              <th>Freq Max</th>
              <td>2.01 GHz</td>
            </tr>
            <tr>
              <th>Num of Samples</th>
              <td>1024</td>
              <th>Timestamp</th>
              <td>2025-01-28 19:05:08 (UTC)</td>
            </tr>
            <tr>
              <th>GPS Lock</th>
              <td>False</td>
              <th>Job</th>
              <td></td>
            </tr>
            <tr>
              <th>Comments</th>
              <td colSpan={3}></td>
            </tr>
          </tbody>
        </Table>
        <Button variant="primary">Download Data</Button>
      </Card.Body>
    </Card>
  );
};

export default ScanDetailsTable;
