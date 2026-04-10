'use client';

import { queryOptions, useQuery } from '@tanstack/react-query';
import {
  allMembersQueryOptions,
  membersQueryOptions,
  rolesQueryOptions,
  userByIdQueryOptions,
  userByUsernameQueryOptions,
  userGroupUsersQueryOptions,
  userGroupsQueryOptions,
} from '../queries/users.query';

function userGroupsHookOptions(enabled = true) {
  return queryOptions({
    ...userGroupsQueryOptions(),
    enabled,
  });
}

function userGroupUsersHookOptions(userGroupId: number | null | undefined) {
  const normalizedUserGroupId = userGroupId ?? 0;

  return queryOptions({
    ...userGroupUsersQueryOptions(normalizedUserGroupId),
    enabled: Boolean(userGroupId),
  });
}

function userByIdHookOptions(userId: number | null | undefined, enabled = true) {
  const normalizedUserId = userId ?? 0;

  return queryOptions({
    ...userByIdQueryOptions(normalizedUserId),
    enabled: enabled && userId !== null && userId !== undefined,
  });
}

function userByUsernameHookOptions(username: string | null | undefined, enabled = true) {
  const normalizedUsername = username?.trim() ?? '';

  return queryOptions({
    ...userByUsernameQueryOptions(normalizedUsername || '__disabled__'),
    enabled: enabled && normalizedUsername.length > 0,
  });
}

export function useUserGroups(options?: { enabled?: boolean }) {
  return useQuery(userGroupsHookOptions(options?.enabled ?? true));
}

export function useUserGroupUsers(userGroupId: number | null | undefined) {
  return useQuery(userGroupUsersHookOptions(userGroupId));
}

export function useAllMembers() {
  return useQuery(allMembersQueryOptions());
}

export function useMembers(page: number, perPage: number) {
  return useQuery(membersQueryOptions(page, perPage));
}

export function useRoles() {
  return useQuery(rolesQueryOptions());
}

export function useUserByIdQuery(userId: number | null | undefined, options?: { enabled?: boolean }) {
  return useQuery(userByIdHookOptions(userId, options?.enabled ?? true));
}

export function useUserByUsernameQuery(username: string | null | undefined, options?: { enabled?: boolean }) {
  return useQuery(userByUsernameHookOptions(username, options?.enabled ?? true));
}
