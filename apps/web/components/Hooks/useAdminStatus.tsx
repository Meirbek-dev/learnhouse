import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { Actions, ResourceTypes } from '@/types/permissions';
import { useOrg } from '@components/Contexts/OrgContext';
import { usePermission } from '@/hooks/usePermission';
import type { Session } from 'next-auth';

interface Role {
  org: { id: number; org_uuid: string };
  role: {
    id: number;
    role_uuid: string;
    rights?: Record<string, Record<string, boolean>>;
  };
}

interface Rights {
  courses: {
    action_create: boolean;
    action_read: boolean;
    action_read_own: boolean;
    action_update: boolean;
    action_update_own: boolean;
    action_delete: boolean;
    action_delete_own: boolean;
  };
  users: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  usergroups: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  collections: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  organizations: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  coursechapters: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  activities: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  roles: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  dashboard: {
    action_access: boolean;
  };
}

interface UseAdminStatusReturn {
  isAdmin: boolean;
  loading: boolean;
  userRoles: Role[];
  rights: Rights | null;
}

// Type guard to check if session data has roles
function hasRoles(sessionData: Session | null): sessionData is Session & {
  roles: Role[];
} {
  return (
    sessionData !== null &&
    typeof sessionData === 'object' &&
    'roles' in sessionData &&
    Array.isArray((sessionData as any).roles)
  );
}

/**
 * Hook that provides admin status and permission checks.
 *
 * This hook has been updated to use the new RBAC permission system
 * while maintaining backward compatibility with the old rights structure.
 */
function useAdminStatus(): UseAdminStatusReturn {
  const session = usePlatformSession();
  const org = useOrg();
  const { can, isAdmin: permissionIsAdmin, isLoading: permissionLoading } = usePermission();

  const userRoles: Role[] = hasRoles(session.data) ? session.data.roles : [];

  // Build rights from new permission system
  const rights: Rights = {
    courses: {
      action_create: can(Actions.CREATE, ResourceTypes.COURSE),
      action_read: can(Actions.READ, ResourceTypes.COURSE),
      action_read_own: can(Actions.READ, ResourceTypes.COURSE),
      action_update: can(Actions.UPDATE, ResourceTypes.COURSE),
      action_update_own: can(Actions.UPDATE, ResourceTypes.COURSE),
      action_delete: can(Actions.DELETE, ResourceTypes.COURSE),
      action_delete_own: can(Actions.DELETE, ResourceTypes.COURSE),
    },
    users: {
      action_create: can(Actions.CREATE, ResourceTypes.USER),
      action_read: can(Actions.READ, ResourceTypes.USER),
      action_update: can(Actions.UPDATE, ResourceTypes.USER),
      action_delete: can(Actions.DELETE, ResourceTypes.USER),
    },
    usergroups: {
      action_create: can(Actions.CREATE, ResourceTypes.USERGROUP),
      action_read: can(Actions.READ, ResourceTypes.USERGROUP),
      action_update: can(Actions.UPDATE, ResourceTypes.USERGROUP),
      action_delete: can(Actions.DELETE, ResourceTypes.USERGROUP),
    },
    collections: {
      action_create: can(Actions.CREATE, ResourceTypes.COLLECTION),
      action_read: can(Actions.READ, ResourceTypes.COLLECTION),
      action_update: can(Actions.UPDATE, ResourceTypes.COLLECTION),
      action_delete: can(Actions.DELETE, ResourceTypes.COLLECTION),
    },
    organizations: {
      action_create: can(Actions.CREATE, ResourceTypes.ORGANIZATION),
      action_read: can(Actions.READ, ResourceTypes.ORGANIZATION),
      action_update: can(Actions.UPDATE, ResourceTypes.ORGANIZATION),
      action_delete: can(Actions.DELETE, ResourceTypes.ORGANIZATION),
    },
    coursechapters: {
      action_create: can(Actions.CREATE, ResourceTypes.CHAPTER),
      action_read: can(Actions.READ, ResourceTypes.CHAPTER),
      action_update: can(Actions.UPDATE, ResourceTypes.CHAPTER),
      action_delete: can(Actions.DELETE, ResourceTypes.CHAPTER),
    },
    activities: {
      action_create: can(Actions.CREATE, ResourceTypes.ACTIVITY),
      action_read: can(Actions.READ, ResourceTypes.ACTIVITY),
      action_update: can(Actions.UPDATE, ResourceTypes.ACTIVITY),
      action_delete: can(Actions.DELETE, ResourceTypes.ACTIVITY),
    },
    roles: {
      action_create: can(Actions.CREATE, ResourceTypes.ROLE),
      action_read: can(Actions.READ, ResourceTypes.ROLE),
      action_update: can(Actions.UPDATE, ResourceTypes.ROLE),
      action_delete: can(Actions.DELETE, ResourceTypes.ROLE),
    },
    dashboard: {
      // Access if user has any of these permissions
      action_access:
        can(Actions.MANAGE, ResourceTypes.ORGANIZATION) ||
        can(Actions.CREATE, ResourceTypes.COURSE) ||
        permissionIsAdmin,
    },
  };

  // Use permission-based admin check, with fallback to legacy role check
  const isAdmin = permissionIsAdmin || rights.dashboard.action_access;
  const loading = session.status === 'loading' || permissionLoading;

  return { isAdmin, loading, userRoles, rights };
}

export default useAdminStatus;
