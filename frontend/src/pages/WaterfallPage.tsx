import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import { Alert, Row, Col, Spinner } from 'react-bootstrap';

import {
  WaterfallVisualization,
  PeriodogramType,
} from '../components/waterfall';
import WaterfallControls from '../components/waterfall/WaterfallControls';
import {
  getFileMetadata,
  FileMetadata,
  getFileContent,
} from '../apiClient/fileService';

const WaterfallPage = () => {
  const { datasetId } = useParams();
  const [fileMetadata, setFileMetadata] = useState<FileMetadata | null>(null);
  const [file, setFile] = useState<PeriodogramType | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchFile = async () => {
      try {
        setIsLoading(true);
        setError(null);

        const fileMetadata = await getFileMetadata(Number(datasetId));
        setFileMetadata(fileMetadata);
        const fileData = await getFileContent(fileMetadata.id);
        setFile(fileData);
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : 'An error occurred while fetching the file data',
        );
      } finally {
        setIsLoading(false);
      }
    };

    if (datasetId) {
      fetchFile();
    }
  }, [datasetId]);

  if (isLoading) {
    return (
      <div
        className="d-flex justify-content-center align-items-center"
        style={{ minHeight: '200px' }}
      >
        <Spinner animation="border" role="status">
          <span className="visually-hidden">Loading...</span>
        </Spinner>
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="danger">
        <Alert.Heading>Error</Alert.Heading>
        <p>{error}</p>
      </Alert>
    );
  }

  if (!file) {
    return (
      <Alert variant="warning">
        <Alert.Heading>No Data Found</Alert.Heading>
        <p>No data found for this dataset</p>
      </Alert>
    );
  }

  return (
    <>
      <h5>Waterfall for file: {fileMetadata?.name}</h5>
      <br />
      <Row>
        <Col xs={3} style={{ maxWidth: 200 }}>
          <div className="d-flex flex-column gap-3">
            <WaterfallControls />
          </div>
        </Col>
        <Col>
          <WaterfallVisualization data={file} />
        </Col>
      </Row>
    </>
  );
};

export default WaterfallPage;
