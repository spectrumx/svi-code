import { useEffect, useState } from 'react';
import Button from '../components/Button';

import DatasetTable from '../components/DatasetTable';
import CaptureTable  from '../components/CaptureTable';
import IntegratedTable from '../components/IntegratedTable';
import FileUploadModal from '../components/FileUploadModal';
import { getDatasets, SigMFFilePairResponse, CaptureResponse, getCapture , IntegratedResponse, getIntegratedView} from '../apiClient/fileService';
import { useAppContext } from '../utils/AppContext';

const WorkspacePage = () => {
  const context = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [datasets, setDatasets] = useState<SigMFFilePairResponse>([]);
  const [captures, setCaptures] = useState<CaptureResponse>([]);
  const [integrated, setIntegratedView] = useState<IntegratedResponse>([]);
 // const [combineddatasets, setCombineCapture] = useState<CombinedResponse | null>(null);

  const syncDatasets = async () => {
    setDatasets(await getDatasets());
  };

  useEffect(() => {
    syncDatasets();
  }, []);

  const syncCaptures = async() => {
    setCaptures(await getCapture())

  };

  useEffect(() => {
    syncCaptures();

  }, []);

  const syncIntegratedView = async() => {
    setIntegratedView(await getIntegratedView())

  };

  useEffect(() => {
    syncIntegratedView();

  }, []);

  return (
    <>
     
      <h5>Select a Dataset to Visualize</h5>
      <DatasetTable datasets={datasets} />
      <br />
      <h5>Add a New Dataset</h5>
      <Button
        variant="primary"
        onClick={() => setShowModal(true)}
        disabled={!context?.username}
        disabledHelpText="You must be logged in to upload a dataset"
      >
        Upload Dataset
      </Button>
      <FileUploadModal
        show={showModal}
        handleClose={() => setShowModal(false)}
        handleSuccess={syncDatasets}
      />
      <br />
      <br />    
       <h4>
        <h5>Capture List</h5>
        <IntegratedTable datasets={integrated}/>
      </h4>
    </>
  );
};

export default WorkspacePage;
