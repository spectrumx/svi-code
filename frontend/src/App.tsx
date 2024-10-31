import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import WorkspacePage from './pages/WorkspacePage';
import Header from './components/Header';
import { useFetchTokenAndUserInfo } from './apiClient/apiClient';
import { useEffect } from 'react';

function App() {
  useFetchTokenAndUserInfo();

  return (
    <div
    // className="App"
    >
      <Header />
      <WorkspacePage />
    </div>
  );
}

export default App;
