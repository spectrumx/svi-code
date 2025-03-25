import { useState, useEffect } from 'react';
import Button from 'react-bootstrap/Button';
import Modal from 'react-bootstrap/Modal';
import Form from 'react-bootstrap/Form';
import {
  postCaptures,
  CaptureType,
  inferCaptureName,
} from '../apiClient/captureService';
import { Alert } from 'react-bootstrap';

interface FileUploadModalProps {
  show: boolean;
  handleClose: () => void;
  handleSuccess: () => void;
}

interface CaptureTypeInfo {
  label: string;
  fileExtensions: string[];
  description: string;
  minFiles: number;
  maxFiles: number;
}

const CAPTURE_TYPE_INFO: Record<CaptureType, CaptureTypeInfo> = {
  rh: {
    label: 'RadioHound',
    fileExtensions: ['.json', '.rh'],
    minFiles: 1,
    maxFiles: 100,
    description:
      'Upload one or more RadioHound files (max of 100). Each file will create a separate capture.',
  },
  drf: {
    label: 'Digital RF',
    fileExtensions: ['.drf'],
    minFiles: 1,
    maxFiles: 1,
    description: 'Upload a single Digital RF file.',
  },
  sigmf: {
    label: 'SigMF',
    fileExtensions: ['.sigmf-data', '.sigmf-meta'],
    minFiles: 2,
    maxFiles: 2,
    description: 'Upload one .sigmf-data and one .sigmf-meta file.',
  },
};

