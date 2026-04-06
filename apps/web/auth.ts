import { getSession } from '@/lib/auth/session';

export { getSession, requireSession, toClientSession } from '@/lib/auth/session';
export { requireAnyPermission, requirePermission, sessionCan } from '@/lib/auth/permissions';

export async function auth() {
  return getSession();
}
