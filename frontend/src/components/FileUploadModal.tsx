import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import { api_host } from '../App';

interface FileUploadModalProps {
  show: boolean;
  handleClose: () => void;
}

const FileUploadModal = ({ show, handleClose }: FileUploadModalProps) => {
  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);
    console.log({ formData });
    // const response = await fetch(`${api_host}/api/sigmf-file-pairs/`, {
    //   method: 'POST',
    //   body: formData,
    // });
    // if (response.ok) {
    //   alert('File uploaded successfully!');
    // } else {
    //   alert('Failed to upload file');
    // }
    // handleClose();
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
            <Form.Control type="file" />
          </Form.Group>
          <br />
          <Form.Group controlId="metaFile">
            <Form.Label>Metadata File</Form.Label>
            <Form.Control type="file" />
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
