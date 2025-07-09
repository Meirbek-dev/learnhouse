import { getAPIUrl } from '@services/config/config';
import { getResponseMetadata, RequestBody } from '@services/utils/ts/requests';

// ⚠️ mvp phase code
// TODO : everything in this file need to be refactored including security issues fix

export async function loginAndGetToken(username: any, password: any): Promise<any> {
  // Request Config

  // get origin
  const HeadersConfig = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
  });
  const urlencoded = new URLSearchParams({
    username,
    password,
  });

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: HeadersConfig,
    body: urlencoded,
    redirect: 'follow',
    credentials: 'include',
  };

  return await fetch(`${getAPIUrl()}auth/login`, requestOptions);
}

export async function loginWithOAuthToken(email: string, provider: string, accessToken: string): Promise<Response> {
  const HeadersConfig = new Headers({
    'Content-Type': 'application/json',
  });

  const body = {
    email,
    provider,
    access_token: accessToken,
  };

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: HeadersConfig,
    body: JSON.stringify(body),
    redirect: 'follow',
    credentials: 'include',
  };

  return await fetch(`${getAPIUrl()}auth/oauth`, requestOptions);
}

export async function sendResetLink(email: string, org_id: number) {
  const result = await fetch(
    `${getAPIUrl()}users/reset_password/send_reset_code/${email}?org_id=${org_id}`,
    RequestBody('POST', null, null),
  );
  const res = await getResponseMetadata(result);
  return res;
}

export async function resetPassword(email: string, new_password: string, org_id: number, reset_code: string) {
  const result = await fetch(
    `${getAPIUrl()}users/reset_password/change_password/${email}?reset_code=${reset_code}&new_password=${new_password}&org_id=${org_id}`,
    RequestBody('POST', null, null),
  );
  const res = await getResponseMetadata(result);
  return res;
}

export async function logout(): Promise<Response> {
  const HeadersConfig = new Headers({
    'Content-Type': 'application/x-www-form-urlencoded',
  });

  const urlencoded = new URLSearchParams();

  const requestOptions: RequestInit = {
    method: 'DELETE',
    headers: HeadersConfig,
    body: urlencoded,
    redirect: 'follow',
    credentials: 'include',
  };

  return await fetch(`${getAPIUrl()}auth/logout`, requestOptions);
}

export async function getUserInfo(token: string): Promise<any> {
  if (typeof window === 'undefined') {
    throw new Error('getUserInfo can only be called on the client side');
  }

  const { origin } = window.location;
  const HeadersConfig = new Headers({
    Authorization: `Bearer ${token}`,
    Origin: origin,
  });

  const requestOptions: RequestInit = {
    method: 'GET',
    headers: HeadersConfig,
    redirect: 'follow',
    credentials: 'include',
  };

  try {
    const response = await fetch(`${getAPIUrl()}users/profile`, requestOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user info:', error);
    throw error;
  }
}

export async function getUserSession(token: string): Promise<any> {
  if (!token) {
    throw new Error('Access token is required');
  }

  const HeadersConfig = new Headers({
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
  });

  const requestOptions: RequestInit = {
    method: 'GET',
    headers: HeadersConfig,
    redirect: 'follow',
    credentials: 'include',
    cache: 'no-cache',
  };

  try {
    const response = await fetch(`${getAPIUrl()}users/session`, requestOptions);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Failed to fetch user session:', error);
    throw error;
  }
}

export async function getNewAccessTokenUsingRefreshToken(): Promise<any> {
  const requestOptions: RequestInit = {
    method: 'GET',
    redirect: 'follow',
    credentials: 'include',
  };

  try {
    const response = await fetch(`${getAPIUrl()}auth/refresh`, requestOptions);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Failed to refresh token:', error);
    throw error;
  }
}

export async function getNewAccessTokenUsingRefreshTokenServer(refresh_token: string): Promise<any> {
  if (!refresh_token) {
    throw new Error('Refresh token is required');
  }

  const requestOptions: RequestInit = {
    method: 'GET',
    redirect: 'follow',
    headers: {
      'Cookie': `refresh_token_cookie=${refresh_token}`,
      'Content-Type': 'application/json',
    },
    credentials: 'include',
    cache: 'no-cache',
  };

  try {
    const response = await fetch(`${getAPIUrl()}auth/refresh`, requestOptions);

    if (!response.ok) {
      throw new Error(`Failed to refresh token: ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    console.error('Token refresh failed:', error);
    throw error;
  }
}

// cookies
export async function getAccessTokenFromRefreshTokenCookie(cookieStore: any) {
  try {
    const refresh_token_cookie: any = cookieStore.get('refresh_token_cookie');
    if (!refresh_token_cookie?.value) {
      return null;
    }

    const access_token_cookie: any = await getNewAccessTokenUsingRefreshTokenServer(refresh_token_cookie.value);
    return access_token_cookie?.access_token || null;
  } catch (error) {
    console.error('Failed to get access token from refresh token cookie:', error);
    return null;
  }
}

// signup

interface NewAccountBody {
  username: string;
  email: string;
  password: string;
  org_slug: string;
  org_id: number;
}

export async function signup(body: NewAccountBody): Promise<Response> {
  const HeadersConfig = new Headers({ 'Content-Type': 'application/json' });

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: HeadersConfig,
    body: JSON.stringify(body),
    redirect: 'follow',
  };

  return await fetch(`${getAPIUrl()}users/${body.org_id}`, requestOptions);
}

export async function signUpWithInviteCode(body: NewAccountBody, invite_code: string): Promise<Response> {
  const HeadersConfig = new Headers({ 'Content-Type': 'application/json' });

  const requestOptions: RequestInit = {
    method: 'POST',
    headers: HeadersConfig,
    body: JSON.stringify(body),
    redirect: 'follow',
  };

  return await fetch(`${getAPIUrl()}users/${body.org_id}/invite/${invite_code}`, requestOptions);
}
