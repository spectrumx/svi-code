import { useState, useEffect } from 'react';
import apiClient from '../../apiClient';

interface TokenResponse {
  token: string;
}

export default function ProfilePage() {
  const [apiToken, setApiToken] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [testSuccess, setTestSuccess] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);

  // Fetch the current token on page load
  useEffect(() => {
    fetchToken();
  }, []);

  const fetchToken = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get('/api/api-token/');
      console.log(response.data);
      setApiToken(response.data.api_token);
    } catch (err) {
      setError('Failed to fetch API token');
    } finally {
      setLoading(false);
    }
  };

  const updateToken = async (newToken: string) => {
    try {
      setLoading(true);
      setError(null);
      await apiClient.post('/api/api-token/', { api_token: newToken });
      setApiToken(newToken);
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError('Failed to update API token');
    } finally {
      setLoading(false);
    }
  };

  const testConnection = async () => {
    try {
      setTestingConnection(true);
      setError(null);
      await apiClient.get('/api/test-sdk-connection/');
      setTestSuccess(true);
      setTimeout(() => setTestSuccess(false), 3000);
    } catch (err) {
      setError('Failed to connect to the SDK (likely an invalid token)');
    } finally {
      setTestingConnection(false);
    }
  };

  return (
    <>
      <h5>API Token Management</h5>
      <div className="mt-4">
        <div className="form-group">
          <label htmlFor="apiToken">API Token</label>
          <input
            type="text"
            id="apiToken"
            className="form-control"
            value={apiToken}
            onChange={(e) => setApiToken(e.target.value)}
            placeholder="Enter your API token"
          />
        </div>
        <div className="mt-3">
          <button
            className="btn btn-primary"
            onClick={() => updateToken(apiToken)}
            disabled={loading}
          >
            {loading ? 'Saving...' : 'Save Token'}
          </button>
          <button
            className="btn btn-secondary ms-2"
            onClick={testConnection}
            disabled={testingConnection || !apiToken}
          >
            {testingConnection ? 'Testing...' : 'Test Connection'}
          </button>
        </div>
        {error && <div className="alert alert-danger mt-3">{error}</div>}
        {success && <div className="alert alert-success mt-3">Token saved</div>}
        {testSuccess && (
          <div className="alert alert-success mt-3">Connection successful</div>
        )}
      </div>
    </>
  );
}
