import UserRolesClient from './client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'User Roles',
  description: 'Manage role assignments for organization members',
};

export default function UserRolesPage() {
  return <UserRolesClient />;
}
