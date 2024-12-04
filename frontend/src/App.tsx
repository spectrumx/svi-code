import { Routes, Route } from 'react-router';
import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import WorkspacePage from './pages/WorkspacePage';
import TokenPage from './pages/token';
import Header from './components/Header';
import { useFetchSessionInfo } from './apiClient';

function App() {
  useFetchSessionInfo();

  return (
    <div
    // className="App"
    >
      <Header />
      <div style={{ padding: 20 }}>
        <Routes>
          {/* Div elements are placeholders until pages are implemented */}
          <Route path="/" element={<div>Home/Dashboard</div>} />
          <Route path="workspace" element={<WorkspacePage />} />
          <Route path="mydata" element={<div>My Data</div>} />
          <Route path="search" element={<div>Search</div>} />
          <Route path="tutorials" element={<div>Tutorials</div>} />
          <Route path="token" element={<TokenPage />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
