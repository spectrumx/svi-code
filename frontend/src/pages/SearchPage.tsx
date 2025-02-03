import { useEffect } from 'react';
import { Form } from 'react-bootstrap';

import CaptureTable from '../components/CaptureTable';
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
    <div className="content-container">
      <div
        style={{
          padding: '10px',
          textAlign: 'center',
          backgroundColor: '#ffffff',
        }}
      >
        <h5>Search</h5>
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
            <Form>
              <Form.Group className="mb-3">
                <Form.Check
                  type="checkbox"
                  id="filter-frequency"
                  label="Frequency"
                  aria-label="Frequency filter checkbox"
                />
                <Form.Check
                  type="checkbox"
                  id="filter-category-2"
                  label="Category 2"
                  aria-label="Category 2 filter checkbox"
                />
                <Form.Check
                  type="checkbox"
                  id="filter-category-3"
                  label="Category 3"
                  aria-label="Category 3 filter checkbox"
                />
              </Form.Group>
            </Form>
          </div>
          <div></div>
          <CaptureTable captures={captures} />
        </div>
      </div>
    </div>
  );
};

export default SearchPage;
