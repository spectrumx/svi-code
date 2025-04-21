import { useEffect, useState } from 'react';

import CaptureSearch from '../components/CaptureSearch';
import { useSyncCaptures } from '../apiClient/captureService';
import { useAppContext } from '../utils/AppContext';
import LoadingBlock from '../components/LoadingBlock';

/**
 * SearchPage component that displays a search interface for RF captures
 * with filtering capabilities
 */
export const SearchPage = () => {
  const context = useAppContext();
  const { captures } = context;
  const syncCaptures = useSyncCaptures();
  const [isFetchingCaptures, setIsFetchingCaptures] = useState(false);

  useEffect(() => {
    const fetchCaptures = async () => {
      setIsFetchingCaptures(true);
      await syncCaptures();
      setIsFetchingCaptures(false);
    };
    fetchCaptures();
  }, [syncCaptures]);

  return (
    <div className="page-container-wide">
      <h5>Search</h5>
      {isFetchingCaptures ? (
        <LoadingBlock message="Getting captures..." />
      ) : (
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
      )}
    </div>
  );
};

export default SearchPage;
