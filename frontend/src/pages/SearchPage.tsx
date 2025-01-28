import { useEffect, useState } from 'react';
import Button from '../components/Button';

import DatasetTable from '../components/DatasetTable';
import CaptureTable from '../components/CaptureTable';
import IntegratedTable from '../components/IntegratedTable';
import FileUploadModal from '../components/FileUploadModal';
import {
  getSigMFFilePairs,
  SigMFFilePairResponse,
  CaptureResponse,
  getCaptures,
  IntegratedResponse,
  getIntegratedView,
} from '../apiClient/fileService';
import { useAppContext } from '../utils/AppContext';

const SearchPage = () => {
  const context = useAppContext();
  const [showModal, setShowModal] = useState(false);
  const [datasets, setDatasets] = useState<SigMFFilePairResponse>([]);
  //const [captures, setCaptures] = useState<CaptureResponse>([]);
  const [integrated, setIntegratedView] = useState<IntegratedResponse>([]); // combined the SigMFFilePair table and newly created capture table
  // const [combineddatasets, setCombineCapture] = useState<CombinedResponse | null>(null);

  interface CheckboxProps {
    label: string;
  }

  const syncDatasets = async () => {
    setDatasets(await getSigMFFilePairs());
  };

  /* useEffect(() => {
    syncDatasets();
  }, []);

  const syncCaptures = async() => {
    setCaptures(await getCapture())

  };

  useEffect(() => {
    syncCaptures();

  }, []);*/

  const syncIntegratedView = async () => {
    setIntegratedView(await getIntegratedView());
  };

  useEffect(() => {
    syncIntegratedView();
  }, []);

  const Checkbox: React.FC<CheckboxProps> = ({ label }) => {
    const [isChecked, setIsChecked] = useState(false);

    const handleChange = () => {
      setIsChecked(!isChecked);
    };

    return (
      <div>
        <input type="checkbox" checked={isChecked} onChange={handleChange} />
        <label>{label}</label>
      </div>
    );
  };

  return (
    <>
      <div
        style={{
          padding: '10px',
          textAlign: 'center',
          backgroundColor: '#ffffff',
        }}
      >
        <h5> Search</h5>
        <input
          type="text"
          placeholder="Search..."
          style={{
            padding: '10px',
            width: '800px',
            borderRadius: '20px',
            border: '1px solid #ccc',
            outline: 'none',
          }}
        />
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            width: '90%',
            minWidth: '600px',
            maxWidth: '1400px',
            gap: '20px',
          }}
        >
          <div
            style={{
              width: '200px',
            }}
          >
            <h5>Filters</h5>
            <div>
              <Checkbox label="Frequency" />
              <Checkbox label="Category2" />
              <Checkbox label="Category 3" />
            </div>
          </div>
          <div></div>
          <IntegratedTable datasets={integrated} />
        </div>
      </div>
      <br />
      <FileUploadModal
        show={showModal}
        handleClose={() => setShowModal(false)}
        handleSuccess={syncDatasets}
      />
      <br />
      <br />
    </>
  );
};

export default SearchPage;
