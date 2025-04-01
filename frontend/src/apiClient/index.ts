import axios from 'axios';
import { useAppContext } from '../utils/AppContext';
import { useEffect, useRef } from 'react';

export const API_HOST = process.env.REACT_APP_API_HOST;
export const LOGIN_URL = API_HOST + '/users/login-with-redirect/';

export const getLoginUrlWithRedirect = (redirectPath: string): string => {
  const redirectUrl = `${window.location.origin}${redirectPath}`;
  return `${LOGIN_URL}?next=${encodeURIComponent(redirectUrl)}`;
};

export const useFetchSessionInfo = async () => {
  const { setUsername } = useAppContext();
  // For now, we just want to run this on the first page load
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;

    const fetchSessionInfo = async () => {
      try {
        // Undefined means we're attempting to fetch session info
        setUsername(undefined);
        const response = await fetch(API_HOST + '/api/session-info', {
          // Important for session-based authentication
          credentials: 'include',
        });

        if (response.ok) {
          const data = await response.json();

          localStorage.setItem('authToken', data.auth_token);
          localStorage.setItem('csrfToken', data.csrf_token);

          const username = data.user.username;
          setUsername(username);

          return;
        }
      } catch (error) {}

      localStorage.removeItem('authToken');
      localStorage.removeItem('csrfToken');
      // Null means the user isn't logged in
      setUsername(null);
    };

    fetchSessionInfo();
    hasRunRef.current = true;
  }, [setUsername]);
};

const apiClient = axios.create({
  baseURL: API_HOST,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const authToken = localStorage.getItem('authToken');
  const csrfToken = localStorage.getItem('csrfToken');

  if (authToken) {
    config.headers.Authorization = `Token ${authToken}`;
  }

  if (csrfToken) {
    config.headers['X-CSRFToken'] = csrfToken;
  }

  return config;
});

export default apiClient;
