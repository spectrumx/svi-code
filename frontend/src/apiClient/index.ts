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

          // Only store auth token if it exists (don't create unnecessary tokens)
          if (data.auth_token) {
            localStorage.setItem('authToken', data.auth_token);
          } else {
            localStorage.removeItem('authToken');
          }

          const username = data.user.username;
          setUsername(username);

          return;
        }
      } catch (error) {}

      localStorage.removeItem('authToken');
      // Null means the user isn't logged in
      setUsername(null);
    };

    fetchSessionInfo();
    hasRunRef.current = true;
  }, [setUsername]);
};

/**
 * Create an authentication token for API access.
 * This should be called when the user needs to access protected API endpoints.
 */
export const createAuthToken = async (): Promise<string | null> => {
  try {
    const response = await fetch(API_HOST + '/api/create-auth-token/', {
      method: 'POST',
      credentials: 'include',
    });

    if (response.ok) {
      const data = await response.json();
      localStorage.setItem('authToken', data.auth_token);
      return data.auth_token;
    }
  } catch (error) {
    console.error('Failed to create auth token:', error);
  }
  return null;
};

const apiClient = axios.create({
  baseURL: API_HOST,
  headers: { 'Content-Type': 'application/json' },
});

apiClient.interceptors.request.use((config) => {
  const authToken = localStorage.getItem('authToken');

  if (authToken) {
    config.headers.Authorization = `Token ${authToken}`;
  }

  // CSRF tokens are automatically handled by Django's middleware via HTTP-only cookies
  // No need to manually set X-CSRFToken header

  return config;
});

export default apiClient;
