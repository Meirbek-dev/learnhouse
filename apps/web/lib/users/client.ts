'use client';

import { apiFetch } from '@/lib/api-client';
import { AUTH_SESSION_SWR_KEY } from '@/lib/auth/constants';
import type { CustomResponseTyping } from '@services/utils/ts/requests';
import type { components } from '@/lib/api/generated';
import useSWR from 'swr';
import { mutate } from 'swr';

type UserRead = components['schemas']['UserRead'];
type CourseRead = components['schemas']['CourseRead'];

type ResponseMetadata<T> = Omit<CustomResponseTyping, 'data'> & {
  data: T | null;
};

export const userKeys = {
  byId: (userId: number) => ['user', 'id', userId] as const,
  byUsername: (username: string) => ['user', 'username', username] as const,
  coursesByUser: (userId: number) => ['user', 'courses', userId] as const,
};

async function parseJsonOrNull<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function requireOkJson<T>(response: Response): Promise<T> {
  const data = await parseJsonOrNull<T | { detail?: string }>(response);

  if (!response.ok) {
    const error: Error & { status?: number; data?: unknown } = new Error(
      typeof data === 'object' && data && 'detail' in data && typeof data.detail === 'string'
        ? data.detail
        : response.statusText || 'Request failed',
    );
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data as T;
}

export async function getUserById(userId: number): Promise<UserRead> {
  const response = await apiFetch(`users/id/${userId}`);
  return requireOkJson<UserRead>(response);
}

export async function getUserByUsername(username: string): Promise<UserRead> {
  const response = await apiFetch(`users/username/${encodeURIComponent(username)}`);
  return requireOkJson<UserRead>(response);
}

export async function getCurrentUserProfile(): Promise<UserRead> {
  const response = await apiFetch('users/profile');
  return requireOkJson<UserRead>(response);
}

export async function getCoursesByUser(userId: number): Promise<ResponseMetadata<CourseRead[]>> {
  const response = await apiFetch(`users/${userId}/courses`);
  const data = await parseJsonOrNull<CourseRead[]>(response);

  return {
    success: response.status === 200,
    data,
    status: response.status,
    HTTPmessage: response.statusText,
  };
}

export async function updateUserAvatar(userId: number, avatarFile: File): Promise<ResponseMetadata<UserRead>> {
  const formData = new FormData();
  formData.append('avatar_file', avatarFile);

  const response = await apiFetch(`users/update_avatar/${userId}`, {
    method: 'PUT',
    body: formData,
  });
  const data = await parseJsonOrNull<UserRead>(response);

  if (response.ok) {
    await Promise.all([mutate(userKeys.byId(userId)), mutate(AUTH_SESSION_SWR_KEY)]);
  }

  return {
    success: response.status === 200,
    data,
    status: response.status,
    HTTPmessage: response.statusText,
  };
}

export async function updateUserLocale(userId: number, locale: string): Promise<UserRead> {
  const response = await apiFetch(`users/preferences/locale/${userId}?locale=${encodeURIComponent(locale)}`, {
    method: 'PUT',
  });
  const data = await requireOkJson<UserRead>(response);

  await Promise.all([mutate(userKeys.byId(userId)), mutate(AUTH_SESSION_SWR_KEY)]);

  return data;
}

export async function updateProfile(data: unknown, userId: number): Promise<ResponseMetadata<UserRead>> {
  const response = await apiFetch(`users/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const payload = await parseJsonOrNull<UserRead>(response);

  if (response.ok) {
    await Promise.all([mutate(userKeys.byId(userId)), mutate(AUTH_SESSION_SWR_KEY)]);
  }

  return {
    success: response.status === 200,
    data: payload,
    status: response.status,
    HTTPmessage: response.statusText,
  };
}

export async function updatePassword(userId: number, data: unknown): Promise<ResponseMetadata<unknown>> {
  const response = await apiFetch(`users/change_password/${userId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  const payload = await parseJsonOrNull<unknown>(response);

  if (response.ok) {
    await mutate(AUTH_SESSION_SWR_KEY);
  }

  return {
    success: response.status === 200,
    data: payload,
    status: response.status,
    HTTPmessage: response.statusText,
  };
}

export function useUserById(userId?: number | null, options?: { enabled?: boolean }) {
  const enabled = Boolean(userId) && (options?.enabled ?? true);

  return useSWR<UserRead>(enabled && userId ? userKeys.byId(userId) : null, () => getUserById(userId!), {
    revalidateOnFocus: false,
  });
}

export function useUserByUsername(username?: string | null, options?: { enabled?: boolean }) {
  const normalizedUsername = username?.trim() ?? '';
  const enabled = normalizedUsername.length > 0 && (options?.enabled ?? true);

  return useSWR<UserRead>(
    enabled ? userKeys.byUsername(normalizedUsername) : null,
    () => getUserByUsername(normalizedUsername),
    {
      revalidateOnFocus: false,
    },
  );
}
