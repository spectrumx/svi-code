import _ from 'lodash';
import { createAuthToken } from '../apiClient';

export function formatHertz(freq: number, decimals = 2): string {
  if (freq === 0) return '0 Hz';

  const k = 1000;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Hz', 'KHz', 'MHz', 'GHz'];

  // Handle negative values by taking absolute value for calculation
  const absFreq = Math.abs(freq);
  const i = Math.floor(Math.log(absFreq) / Math.log(k));

  // Calculate the formatted value
  const formattedValue = parseFloat((absFreq / Math.pow(k, i)).toFixed(dm));

  // Apply the original sign
  const sign = freq < 0 ? '-' : '';

  return sign + formattedValue + ' ' + sizes[i];
}

/**
 * Formats a time value in seconds, automatically choosing between seconds and milliseconds
 * based on the value magnitude for better readability.
 *
 * @param timeInSeconds - Time value in seconds
 * @param decimals - Number of decimal places to show (default: 3)
 * @returns Formatted time string with appropriate unit
 */
export function formatTime(timeInSeconds: number, decimals = 3): string {
  if (timeInSeconds === 0) return '0 s';

  // For values less than 0.1 seconds, show in milliseconds
  if (timeInSeconds < 0.1) {
    const milliseconds = timeInSeconds * 1000;
    const dm = decimals < 0 ? 0 : decimals;
    return `${milliseconds.toFixed(dm)} ms`;
  }

  // For values 0.1 seconds and above, show in seconds
  const dm = decimals < 0 ? 0 : decimals;
  return `${timeInSeconds.toFixed(dm)} s`;
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
