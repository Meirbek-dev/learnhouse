import { create } from 'zustand';
import type { ClientSession } from './types';

type SessionStatus = 'loading' | 'authenticated' | 'unauthenticated';

interface SessionStore {
  data: ClientSession | null;
  status: SessionStatus;
  setSession: (session: ClientSession | null) => void;
  setLoading: () => void;
}

/**
 * Global Zustand store for session state. Readable outside the React tree
 * (e.g. API interceptors) via `useSessionStore.getState()`.
 *
 * Mutations happen only through SessionProvider effects and auth actions.
 * Components should read via `useSession()` or `useCurrentUser()`.
 */
export const useSessionStore = create<SessionStore>((set) => ({
  data: null,
  status: 'loading',
  setSession: (session) =>
    set({ data: session, status: session?.user ? 'authenticated' : 'unauthenticated' }),
  setLoading: () => set({ status: 'loading' }),
}));
