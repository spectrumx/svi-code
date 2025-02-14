import { useEffect } from 'react';

import CaptureSearch from '../components/CaptureSearch';
import { useSyncCaptures } from '../apiClient/fileService';
import { useAppContext } from '../utils/AppContext';

/**
 * SearchPage component that displays a search interface for RF captures
 * with filtering capabilities
 */
export const SearchPage = () => {
  const context = useAppContext();
  const { captures } = context;
  const syncCaptures = useSyncCaptures();

  useEffect(() => {
    syncCaptures();
  }, [syncCaptures]);

  return (
    <div className="page-container">
      <h5>Search</h5>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          width: '100%',
          padding: '10px',
        }}
      >
        <CaptureSearch captures={captures} />
      </div>
    </div>
  );
};

export default SearchPage;
