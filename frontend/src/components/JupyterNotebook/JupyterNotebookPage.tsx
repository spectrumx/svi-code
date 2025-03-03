import React from 'react';

const JupyterNotebookPage: React.FC = () => {
  return (
    <div className="page-container">
      <div className="d-flex flex-column h-100">
        <div
          className="flex-grow-1 position-relative"
          style={{
            margin: '-20px',
          }}
        >
          <iframe
            src="http://localhost:8080/notebooks"
            style={{
              width: '100%',
              height: 'calc(100vh - 120px)',
              border: 'none',
              borderRadius: '4px',
              backgroundColor: 'white',
            }}
            title="Jupyter Notebook"
          />
        </div>
      </div>
    </div>
  );
};

export default JupyterNotebookPage;
