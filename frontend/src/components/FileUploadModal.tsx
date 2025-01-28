import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import { postSigMFFilePair } from '../apiClient/fileService';
import { useState } from 'react';
import { Alert } from 'react-bootstrap';

interface FileUploadModalProps {
  show: boolean;
  handleClose: () => void;
  handleSuccess: () => void;
}

const FileUploadModal = ({
  show,
  handleClose,
  handleSuccess,
}: FileUploadModalProps) => {
  const [showFailedAlert, setShowFailedAlert] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const dataFile = formData.get('dataFile') as Blob;
    const metaFile = formData.get('metaFile') as Blob;

    try {
      await postSigMFFilePair(dataFile, metaFile);
      handleSuccess();
      handleClose();
    } catch (error) {
      console.error(error);
      setShowFailedAlert(true);
    }
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header>
        <Modal.Title>Upload a New Dataset</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {showFailedAlert && (
          <Alert
            variant="danger"
            onClose={() => setShowFailedAlert(false)}
            dismissible
          >
            Error: Failed to upload dataset
          </Alert>
        )}
        <Form onSubmit={handleSubmit}>
          <Form.Group controlId="dataFile">
            <Form.Label>Data File</Form.Label>
            <Form.Control type="file" name="dataFile" />
          </Form.Group>
          <br />
          <Form.Group controlId="metaFile">
            <Form.Label>Metadata File</Form.Label>
            <Form.Control type="file" name="metaFile" />
          </Form.Group>
          <br />
          <Button variant="primary" type="submit">
            Upload
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default FileUploadModal;
