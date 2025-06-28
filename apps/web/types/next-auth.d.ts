// next-auth.d.ts
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      email: string;
      username: string;
      first_name?: string;
      last_name?: string;
      [key: string]: any;
    };
    roles?: string[];
    tokens?: {
      access_token: string;
      refresh_token: string;
      expiry: number;
    };
    expires: string;
  }

  interface User {
    id: string;
    email: string;
    username: string;
    first_name?: string;
    last_name?: string;
    tokens: {
      access_token: string;
      refresh_token: string;
      expiry: number;
    };
    [key: string]: any;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    user?: {
      id: string;
      email: string;
      username: string;
      first_name?: string;
      last_name?: string;
      tokens: {
        access_token: string;
        refresh_token: string;
        expiry: number;
      };
      [key: string]: any;
    };
  }
}
