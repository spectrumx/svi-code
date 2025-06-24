import _ from 'lodash';
import { createAuthToken } from '../apiClient';

export function formatHertz(freq: number, decimals = 2) {
  if (freq === 0) return 'MHz';

  const k = 1000;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Hz', 'KHz', 'MHz', 'GHz'];

  const i = Math.floor(Math.log(freq) / Math.log(k));

  return parseFloat((freq / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

export function sortByDate(a: any, b: any, dateField: string) {
  const dateA = new Date(_.get(a, dateField));
  const dateB = new Date(_.get(b, dateField));
  return dateB.getTime() - dateA.getTime();
}

/**
 * Check if the user has a valid authentication token
 */
export const hasValidAuthToken = (): boolean => {
  const token = localStorage.getItem('authToken');
  return token !== null && token.trim() !== '';
};

/**
 * Get the current authentication token
 */
export const getAuthToken = (): string | null => {
  return localStorage.getItem('authToken');
};

/**
 * Remove the authentication token
 */
export const removeAuthToken = (): void => {
  localStorage.removeItem('authToken');
};

/**
 * Ensure the user has an authentication token, creating one if necessary
 */
export const ensureAuthToken = async (): Promise<string | null> => {
  if (hasValidAuthToken()) {
    return getAuthToken();
  }

  // Try to create a new token
  return await createAuthToken();
};

/**
 * Clear all authentication data
 */
export const clearAuthData = (): void => {
  removeAuthToken();
  // Note: CSRF tokens are handled by Django's HTTP-only cookies
  // No need to manually clear them
};
