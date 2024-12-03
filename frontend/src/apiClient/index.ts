import axios from 'axios';
import { useAppContext } from '../utils/AppContext';
import { useEffect, useRef } from 'react';

export const api_host = process.env.REACT_APP_API_HOST;

export const useFetchSessionInfo = async () => {
  const context = useAppContext();
  // For now, we just want to run this on the first page load
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;

    const fetchSessionInfo = async () => {
      try {
        const response = await fetch(api_host + '/api/session-info', {
          // Important for session-based authentication
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();

          localStorage.setItem('authToken', data.access_token);
          localStorage.setItem('refreshToken', data.refresh_token);
          localStorage.setItem('csrfToken', data.csrf_token);

          const username = data.user.username;
          context?.setUsername(username);

          return;
        }
      } catch (error) {}

      localStorage.removeItem('authToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('csrfToken');
      context?.setUsername(undefined);
    };

    fetchSessionInfo();
    hasRunRef.current = true;
  }, [context]);
};

const apiClient = axios.create({
  baseURL: api_host,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const authToken = localStorage.getItem('authToken');
  const csrfToken = localStorage.getItem('csrfToken');

  if (authToken) {
    config.headers.Authorization = `Bearer ${authToken}`;
  }

  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken;
  }

  return config;
});

export default apiClient;
