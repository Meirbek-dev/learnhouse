import UserRolesClient from './client';
import { Actions, Resources, Scopes } from '@/types/permissions';
import { requirePermission } from '@/lib/server-auth';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'User Roles',
  description: 'Manage role assignments for organization members',
};

export default async function UserRolesPage({ params }: { params: Promise<{ orgslug: string }> }) {
  const { orgslug } = await params;
  await requirePermission(orgslug, Actions.UPDATE, Resources.ROLE, Scopes.ORG);
  return <UserRolesClient />;
}
