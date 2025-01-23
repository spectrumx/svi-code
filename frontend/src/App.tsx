import { Routes, Route } from 'react-router';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.min.css';
import './App.css';
import WorkspacePage from './pages/WorkspacePage';
import MyDataPage from './pages/MyDataPage';
import SpectrogramPage from './pages/SpectrogramPage';
import TokenPage from './pages/TokenPage';
import NewVisualizationPage from './pages/NewVisualizationPage';
import Header from './components/Header';
import { useFetchSessionInfo } from './apiClient';
import WaterfallPage from './pages/WaterfallPage';

function App() {
  useFetchSessionInfo();

  return (
    <div
    // className="App"
    >
      <Header />
      <div className="content-container">
        <Routes>
          {/* Div elements are placeholders until pages are implemented */}
          <Route path="/" element={<div>Home/Dashboard</div>} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="mydata" element={<MyDataPage />} />
          <Route path="search" element={<div>Search</div>} />
          <Route path="tutorials" element={<div>Tutorials</div>} />
          <Route path="visualization/new" element={<NewVisualizationPage />} />
          <Route
            path="visualize/spectrogram/:datasetId"
            element={<SpectrogramPage />}
          />
          <Route
            path="visualize/waterfall/:datasetId"
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
