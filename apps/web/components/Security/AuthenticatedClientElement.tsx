'use client';

import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import type { ReactNode } from 'react';

interface AuthenticatedClientElementProps {
  children: ReactNode;
  checkMethod: 'authentication' | 'roles';
  orgId?: number;
  ressourceType?: 'collections' | 'courses' | 'activities' | 'users' | 'organizations';
  action?: 'create' | 'update' | 'delete' | 'read';
}

export const AuthenticatedClientElement = (props: AuthenticatedClientElementProps) => {
  const session = usePlatformSession() as any;
  const org = useOrg() as any;

  function isUserAllowed(
    permissions: Record<string, boolean> | undefined,
    roles: any[],
    action: string,
    resourceType: string,
    org_uuid: string,
  ): boolean {
    // First, check new RBAC permission system
    if (permissions) {
      // Check permission patterns: "resource:action" or "resource:action:org"
      const permKey = `${resourceType}:${action}`;
      if (permissions[permKey] === true) {
        return true;
      }
      // Check org-specific permission
      const permKeyOrg = `${resourceType}:${action}:org`;
      if (permissions[permKeyOrg] === true) {
        return true;
      }
    }

    // Fallback: check if user has admin or maintainer role for the org
    for (const role of roles) {
      if (role.org?.org_uuid === org_uuid) {
        const roleName = role.role?.name?.toLowerCase() || '';
        if (roleName.includes('admin') || roleName.includes('maintainer')) {
          return true;
        }
      }
    }

    return false;
  }

  // Compute authorization result as derived state
  const isAllowed = (() => {
    if (session.status === 'loading' || session.status === 'unauthenticated') {
      return false;
    }

    if (props.checkMethod === 'authentication') {
      return session.status === 'authenticated';
    }

    if (props.checkMethod === 'roles') {
      if (props.action && props.ressourceType && session?.data?.roles) {
        return isUserAllowed(
          session?.data?.permissions,
          session.data.roles,
          props.action,
          props.ressourceType,
          org?.org_uuid,
        );
      }
      return false;
    }

    return false;
  })();

  return <>{isAllowed ? props.children : null}</>;
};

export default AuthenticatedClientElement;
