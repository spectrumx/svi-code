import 'bootstrap/dist/css/bootstrap.min.css';
import './App.css';
import WorkspacePage from './pages/WorkspacePage';
import Header from './components/Header';

export const api_host = 'http://localhost:8000';

function App() {
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
