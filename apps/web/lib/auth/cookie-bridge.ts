import type { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import {
  ACCESS_TOKEN_COOKIE_NAME,
  AUTH_COOKIE_NAMES,
  REFRESH_TOKEN_COOKIE_NAME,
} from './constants';

interface CookieMutationOptions {
  domain?: string;
  expires?: Date;
  httpOnly?: boolean;
  maxAge?: number;
  path?: string;
  sameSite?: 'lax' | 'none' | 'strict';
  secure?: boolean;
}

interface ParsedSetCookie {
  name: string;
  options: CookieMutationOptions;
  value: string;
}

function splitCombinedSetCookieHeader(value: string): string[] {
  const cookiesList: string[] = [];
  let current = '';
  let inExpiresAttribute = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];
    const nextChunk = value.slice(index, index + 8).toLowerCase();

    if (nextChunk === 'expires=') {
      inExpiresAttribute = true;
    }

    if (character === ',' && !inExpiresAttribute) {
      const trimmed = current.trim();
      if (trimmed) {
        cookiesList.push(trimmed);
      }
      current = '';
      continue;
    }

    current += character;

    if (inExpiresAttribute && character === ';') {
      inExpiresAttribute = false;
    }
  }

  const trailing = current.trim();
  if (trailing) {
    cookiesList.push(trailing);
  }

  return cookiesList;
}

export function getSetCookieHeaders(headers: Headers): string[] {
  if (typeof headers.getSetCookie === 'function') {
    return headers.getSetCookie();
  }

  const combined = headers.get('set-cookie');
  return combined ? splitCombinedSetCookieHeader(combined) : [];
}

function parseSameSite(value: string): CookieMutationOptions['sameSite'] | undefined {
  const normalized = value.toLowerCase();
  if (normalized === 'lax' || normalized === 'none' || normalized === 'strict') {
    return normalized;
  }
  return undefined;
}

function parseSetCookieHeader(setCookieHeader: string): ParsedSetCookie | null {
  const parts = setCookieHeader.split(';').map((part) => part.trim()).filter(Boolean);
  const [nameValue, ...attributes] = parts;

  if (!nameValue) {
    return null;
  }

  const separatorIndex = nameValue.indexOf('=');
  if (separatorIndex <= 0) {
    return null;
  }

  const name = nameValue.slice(0, separatorIndex).trim();
  const value = nameValue.slice(separatorIndex + 1);

  if (!name) {
    return null;
  }

  const options: CookieMutationOptions = {};

  for (const attribute of attributes) {
    const attributeSeparatorIndex = attribute.indexOf('=');
    const rawKey = attributeSeparatorIndex >= 0 ? attribute.slice(0, attributeSeparatorIndex) : attribute;
    const rawValue = attributeSeparatorIndex >= 0 ? attribute.slice(attributeSeparatorIndex + 1) : '';
    const key = rawKey.trim().toLowerCase();
    const optionValue = rawValue.trim();

    if (key === 'domain' && optionValue) {
      options.domain = optionValue;
      continue;
    }

    if (key === 'expires' && optionValue) {
      const expires = new Date(optionValue);
      if (!Number.isNaN(expires.getTime())) {
        options.expires = expires;
      }
      continue;
    }

    if (key === 'httponly') {
      options.httpOnly = true;
      continue;
    }

    if (key === 'max-age' && optionValue) {
      const maxAge = Number.parseInt(optionValue, 10);
      if (!Number.isNaN(maxAge)) {
        options.maxAge = maxAge;
      }
      continue;
    }

    if (key === 'path' && optionValue) {
      options.path = optionValue;
      continue;
    }

    if (key === 'samesite' && optionValue) {
      options.sameSite = parseSameSite(optionValue);
      continue;
    }

    if (key === 'secure') {
      options.secure = true;
    }
  }

  return { name, options, value };
}

export async function applyResponseCookies(responseHeaders: Headers): Promise<void> {
  const cookieStore = await cookies();

  for (const setCookieHeader of getSetCookieHeaders(responseHeaders)) {
    const parsed = parseSetCookieHeader(setCookieHeader);
    if (!parsed) {
      continue;
    }

    cookieStore.set(parsed.name, parsed.value, parsed.options);
  }
}

export function applyResponseCookiesToNextResponse(responseHeaders: Headers, response: NextResponse): void {
  for (const setCookieHeader of getSetCookieHeaders(responseHeaders)) {
    response.headers.append('set-cookie', setCookieHeader);
  }
}

export function buildRequestCookieHeader(request: NextRequest): string {
  return AUTH_COOKIE_NAMES.map((cookieName) => {
    const cookieValue = request.cookies.get(cookieName)?.value;
    return cookieValue ? `${cookieName}=${cookieValue}` : null;
  })
    .filter((value): value is string => value !== null)
    .join('; ');
}

export function buildCookieHeaderFromPairs(cookiePairs: Iterable<[string, string | undefined]>): string {
  const values: string[] = [];

  for (const [cookieName, cookieValue] of cookiePairs) {
    if (cookieValue) {
      values.push(`${cookieName}=${cookieValue}`);
    }
  }

  return values.join('; ');
}

export function clearAuthCookies(response: NextResponse): NextResponse {
  response.cookies.delete(ACCESS_TOKEN_COOKIE_NAME);
  response.cookies.delete({ name: REFRESH_TOKEN_COOKIE_NAME, path: '/api/auth/refresh' });
  return response;
}

function decodeJwtPayloadSegment(segment: string): string | null {
  const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
  const paddingLength = (4 - (normalized.length % 4)) % 4;
  const padded = `${normalized}${'='.repeat(paddingLength)}`;

  try {
    return atob(padded);
  } catch {
    return null;
  }
}

export function getAccessTokenExpiry(accessToken: string | undefined): number | null {
  if (!accessToken) {
    return null;
  }

  const [, payloadSegment] = accessToken.split('.');
  if (!payloadSegment) {
    return null;
  }

  const payloadJson = decodeJwtPayloadSegment(payloadSegment);
  if (!payloadJson) {
    return null;
  }

  try {
    const payload = JSON.parse(payloadJson);
    if (typeof payload !== 'object' || payload === null || !('exp' in payload)) {
      return null;
    }

    const expiry = payload.exp;
    return typeof expiry === 'number' ? expiry * 1000 : null;
  } catch {
    return null;
  }
}

export function isAccessTokenExpired(accessToken: string | undefined, now = Date.now()): boolean {
  const expiry = getAccessTokenExpiry(accessToken);
  if (expiry === null) {
    return !accessToken;
  }

  return expiry <= now;
}
