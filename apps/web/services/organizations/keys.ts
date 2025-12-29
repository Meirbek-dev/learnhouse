import { getAPIUrl } from '@services/config/config';

export function getOrgUsersSwrKey(orgId: number | null | undefined) {
  if (!orgId) return '';
  return `${getAPIUrl()}orgs/${orgId}/users`;
}

export function getOrgInvitesSwrKey(orgId: number | null | undefined) {
  if (!orgId) return '';
  return `${getAPIUrl()}orgs/${orgId}/invites`;
}

export function getUsergroupsSwrKey(orgId: number | null | undefined) {
  if (!orgId) return '';
  return `${getAPIUrl()}usergroups/org/${orgId}`;
}

export function getUsergroupUsersSwrKey(usergroupId: number | null | undefined) {
  if (!usergroupId) return '';
  return `${getAPIUrl()}usergroups/${usergroupId}/users`;
}
