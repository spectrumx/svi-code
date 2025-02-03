import { Routes, Route } from 'react-router';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.min.css';

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
import { useFetchSessionInfo } from './apiClient';

function App() {
  useFetchSessionInfo();

  return (
    <div>
      <Header />
      <div className="content-container">
        <Routes>
          {/* Div elements are placeholders until pages are implemented */}
          <Route path="/" element={<LandingPage />} />
          <Route path="dashboard" element={<div>Dashboard</div>} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="mydata" element={<MyDataPage />} />
          <Route path="search" element={<SearchPage />} />
          <Route path="tutorials" element={<div>Tutorials</div>} />
          <Route path="visualization/new" element={<NewVisualizationPage />} />
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
          <Route path="*" element={<div>Uh-oh, page not found!</div>} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
