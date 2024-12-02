import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import WorkspacePage from './pages/WorkspacePage';
import Header from './components/Header';
import { useFetchSessionInfo } from './apiClient';

function App() {
  useFetchSessionInfo();

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
