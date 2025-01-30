import { useState } from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import { postCapture, CaptureType } from '../apiClient/fileService';
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

    const name = formData.get('name') as string;
    const type = formData.get('type') as CaptureType;
    const files = formData.getAll('files') as Blob[];

    try {
      await postCapture(name, type, files);
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
          <Form.Group controlId="name">
            <Form.Label>Name</Form.Label>
            <Form.Control
              type="text"
              name="name"
              required
              maxLength={255}
              placeholder="Enter a name for the capture"
            />
          </Form.Group>
          <br />
          <Form.Group controlId="type">
            <Form.Label>Type</Form.Label>
            <Form.Control type="text" name="type" as="select" required>
              <option value="drf">Digital RF</option>
              <option value="rh">RadioHound</option>
              <option value="sigmf">SigMF</option>
            </Form.Control>
          </Form.Group>
          <br />
          <Form.Group controlId="files">
            <Form.Label>Files</Form.Label>
            <Form.Control type="file" name="files" required multiple />
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
