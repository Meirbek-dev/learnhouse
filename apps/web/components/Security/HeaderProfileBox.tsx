'use client';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@components/ui/dropdown-menu';
import {
  Package2,
  Settings,
  Crown,
  Shield,
  User,
  Users,
  Building,
  LogOut,
  User as UserIcon,
  Home,
  ChevronDown,
  GraduationCap,
} from 'lucide-react';
import { Tooltip, TooltipTrigger, TooltipContent } from '@components/ui/tooltip';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { getUriWithoutOrg } from '@services/config/config';
import { useOrg } from '@components/Contexts/OrgContext';
import UserAvatar from '@components/Objects/UserAvatar';
import React, { useEffect, useMemo } from 'react';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';
import Link from 'next/link';

interface RoleInfo {
  name: string;
  icon: React.ReactNode;
  bgColor: string;
  textColor: string;
  description: string;
}

interface CustomRoleInfo {
  name: string;
  description?: string;
}

export const HeaderProfileBox = () => {
  const session = useLHSession() as any;
  const { isAdmin, loading, userRoles, rights } = useAdminStatus();
  const org = useOrg() as any;
  const t = useTranslations('Header');

  useEffect(() => {}, [session]);

  const userRoleInfo = useMemo((): RoleInfo | null => {
    if (!userRoles || userRoles.length === 0) return null;

    // Find the highest priority role for the current organization
    const orgRoles = userRoles.filter((role: any) => role.org.id === org?.id);

    if (orgRoles.length === 0) return null;

    // Sort by role priority (admin > maintainer > instructor > user)
    const sortedRoles = orgRoles.sort((a: any, b: any) => {
      const getRolePriority = (role: any) => {
        if (role.role.role_uuid === 'role_global_admin' || role.role.id === 1) return 4;
        if (role.role.role_uuid === 'role_global_maintainer' || role.role.id === 2) return 3;
        if (role.role.role_uuid === 'role_global_instructor' || role.role.id === 3) return 2;
        return 1;
      };
      return getRolePriority(b) - getRolePriority(a);
    });

    const highestRole = sortedRoles[0];

    if (!highestRole) return null;

    // Define role configurations based on actual database roles
    const roleConfigs: { [key: string]: RoleInfo } = {
      role_global_admin: {
        name: 'ADMIN',
        icon: <Crown size={12} />,
        bgColor: 'bg-purple-600',
        textColor: 'text-white',
        description: 'Full platform control with all permissions',
      },
      role_global_maintainer: {
        name: 'MAINTAINER',
        icon: <Shield size={12} />,
        bgColor: 'bg-blue-600',
        textColor: 'text-white',
        description: 'Mid-level manager with wide permissions',
      },
      role_global_instructor: {
        name: 'INSTRUCTOR',
        icon: <Users size={12} />,
        bgColor: 'bg-green-600',
        textColor: 'text-white',
        description: 'Can manage their own content',
      },
      role_global_user: {
        name: 'USER',
        icon: <User size={12} />,
        bgColor: 'bg-gray-500',
        textColor: 'text-white',
        description: 'Read-Only Learner',
      },
    };

    // Determine role based on role_uuid or id
    let roleKey = 'role_global_user'; // default
    if (highestRole.role.role_uuid) {
      roleKey = highestRole.role.role_uuid;
    } else if (highestRole.role.id === 1) {
      roleKey = 'role_global_admin';
    } else if (highestRole.role.id === 2) {
      roleKey = 'role_global_maintainer';
    } else if (highestRole.role.id === 3) {
      roleKey = 'role_global_instructor';
    }

    return roleConfigs[roleKey] || roleConfigs['role_global_user'] || null;
  }, [userRoles, org?.id]);

  const customRoles = useMemo((): CustomRoleInfo[] => {
    if (!userRoles || userRoles.length === 0) return [];

    // Find roles for the current organization
    const orgRoles = userRoles.filter((role: any) => role.org.id === org?.id);

    if (orgRoles.length === 0) return [];

    // Filter for custom roles (not system roles)
    const customRoles = orgRoles.filter((role: any) => {
      // Check if it's a system role
      const isSystemRole =
        role.role.role_uuid?.startsWith('role_global_') ||
        [1, 2, 3, 4].includes(role.role.id) ||
        ['Admin', 'Maintainer', 'Instructor', 'User'].includes(role.role.name);

      return !isSystemRole;
    });

    return customRoles.map((role: any) => ({
      name: role.role.name || 'Custom Role',
      description: role.role.description,
    }));
  }, [userRoles, org?.id]);

  return (
    <div className="flex items-center">
      {session.status == 'unauthenticated' && (
        <div className="flex text-sm text-gray-700 font-bold p-1.5 px-2 rounded-lg flex-grow">
          <ul className="flex space-x-3 items-center">
            <li>
              <Button
                variant="ghost"
                size="sm"
                asChild
              >
                <Link href={{ pathname: getUriWithoutOrg('/login'), query: org ? { orgslug: org.slug } : undefined }}>
                  {t('login')}
                </Link>
              </Button>
            </li>
            <li>
              <Button
                size="sm"
                asChild
              >
                <Link href={{ pathname: getUriWithoutOrg('/signup'), query: org ? { orgslug: org.slug } : undefined }}>
                  {t('signUp')}
                </Link>
              </Button>
            </li>
          </ul>
        </div>
      )}
      {session.status === 'authenticated' && (
        <div className="flex items-center">
          <div className="flex items-center space-x-3">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="flex items-center space-x-1 h-auto p-2"
                >
                  <UserAvatar size="sm" />
                  <div className="flex flex-col space-y-0">
                    <div className="flex items-center space-x-2">
                      <p className="text-sm font-semibold text-gray-900 capitalize">{session.data.user.username}</p>
                      {userRoleInfo && userRoleInfo.name !== 'USER' && (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className={`text-[8px] ${userRoleInfo.bgColor} ${userRoleInfo.textColor} px-1 py-0.5 font-medium flex items-center gap-0.5 w-fit`}
                            >
                              {userRoleInfo.icon}
                              {userRoleInfo.name}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            sideOffset={15}
                            className="max-w-56 text-wrap"
                          >
                            {userRoleInfo.description}
                          </TooltipContent>
                        </Tooltip>
                      )}
                      {/* Custom roles */}
                      {customRoles.map((customRole, index) => (
                        <Tooltip key={index}>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className="text-[8px] bg-gray-500 text-white px-1 py-0.5 font-medium flex items-center gap-0.5 w-fit"
                            >
                              <Shield size={12} />
                              {customRole.name}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent
                            side="bottom"
                            sideOffset={15}
                            className="max-w-56 text-wrap"
                          >
                            {customRole.description || `Custom role: ${customRole.name}`}
                          </TooltipContent>
                        </Tooltip>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground">{session.data.user.email}</p>
                  </div>
                  <ChevronDown
                    size={16}
                    className="text-muted-foreground"
                  />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                className="w-56"
                align="end"
              >
                <DropdownMenuLabel>
                  <div className="flex items-center space-x-2">
                    <UserAvatar size="sm" />
                    <div>
                      <p className="text-sm font-medium capitalize">{session.data.user.username}</p>
                      <p className="text-xs text-muted-foreground">{session.data.user.email}</p>
                    </div>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {rights?.dashboard?.action_access && (
                  <DropdownMenuItem asChild>
                    <Link
                      href="/dash"
                      className="flex items-center space-x-2"
                    >
                      <Shield size={16} />
                      <span>Dashboard</span>
                    </Link>
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link
                    href="/dash/user-account/settings/general"
                    className="flex items-center space-x-2"
                  >
                    <UserIcon size={16} />
                    <span>User Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => signOut({ callbackUrl: '/' })}
                  className="flex items-center space-x-2 text-destructive focus:text-destructive"
                >
                  <LogOut size={16} />
                  <span>Sign Out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      )}
    </div>
  );
};
