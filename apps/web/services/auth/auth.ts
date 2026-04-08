import { getAPIUrl } from '@services/config/config';
import { emitAuthInvalidation } from '@/lib/auth/client';
import { apiFetch } from '@/lib/api-client';
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

/**
 * Login uses raw fetch() intentionally — this is a pre-auth call where
 * apiFetch()'s 401→refresh→retry would interfere.
 */
export async function loginAndGetToken(email: string, password: string): Promise<Response> {
  const trimmed = email.trim().toLowerCase();
  return fetch(`${getAPIUrl()}auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: trimmed, password }),
    credentials: 'include',
  });
}

export async function getGoogleAuthorizeUrl(frontendCallback: string): Promise<string> {
  const url = new URL(`${getAPIUrl()}auth/google/authorize`);
  url.searchParams.set('callback', frontendCallback);
  return url.toString();
}

export async function logout(options?: LogoutOptions): Promise<Response> {
  const response = await apiFetch('auth/logout', { method: 'POST' });

  if (response.ok) {
    emitAuthInvalidation({ reason: 'logged_out', redirectTo: options?.redirectTo ?? null }, { local: true });
  }

  return response;
}

export async function logoutAll(options?: LogoutOptions): Promise<Response> {
  const response = await apiFetch('auth/logout-all', { method: 'POST' });

  if (response.ok) {
    emitAuthInvalidation({ reason: 'logged_out', redirectTo: options?.redirectTo ?? null }, { local: true });
  }

  return response;
}

export async function sendResetLink(email: string): Promise<Response> {
  return apiFetch('auth/forgot-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim().toLowerCase() }),
  });
}

export async function resetPassword(token: string, newPassword: string): Promise<Response> {
  return apiFetch('auth/reset-password', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, new_password: newPassword }),
  });
}

export async function signup(body: NewAccountBody): Promise<Response> {
  return apiFetch('users', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

export type { AuthUser, NewAccountBody };
