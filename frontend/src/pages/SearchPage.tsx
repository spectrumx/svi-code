import { useEffect, useState } from 'react';

import CaptureTable from '../components/CaptureTable';
import { useSyncCaptures } from '../apiClient/fileService';
import { useAppContext } from '../utils/AppContext';

const SearchPage = () => {
  const context = useAppContext();
  const { captures } = context;
  const syncCaptures = useSyncCaptures();

  interface CheckboxProps {
    label: string;
  }

  useEffect(() => {
    syncCaptures();
  }, [syncCaptures]);

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
    <div className="content-container">
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
              <Checkbox label="Category 2" />
              <Checkbox label="Category 3" />
            </div>
          </div>
          <div></div>
          <CaptureTable captures={captures} />
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
