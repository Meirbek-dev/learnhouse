import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
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

// Type guard to check if org has id
function hasOrgId(org: any): org is { id: number } {
  return org !== null && typeof org === 'object' && 'id' in org && typeof org.id === 'number';
}

function useAdminStatus(): UseAdminStatusReturn {
  const session = usePlatformSession();
  const org = useOrg();

  const userRoles: Role[] = hasRoles(session.data) ? session.data.roles : [];

  let rights: Rights | null = null;
  if (session.status === 'authenticated' && hasOrgId(org) && userRoles && userRoles.length > 0) {
    // Find roles for the current organization
    const orgRoles = userRoles.filter((role: Role) => role.org.id === org.id);
    if (orgRoles.length > 0) {
      // Initialize merged rights with default values
      const mergedRights: Rights = {
        courses: {
          action_create: false,
          action_read: false,
          action_read_own: false,
          action_update: false,
          action_update_own: false,
          action_delete: false,
          action_delete_own: false,
        },
        users: {
          action_create: false,
          action_read: false,
          action_update: false,
          action_delete: false,
        },
        usergroups: {
          action_create: false,
          action_read: false,
          action_update: false,
          action_delete: false,
        },
        collections: {
          action_create: false,
          action_read: false,
          action_update: false,
          action_delete: false,
        },
        organizations: {
          action_create: false,
          action_read: false,
          action_update: false,
          action_delete: false,
        },
        coursechapters: {
          action_create: false,
          action_read: false,
          action_update: false,
          action_delete: false,
        },
        activities: {
          action_create: false,
          action_read: false,
          action_update: false,
          action_delete: false,
        },
        roles: {
          action_create: false,
          action_read: false,
          action_update: false,
          action_delete: false,
        },
        dashboard: {
          action_access: false,
        },
      };

      // Merge rights from all roles
      orgRoles.forEach((role: Role) => {
        if (role.role.rights) {
          Object.keys(role.role.rights).forEach((resourceType) => {
            const resourceKey = resourceType as keyof Rights;
            if (mergedRights[resourceKey] && role.role.rights?.[resourceType]) {
              Object.keys(role.role.rights[resourceType]).forEach((action) => {
                if (role.role.rights?.[resourceType]?.[action] === true) {
                  const actionKey = action as keyof Rights[typeof resourceKey];
                  if (actionKey in mergedRights[resourceKey]) {
                    (mergedRights[resourceKey] as any)[actionKey] = true;
                  }
                }
              });
            }
          });
        }
      });

      rights = mergedRights;
    }
  }

  // Derive isAdmin and loading from rights
  const isAdmin = rights?.dashboard?.action_access === true;
  const loading = session.status === 'loading';

  return { isAdmin, loading, userRoles, rights };
}

export default useAdminStatus;
