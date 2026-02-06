'use client';

import { TooltipProvider, Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Globe, Lock, Shield, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface Permission {
  id: number;
  name: string;
  resource_type: string;
  action: string;
  scope: string;
}

interface Role {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  org_id: number | null;
  is_system: boolean;
  priority: number;
  permissions?: Permission[];
}

interface RoleHierarchyTreeProps {
  roles: Role[];
  onRoleSelect?: (role: Role) => void;
  selectedRoleId?: number;
  showPermissions?: boolean;
}

/**
 * Single role row.
 */
function RoleRow({
  role,
  onSelect,
  selectedId,
  showPermissions,
}: {
  role: Role;
  onSelect?: (role: Role) => void;
  selectedId?: number;
  showPermissions?: boolean;
}) {
  const isSelected = selectedId === role.id;
  const permCount = role.permissions?.length ?? 0;

  return (
    <div className="relative">
      <div
        className={`group flex items-center gap-2 rounded-md p-2 transition-colors ${
          isSelected ? 'bg-primary/10 ring-primary/20 ring-1' : 'hover:bg-muted/50'
        } ${onSelect ? 'cursor-pointer' : ''}`}
        onClick={() => onSelect?.(role)}
      >
        {/* Role icon */}
        <div className="flex-shrink-0">
          {role.is_system ? (
            <Globe className="text-primary h-4 w-4" />
          ) : (
            <Shield className="text-muted-foreground h-4 w-4" />
          )}
        </div>

        {/* Role name and info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{role.name}</span>
            {role.is_system && (
              <Badge variant="secondary" className="text-xs">
                System
              </Badge>
            )}
            <Badge variant="outline" className="text-xs">
              Priority {role.priority}
            </Badge>
          </div>
          {role.description && (
            <p className="text-muted-foreground mt-0.5 truncate text-xs">{role.description}</p>
          )}
        </div>

        {/* Permission count */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1 text-xs">
                <Lock className="text-muted-foreground h-3 w-3" />
                <span className="text-muted-foreground">{permCount}</span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-xs">Permissions: {permCount}</div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Permissions list */}
      {showPermissions && permCount > 0 && (
        <div className="text-muted-foreground mt-1 space-y-0.5 pl-8 text-xs">
          {role.permissions!.map((perm) => (
            <div key={perm.id} className="flex items-center gap-1">
              <div className="bg-primary h-1 w-1 rounded-full" />
              <code className="text-foreground/80">{perm.name}</code>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Role List Component
 *
 * Displays roles sorted by priority with their permissions.
 */
export function RoleHierarchyTree({
  roles,
  onRoleSelect,
  selectedRoleId,
  showPermissions = false,
}: RoleHierarchyTreeProps) {
  const sorted = [...roles].sort((a, b) => b.priority - a.priority);

  if (roles.length === 0) {
    return (
      <Card>
        <CardContent className="text-muted-foreground flex flex-col items-center justify-center py-12">
          <Shield className="mb-2 h-12 w-12 opacity-20" />
          <p>No roles found</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        {sorted.map((role) => (
          <RoleRow
            key={role.id}
            role={role}
            onSelect={onRoleSelect}
            selectedId={selectedRoleId}
            showPermissions={showPermissions}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default RoleHierarchyTree;
