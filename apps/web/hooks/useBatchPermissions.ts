'use client';

import type { Action, ResourceType, Scope } from '@/types/permissions';
import { Scopes } from '@/types/permissions';
import { getAPIUrl } from '@/services/config/config';
import { useCallback, useState } from 'react';
import { useSession } from 'next-auth/react';

interface PermissionCheck {
  action: Action;
  resource: ResourceType;
  resource_id?: string;
  org_id?: number;
  scope?: Scope;
}

interface PermissionCheckResult {
  action: Action;
  resource: ResourceType;
  resource_id?: string | null;
  org_id?: number | null;
  allowed: boolean;
}

interface BatchPermissionCheckResponse {
  results: PermissionCheckResult[];
  permissions: Record<string, boolean>;
}

/**
 * Hook for efficiently checking multiple permissions in a single API call.
 *
 * This hook reduces network overhead by batching multiple permission checks
 * into one request, which is especially useful for pages that need to check
 * many permissions at once (e.g., admin dashboards, resource lists).
 *
 * @example
 * ```tsx
 * const { batchCheck, isChecking } = useBatchPermissions();
 *
 * useEffect(() => {
 *   const checkPermissions = async () => {
 *     const results = await batchCheck([
 *       { action: Actions.CREATE, resource: ResourceTypes.COURSE },
 *       { action: Actions.UPDATE, resource: ResourceTypes.ORGANIZATION },
 *       { action: Actions.DELETE, resource: ResourceTypes.USER, resource_id: userId },
 *     ]);
 *
 *     // results is a Map with check keys and boolean values
 *     if (results.get('course:create')) {
 *       // User can create courses
 *     }
 *   };
 *
 *   checkPermissions();
 * }, []);
 * ```
 */
export function useBatchPermissions() {
  const { data: session, status } = useSession();
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const accessToken = session?.tokens?.access_token;

  /**
   * Generate a unique key for a permission check.
   */
  const generateCheckKey = (check: PermissionCheck): string => {
    const parts = [check.resource, check.action];
    if (check.scope) parts.push(check.scope);
    if (check.resource_id) parts.push(check.resource_id);
    return parts.join(':');
  };

  /**
   * Batch check multiple permissions in a single API call.
   *
   * @param checks - Array of permission checks to perform
   * @returns Map of check keys to boolean allowed values
   */
  const batchCheck = useCallback(
    async (checks: PermissionCheck[]): Promise<Map<string, boolean>> => {
      if (status !== 'authenticated' || !accessToken) {
        // Not authenticated - return all false
        const results = new Map<string, boolean>();
        checks.forEach((check) => {
          results.set(generateCheckKey(check), false);
        });
        return results;
      }

      setIsChecking(true);
      setError(null);

      try {
        const response = await fetch(`${getAPIUrl()}permissions/check`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ checks }),
        });

        if (!response.ok) {
          throw new Error(`Batch permission check failed: ${response.statusText}`);
        }

        const data: BatchPermissionCheckResponse = await response.json();

        // Convert results array to Map for easier lookup
        const resultsMap = new Map<string, boolean>();

        data.results.forEach((result) => {
          const key = generateCheckKey({
            action: result.action,
            resource: result.resource,
            resource_id: result.resource_id ?? undefined,
            org_id: result.org_id ?? undefined,
          });
          resultsMap.set(key, result.allowed);
        });

        // Also include permissions object for direct permission name lookups
        Object.entries(data.permissions).forEach(([permName, allowed]) => {
          resultsMap.set(permName, allowed);
        });

        return resultsMap;
      } catch (error) {
        const error = error instanceof Error ? error : new Error('Unknown error');
        setError(error);
        console.error('Batch permission check error:', error);

        // Return all false on error
        const results = new Map<string, boolean>();
        checks.forEach((check) => {
          results.set(generateCheckKey(check), false);
        });
        return results;
      } finally {
        setIsChecking(false);
      }
    },
    [accessToken, status],
  );

  /**
   * Quick check for common permission patterns.
   *
   * @example
   * ```tsx
   * const canManageOrg = await quickCheck('org', ['create', 'update', 'delete']);
   * // Returns { create: true, update: true, delete: false }
   * ```
   */
  const quickCheck = useCallback(
    async (resource: ResourceType, actions: Action[], scope: Scope = Scopes.ORG): Promise<Record<Action, boolean>> => {
      const checks = actions.map((action) => ({
        action,
        resource,
        scope,
      }));

      const results = await batchCheck(checks);

      const output: Record<string, boolean> = {};
      actions.forEach((action) => {
        const key = `${resource}:${action}`;
        output[action] = results.get(key) ?? false;
      });

      return output as Record<Action, boolean>;
    },
    [batchCheck],
  );

  return {
    batchCheck,
    quickCheck,
    isChecking,
    error,
  };
}

export default useBatchPermissions;
