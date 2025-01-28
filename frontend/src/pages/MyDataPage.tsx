import { useEffect, useState } from 'react';
import Button from '../components/Button';

import FileUploadModal from '../components/FileUploadModal';
import { useAppContext } from '../utils/AppContext';
import { useSyncSigMFFilePairs } from '../apiClient/fileService';
import DatasetTable from '../components/DatasetTable';
import IntegratedTable from '../components/IntegratedTable';
import {
  IntegratedResponse,
  getIntegratedView,
} from '../apiClient/fileService';

const MyDataPage = () => {
  const context = useAppContext();
  const { sigMFFilePairs } = context;
  const syncSigMFFilePairs = useSyncSigMFFilePairs();
  const [showModal, setShowModal] = useState(false);

  const [integrated, setIntegratedView] = useState<IntegratedResponse>([]);

  const syncIntegratedView = async () => {
    setIntegratedView(await getIntegratedView());
  };

  useEffect(() => {
    syncSigMFFilePairs();
    syncIntegratedView();
  }, [syncSigMFFilePairs]);

  return (
    <>
      <h5>SigMF File Pairs</h5>
      <DatasetTable datasets={sigMFFilePairs} type="sigmf" />
      <h5>Integrated View</h5>
      <IntegratedTable datasets={integrated} />
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!context?.username}
        disabledHelpText="You must be logged in to upload a capture"
      >
        Upload SigMF File Pair
      </Button>
      <FileUploadModal
        show={showModal}
        handleClose={() => setShowModal(false)}
        handleSuccess={syncSigMFFilePairs}
      />
    </>
  );
};

export default MyDataPage;
