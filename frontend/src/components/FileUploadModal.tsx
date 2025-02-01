import { useState, useEffect } from 'react';
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

interface CaptureTypeInfo {
  label: string;
  fileCount: number;
  description: string;
}

const CAPTURE_TYPE_INFO: Record<CaptureType, CaptureTypeInfo> = {
  rh: {
    label: 'RadioHound',
    fileCount: 1,
    description: 'Upload a single RadioHound file.',
  },
  drf: {
    label: 'Digital RF',
    fileCount: 1,
    description: 'Upload a single Digital RF file.',
  },
  sigmf: {
    label: 'SigMF',
    fileCount: 2,
    description: 'Upload one .sigmf-data and one .sigmf-meta file.',
  },
};

const getBaseFilename = (filename: string): string => {
  // Remove last extension from filename
  return filename.split('.').slice(0, -1).join('.');
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

    if (files.length !== typeInfo.fileCount) {
      setValidationError(
        `${typeInfo.label} captures require exactly ${typeInfo.fileCount} file${
          typeInfo.fileCount > 1 ? 's' : ''
        }`,
      );
      return false;
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
        const newName = getBaseFilename(files[0].name);
        setCaptureName(newName);
        nameInput.value = newName;
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
      await postCapture(name, type, files);
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
      !!selectedType &&
      !!selectedFiles?.length &&
      !validationError &&
      !!captureName?.trim();
    setIsFormValid(isValid);
  }, [selectedType, selectedFiles, validationError, captureName]);

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
              {selectedType ? CAPTURE_TYPE_INFO[selectedType].description : ''}
            </Form.Text>
            <br />
            <Form.Control
              type="file"
              name="files"
              required
              multiple={selectedType === 'sigmf'}
              onChange={handleFileChange}
              accept={
                selectedType === 'sigmf'
                  ? '.sigmf-data,.sigmf-meta'
                  : selectedType === 'rh'
                    ? '.json'
                    : undefined
              }
            />
            {validationError && (
              <Form.Text className="text-danger">{validationError}</Form.Text>
            )}
          </Form.Group>
          <br />
          <Form.Group controlId="name">
            <Form.Label>Name</Form.Label>
            <Form.Control
              type="text"
              name="name"
              required
              maxLength={255}
              placeholder="Enter a name for this capture"
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
