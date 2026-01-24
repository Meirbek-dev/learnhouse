import RBACAdminClient from './client';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Access Control',
  description: 'Manage roles and permissions for your organization',
};

export default function RBACAdminPage() {
  return <RBACAdminClient />;
}
