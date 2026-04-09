export const ACCESS_TOKEN_COOKIE_NAME = 'access_token_cookie';
export const REFRESH_TOKEN_COOKIE_NAME = 'refresh_token_cookie';

export const AUTH_COOKIE_NAMES = [ACCESS_TOKEN_COOKIE_NAME, REFRESH_TOKEN_COOKIE_NAME] as const;

export const AUTH_REFRESH_BRIDGE_PATH = '/api/auth/refresh';
