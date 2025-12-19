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

  function isUserAllowed(roles: any[], action: string, resourceType: string, org_uuid: string): boolean {
    // Iterate over the user's roles
    for (const role of roles) {
      // Check if the role is for the right organization
      if (
        role.org.org_uuid === org_uuid && // Check if the user has the role for the resource type
        role.role.rights?.[resourceType]
      ) {
        // Check if the user is allowed to execute the action
        const actionKey = `action_${action}`;
        if (role.role.rights[resourceType][actionKey] === true) {
          return true;
        }
      }
    }

    // If no role matches the organization, resource type, and action, return false
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
        return isUserAllowed(session.data.roles, props.action, props.ressourceType, org?.org_uuid);
      }
      return false;
    }

    return false;
  })();

  return <>{isAllowed ? props.children : null}</>;
};

export default AuthenticatedClientElement;
