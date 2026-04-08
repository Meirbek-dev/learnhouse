import { getAPIUrl } from '@services/config/config';
import { notifyAuthInvalidation } from '@/lib/auth/client';
import type { components } from '@/lib/api/generated';

type AuthUser = components['schemas']['UserRead'];

interface NewAccountBody {
  username: string;
  email: string;
  password: string;
  first_name?: string;
  last_name?: string;
}

interface LogoutOptions {
  redirectTo?: string;
}

const AUTH_ENDPOINTS = {
  login: 'auth/login',
  googleAuthorize: 'auth/google/authorize',
  logout: 'auth/logout',
  logoutAll: 'auth/logout-all',
  forgotPassword: 'auth/forgot-password',
  resetPassword: 'auth/reset-password',
  signup: 'users',
} as const;

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

export async function logout(options?: LogoutOptions): Promise<Response> {
  const response = await fetch(`${getAPIUrl()}${AUTH_ENDPOINTS.logout}`, {
    method: 'POST',
    credentials: 'include',
  });

  if (response.ok) {
    notifyAuthInvalidation({
      reason: 'logged_out',
      redirectTo: options?.redirectTo ?? null,
    });
  }

  return response;
}

export async function logoutAll(options?: LogoutOptions): Promise<Response> {
  const response = await fetch(`${getAPIUrl()}${AUTH_ENDPOINTS.logoutAll}`, {
    method: 'POST',
    credentials: 'include',
  });

  if (response.ok) {
    notifyAuthInvalidation({
      reason: 'logged_out',
      redirectTo: options?.redirectTo ?? null,
    });
  }

  return response;
}

export async function sendResetLink(email: string): Promise<Response> {
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

export type { AuthUser, NewAccountBody };
export { AUTH_ENDPOINTS };
