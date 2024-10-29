import axios from 'axios';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import { api_host } from '../App';

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
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    const transformedFormData = new FormData();
    transformedFormData.append('data_file', formData.get('dataFile') as Blob);
    transformedFormData.append('meta_file', formData.get('metaFile') as Blob);

    try {
      await axios.post(
        `${api_host}/api/sigmf-file-pairs/`,
        transformedFormData,
        {
          headers: {
            'Content-Type': 'multipart/form-data',
          },
        },
      );
      handleSuccess();
    } catch (error) {
      console.error(error);
    }
    handleClose();
  };

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header>
        <Modal.Title>Upload a New Dataset</Modal.Title>
      </Modal.Header>
      <Modal.Body>
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
