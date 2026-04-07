import { getAPIUrl } from '@services/config/config';
import type { components } from '@/lib/api/generated';

type AuthUser = components['schemas']['UserRead'];

interface NewAccountBody {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

const AUTH_ENDPOINTS = {
  login: 'auth/login',
  googleAuthorize: 'auth/google/authorize',
  logout: 'auth/logout',
  logoutAll: 'auth/logout-all',
  refresh: 'auth/refresh',
  forgotPassword: 'auth/forgot-password',
  resetPassword: 'auth/reset-password',
  signup: 'users',
} as const;

const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

export async function loginAndGetToken(email: string, password: string): Promise<Response> {
  const trimmed = email.trim().toLowerCase();
  return fetch(`${getAPIUrl()}${AUTH_ENDPOINTS.login}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: trimmed, password }),
    credentials: 'include',
  });
}

export async function getGoogleAuthorizeUrl(frontendCallback: string): Promise<string> {
  const url = new URL(`${getAPIUrl()}${AUTH_ENDPOINTS.googleAuthorize}`);
  url.searchParams.set('callback', frontendCallback);
  return url.toString();
}

export async function logout(): Promise<Response> {
  return fetch(`${getAPIUrl()}${AUTH_ENDPOINTS.logout}`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function logoutAll(): Promise<Response> {
  return fetch(`${getAPIUrl()}${AUTH_ENDPOINTS.logoutAll}`, {
    method: 'POST',
    credentials: 'include',
  });
}

export async function sendResetLink(email: string): Promise<Response> {
  if (!validateEmail(email)) throw new Error('Valid email is required');
  return fetch(`${getAPIUrl()}${AUTH_ENDPOINTS.forgotPassword}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<Response> {
  return fetch(`${getAPIUrl()}${AUTH_ENDPOINTS.resetPassword}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export async function signup(body: NewAccountBody): Promise<Response> {
  return fetch(`${getAPIUrl()}${AUTH_ENDPOINTS.signup}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

/**
 * Attempt to refresh the access token using the refresh token cookie.
 * Returns true if successful, false if the session has expired and the user
 * must log in again.
 */
export async function refreshToken(): Promise<boolean> {
  try {
    const res = await fetch(`${getAPIUrl()}${AUTH_ENDPOINTS.refresh}`, {
      method: 'POST',
      credentials: 'include',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export type { AuthUser, NewAccountBody };
export { AUTH_ENDPOINTS };
