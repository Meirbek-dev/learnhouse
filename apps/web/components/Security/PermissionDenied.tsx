'use client';

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import type { Action, ResourceType } from '@/types/permissions';
import { Actions, ResourceTypes } from '@/types/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { Button } from '@/components/ui/button';
import { AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface PermissionDeniedProps {
  action: Action;
  resource: ResourceType;
  requiredPermission?: string;
  reason?: string;
  className?: string;
}

/**
 * PermissionDenied component displays a user-friendly message when access is denied.
 *
 * This component:
 * - Shows a clear denial message
 * - Displays the required permission
 * - Shows the reason for denial (if provided)
 * - Provides a link to role management for admins
 *
 * @example
 * ```tsx
 * <PermissionDenied
 *   action={Actions.UPDATE}
 *   resource={ResourceTypes.COURSE}
 *   requiredPermission="course:update:org"
 *   reason="You need organization-level course update permission"
 * />
 * ```
 */
export function PermissionDenied({ action, resource, requiredPermission, reason, className }: PermissionDeniedProps) {
  const { isAdmin } = usePermissions();

  const actionLabels: Record<Action, string> = {
    [Actions.CREATE]: 'create',
    [Actions.READ]: 'view',
    [Actions.UPDATE]: 'edit',
    [Actions.DELETE]: 'delete',
    [Actions.MANAGE]: 'manage',
    [Actions.MODERATE]: 'moderate',
    [Actions.EXPORT]: 'export',
    [Actions.INVITE]: 'invite',
    [Actions.GRADE]: 'grade',
    [Actions.SUBMIT]: 'submit',
    [Actions.ENROLL]: 'enroll',
  };

  const resourceLabels: Record<ResourceType, string> = {
    [ResourceTypes.ORGANIZATION]: 'organization',
    [ResourceTypes.COURSE]: 'course',
    [ResourceTypes.CHAPTER]: 'chapter',
    [ResourceTypes.ACTIVITY]: 'activity',
    [ResourceTypes.ASSIGNMENT]: 'assignment',
    [ResourceTypes.QUIZ]: 'quiz',
    [ResourceTypes.USER]: 'user',
    [ResourceTypes.USERGROUP]: 'user group',
    [ResourceTypes.COLLECTION]: 'collection',
    [ResourceTypes.ROLE]: 'role',
    [ResourceTypes.CERTIFICATE]: 'certificate',
    [ResourceTypes.DISCUSSION]: 'discussion',
    [ResourceTypes.FILE]: 'file',
    [ResourceTypes.ANALYTICS]: 'analytics',
    [ResourceTypes.TRAIL]: 'learning trail',
    [ResourceTypes.EXAM]: 'exam',
    [ResourceTypes.PAYMENT]: 'payment',
    [ResourceTypes.API_TOKEN]: 'API token',
  };

  const actionLabel = actionLabels[action] || action;
  const resourceLabel = resourceLabels[resource] || resource;

  return (
    <Alert
      variant="destructive"
      className={className}
    >
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Permission Denied</AlertTitle>
      <AlertDescription className="mt-2 space-y-2">
        <p>
          You don&apos;t have permission to {actionLabel} this {resourceLabel}.
        </p>

        {requiredPermission && (
          <p className="text-xs">
            Required permission: <code className="rounded bg-red-900/20 px-1 py-0.5">{requiredPermission}</code>
          </p>
        )}

        {reason && <p className="text-xs">{reason}</p>}

        {isAdmin && (
          <div className="mt-3">
            <Button
              variant="outline"
              size="sm"
              render={<Link href="/settings/roles">Manage Roles & Permissions</Link>}
            />
          </div>
        )}

        {!isAdmin && (
          <p className="text-muted-foreground mt-3 text-xs">
            Contact your organization administrator if you believe you should have access.
          </p>
        )}
      </AlertDescription>
    </Alert>
  );
}

export default PermissionDenied;
