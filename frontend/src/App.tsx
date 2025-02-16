import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import Container from 'react-bootstrap/Container';
import Row from 'react-bootstrap/Row';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.min.css';
import { useEffect } from 'react';

import './App.css';
import LandingPage from './pages/LandingPage';
import WorkspacePage from './pages/WorkspacePage';
import MyDataPage from './pages/MyDataPage';
import SpectrogramPage from './pages/SpectrogramPage';
import TokenPage from './pages/TokenPage';
import NewVisualizationPage from './pages/NewVisualizationPage';
import WaterfallPage from './pages/WaterfallPage';
import SearchPage from './pages/SearchPage';
import Header from './components/Header';
import Footer from './components/Footer';
import { useFetchSessionInfo } from './apiClient';

const JupyterRedirect = () => {
  useEffect(() => {
    window.location.replace('http://localhost:8891/notebooks/');
  }, []);

  return <div>Redirecting to Jupyter Notebook...</div>;
};

function App() {
  useFetchSessionInfo();

  return (
    <Container fluid className="min-vh-100 d-flex flex-column">
      <Row className="px-0 vw-100">
        <Header />
      </Row>
      <Row className="flex-grow-1 vw-100">
        <main className="px-0 vw-100">
          <Routes>
            {/* Div elements are placeholders until pages are implemented */}
            <Route path="/" element={<LandingPage />} />
            <Route
              path="dashboard"
              element={<div className="page-container">Dashboard</div>}
            />
            <Route path="workspace" element={<WorkspacePage />} />
            <Route path="mydata" element={<MyDataPage />} />
            <Route path="search" element={<SearchPage />} />
            <Route
              path="tutorials"
              element={<div className="page-container">Tutorials</div>}
            />
            <Route path="/notebooks/*" element={<JupyterRedirect />} />
            <Route
              path="visualization/new"
              element={<NewVisualizationPage />}
            />
            <Route
              path="visualization/spectrogram/:captureId"
              element={<SpectrogramPage />}
            />
            <Route
              // path="visualization/waterfall/:captureId"
              path="visualization/waterfall"
              element={<WaterfallPage />}
            />
            <Route path="token" element={<TokenPage />} />
            <Route
              path="*"
              element={
                <div className="page-container">Uh-oh, page not found!</div>
              }
            />
          </Routes>
        </main>
      </Row>
      <Row className="vw-100">
        <Footer />
      </Row>
    </Container>
  );
}

export default App;
