'use client';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ChevronDown, ChevronRight, Globe, Lock, Shield, Users } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useState } from 'react';

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
  parent_role_id: number | null;
  is_system: boolean;
  priority: number;
  permissions?: Permission[];
}

interface RoleNode extends Role {
  children: RoleNode[];
  inherited_permissions: Permission[];
}

interface RoleHierarchyTreeProps {
  roles: Role[];
  onRoleSelect?: (role: Role) => void;
  selectedRoleId?: number;
  showPermissions?: boolean;
}

/**
 * Build a tree structure from flat roles array.
 */
function buildRoleTree(roles: Role[]): RoleNode[] {
  const roleMap = new Map<number, RoleNode>();
  const rootNodes: RoleNode[] = [];

  // Create nodes
  roles.forEach((role) => {
    roleMap.set(role.id, {
      ...role,
      children: [],
      inherited_permissions: [],
    });
  });

  // Build tree structure and calculate inherited permissions
  roles.forEach((role) => {
    const node = roleMap.get(role.id)!;

    if (role.parent_role_id) {
      const parent = roleMap.get(role.parent_role_id);
      if (parent) {
        parent.children.push(node);

        // Inherit permissions from parent
        node.inherited_permissions = [...(parent.permissions || []), ...(parent.inherited_permissions || [])];
      } else {
        rootNodes.push(node);
      }
    } else {
      rootNodes.push(node);
    }
  });

  return rootNodes;
}

/**
 * Single role node in the tree.
 */
function RoleTreeNode({
  node,
  onSelect,
  selectedId,
  showPermissions,
  depth = 0,
}: {
  node: RoleNode;
  onSelect?: (role: Role) => void;
  selectedId?: number;
  showPermissions?: boolean;
  depth?: number;
}) {
  const [isExpanded, setIsExpanded] = useState(depth === 0);
  const hasChildren = node.children.length > 0;
  const isSelected = selectedId === node.id;

  const ownPermissions = node.permissions || [];
  const inheritedCount = node.inherited_permissions.length;
  const ownCount = ownPermissions.length;
  const totalCount = inheritedCount + ownCount;

  return (
    <div className="relative">
      <div
        className={`group flex items-center gap-2 rounded-md p-2 transition-colors ${
          isSelected ? 'bg-primary/10 ring-primary/20 ring-1' : 'hover:bg-muted/50'
        } ${onSelect ? 'cursor-pointer' : ''}`}
        style={{ paddingLeft: `${depth * 1.5 + 0.5}rem` }}
        onClick={() => onSelect?.(node)}
      >
        {/* Expand/collapse button */}
        {hasChildren && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
            className="text-muted-foreground hover:text-foreground flex-shrink-0"
          >
            {isExpanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        )}

        {!hasChildren && <div className="w-4" />}

        {/* Role icon */}
        <div className="flex-shrink-0">
          {node.is_system ? (
            <Globe className="text-primary h-4 w-4" />
          ) : (
            <Shield className="text-muted-foreground h-4 w-4" />
          )}
        </div>

        {/* Role name and info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate font-medium">{node.name}</span>
            {node.is_system && (
              <Badge
                variant="secondary"
                className="text-xs"
              >
                System
              </Badge>
            )}
            {node.parent_role_id && (
              <Badge
                variant="outline"
                className="text-xs"
              >
                Inherited
              </Badge>
            )}
          </div>
          {node.description && <p className="text-muted-foreground mt-0.5 truncate text-xs">{node.description}</p>}
        </div>

        {/* Permission count */}
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>
              <div className="flex items-center gap-1 text-xs">
                <Lock className="text-muted-foreground h-3 w-3" />
                <span className="text-muted-foreground">
                  {totalCount}
                  {inheritedCount > 0 && <span className="text-primary ml-0.5">(+{inheritedCount})</span>}
                </span>
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="space-y-1 text-xs">
                <div>Own permissions: {ownCount}</div>
                {inheritedCount > 0 && <div className="text-primary">Inherited: {inheritedCount}</div>}
                <div className="font-semibold">Total: {totalCount}</div>
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>

        {/* Child count */}
        {hasChildren && (
          <div className="text-muted-foreground flex items-center gap-1 text-xs">
            <Users className="h-3 w-3" />
            <span>{node.children.length}</span>
          </div>
        )}
      </div>

      {/* Permissions list (if expanded and showPermissions is true) */}
      {isExpanded && showPermissions && (ownPermissions.length > 0 || inheritedCount > 0) && (
        <div
          className="text-muted-foreground mt-1 space-y-0.5 text-xs"
          style={{ paddingLeft: `${(depth + 1) * 1.5 + 0.5}rem` }}
        >
          {ownPermissions.map((perm) => (
            <div
              key={perm.id}
              className="flex items-center gap-1"
            >
              <div className="bg-primary h-1 w-1 rounded-full" />
              <code className="text-foreground/80">{perm.name}</code>
            </div>
          ))}
          {inheritedCount > 0 && <div className="text-primary/70 italic">+ {inheritedCount} inherited permissions</div>}
        </div>
      )}

      {/* Child roles */}
      {isExpanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {node.children.map((child) => (
            <RoleTreeNode
              key={child.id}
              node={child}
              onSelect={onSelect}
              selectedId={selectedId}
              showPermissions={showPermissions}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Role Hierarchy Tree Component
 *
 * Displays roles in a tree structure showing parent-child relationships
 * and inherited permissions.
 *
 * Features:
 * - Expandable/collapsible tree nodes
 * - Visual indicators for system roles
 * - Permission inheritance display
 * - Optional permission list view
 * - Role selection support
 *
 * @example
 * ```tsx
 * <RoleHierarchyTree
 *   roles={roles}
 *   onRoleSelect={(role) => console.log('Selected:', role)}
 *   selectedRoleId={selectedRole?.id}
 *   showPermissions={true}
 * />
 * ```
 */
export function RoleHierarchyTree({
  roles,
  onRoleSelect,
  selectedRoleId,
  showPermissions = false,
}: RoleHierarchyTreeProps) {
  const tree = buildRoleTree(roles);

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
        {tree.map((node) => (
          <RoleTreeNode
            key={node.id}
            node={node}
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
