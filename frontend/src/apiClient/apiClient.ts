import axios from 'axios';
import { useAppContext } from '../utils/AppContext';
import { useEffect } from 'react';

export const api_host = 'http://localhost:8000';

export const useFetchTokenAndUserInfo = async () => {
  const context = useAppContext();

  useEffect(() => {
    const fetchTokenAndUserInfo = async () => {
      const response = await fetch(api_host + '/api/get-token-and-user-info', {
        // Important for session-based authentication
        credentials: 'include',
      });
      const data = await response.json();

      if (data.access_token) {
        localStorage.setItem('authToken', data.access_token);
        const username = data.user.username;
        context?.setUsername(username);
        console.log('Authentication successful.');
      } else {
        localStorage.removeItem('authToken');
        console.log('Authentication failed.');
      }
    };

    fetchTokenAndUserInfo();
  }, []);
};

const apiClient = axios.create({
  baseURL: api_host,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('authToken');
  console.log('Token:', token);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;
