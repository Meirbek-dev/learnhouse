// next-auth.d.ts
import 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: any;
    roles?: string[];
    tokens?: {
      access_token?: string;
      refresh_token?: string;
      expiry?: number;
    };
  }

  interface User {
    id?: string;
    email?: string;
    tokens?: {
      access_token?: string;
      refresh_token?: string;
      expiry?: number;
    };
    [key: string]: any;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    user?: {
      id?: string;
      email?: string;
      tokens?: {
        access_token?: string;
        refresh_token?: string;
        expiry?: number;
      };
      [key: string]: any;
    };
  }
}