const FileUploadModal = ({
  show,
  handleClose,
  handleSuccess,
}: FileUploadModalProps) => {
  const [showFailedAlert, setShowFailedAlert] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [isUploading, setIsUploading] = useState(false);
  const [selectedType, setSelectedType] = useState<CaptureType>('rh');
  const [selectedFiles, setSelectedFiles] = useState<FileList>();
  const [validationError, setValidationError] = useState<string>('');
  const [captureName, setCaptureName] = useState<string>('');
  const [isFormValid, setIsFormValid] = useState(false);

  const captureTypeInfo = CAPTURE_TYPE_INFO[selectedType];

  // Reset state when modal is opened/closed
  useEffect(() => {
    if (show) {
      setSelectedType('rh');
      setSelectedFiles(undefined);
      setValidationError('');
      setShowFailedAlert(false);
      setCaptureName('');
      setIsFormValid(false);
    }
  }, [show]);

  const validateFiles = (
    files: FileList | undefined,
    type: CaptureType,
  ): boolean => {
    if (!files) {
      setValidationError('Please select files to upload');
      return false;
    }

    const typeInfo = CAPTURE_TYPE_INFO[type];

    if (files.length < typeInfo.minFiles) {
      setValidationError(
        `${typeInfo.label} captures require at least ${typeInfo.minFiles} file${
          typeInfo.minFiles > 1 ? 's' : ''
        }`,
      );
      return false;
    }

    if (files.length > typeInfo.maxFiles) {
      setValidationError(
        `Too many files selected. Max files: ${typeInfo.maxFiles}`,
      );
      return false;
    }

    if (type === 'rh') {
      if (files.length === 0) {
        setValidationError('Please select at least one RadioHound file');
        return false;
      }
      // Verify all files have valid extensions
      const invalidFiles = Array.from(files).filter(
        (file) =>
          !typeInfo.fileExtensions.some((ext) => file.name.endsWith(ext)),
      );
      if (invalidFiles.length > 0) {
        setValidationError(
          `Allowed RadioHound file extensions: ${typeInfo.fileExtensions.join(
            ', ',
          )}`,
        );
        return false;
      }
      setValidationError('');
      return true;
    }

    if (type === 'sigmf') {
      const hasMetaFile = Array.from(files).some((file) =>
        file.name.endsWith('.sigmf-meta'),
      );
      const hasDataFile = Array.from(files).some((file) =>
        file.name.endsWith('.sigmf-data'),
      );

      if (!hasMetaFile || !hasDataFile) {
        setValidationError(
          'SigMF captures require both .sigmf-data and .sigmf-meta files',
        );
        return false;
      }
    }

    setValidationError('');
    return true;
  };

  const handleTypeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const newType = event.target.value as CaptureType;
    setSelectedType(newType);
    if (selectedFiles) {
      validateFiles(selectedFiles, newType);
    }
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files || undefined;
    setSelectedFiles(files);

    // Auto-populate name if empty and files selected
    if (files) {
      const nameInput =
        document.querySelector<HTMLInputElement>('input[name="name"]');
      if (nameInput && !nameInput.value) {
        const newName = inferCaptureName(Array.from(files), selectedType);
        if (newName) {
          setCaptureName(newName);
        }
      }
    }

    if (selectedType) {
      validateFiles(files, selectedType);
    }
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsUploading(true);
    setShowFailedAlert(false);

    const form = event.currentTarget as HTMLFormElement;
    const formData = new FormData(form);

    const name = formData.get('name') as string;
    const type = formData.get('type') as CaptureType;
    const files = Array.from(selectedFiles || []);

    if (!validateFiles(selectedFiles, type)) {
      setIsUploading(false);
      return;
    }

    try {
      await postCaptures(type, files, name);
      handleSuccess();
      handleClose();
    } catch (error) {
      console.error('Upload failed:', error);
      setErrorMessage(
        error instanceof Error ? error.message : 'Failed to upload capture',
      );
      setShowFailedAlert(true);
    } finally {
      setIsUploading(false);
    }
  };

  // Update validation when relevant fields change
  useEffect(() => {
    const isValid =
      !!selectedType && !!selectedFiles?.length && !validationError;
    setIsFormValid(isValid);
  }, [selectedType, selectedFiles, validationError]);

  return (
    <Modal show={show} onHide={handleClose}>
      <Modal.Header>
        <Modal.Title>Upload New Capture</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        {showFailedAlert && (
          <Alert
            variant="danger"
            onClose={() => setShowFailedAlert(false)}
            dismissible
          >
            Error: {errorMessage}
          </Alert>
        )}
        <Form onSubmit={handleSubmit}>
          <Form.Group controlId="type">
            <Form.Label>Type</Form.Label>
            <Form.Select
              name="type"
              required
              value={selectedType || ''}
              onChange={handleTypeChange}
            >
              {Object.entries(CAPTURE_TYPE_INFO).map(([value, info]) => (
                <option key={value} value={value}>
                  {info.label}
                </option>
              ))}
            </Form.Select>
          </Form.Group>
          <br />
          <Form.Group controlId="files">
            <Form.Label>Files</Form.Label>
            <br />
            <Form.Text className="text-muted">
              {captureTypeInfo.description}
            </Form.Text>
            <br />
            <Form.Control
              type="file"
              name="files"
              required
              multiple={captureTypeInfo.maxFiles > 1}
              onChange={handleFileChange}
              accept={captureTypeInfo.fileExtensions.join(',')}
            />
            {validationError && (
              <Form.Text className="text-danger">{validationError}</Form.Text>
            )}
          </Form.Group>
          <br />
          <Form.Group controlId="name">
            <Form.Label>Name</Form.Label>
            <br />
            <Form.Text className="text-muted">
              If left blank, the file's base name will be used.
            </Form.Text>
            <br />
            <Form.Control
              type="text"
              name="name"
              maxLength={255}
              value={captureName}
              onChange={(e) => setCaptureName(e.target.value)}
            />
          </Form.Group>
          <br />
          <Button
            variant="primary"
            type="submit"
            disabled={isUploading || !!validationError || !isFormValid}
          >
            {isUploading ? 'Uploading...' : 'Upload'}
          </Button>
        </Form>
      </Modal.Body>
    </Modal>
  );
};

export default FileUploadModal;
