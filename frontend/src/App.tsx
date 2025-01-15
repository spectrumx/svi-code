import { Routes, Route } from 'react-router';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import WorkspacePage from './pages/WorkspacePage';
import SpectrogramPage from './pages/SpectrogramPage';
import TokenPage from './pages/TokenPage';
import Header from './components/Header';
import { useFetchSessionInfo } from './apiClient';
import SearchPage from './pages/SearchPage';

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
          <Route path="mydata" element={<div>My Data</div>} />
          <Route path="search" element={<SearchPage />} />
          <Route path="tutorials" element={<div>Tutorials</div>} />
          <Route path="visualize/:datasetId" element={<SpectrogramPage />} />
          <Route path="token" element={<TokenPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
