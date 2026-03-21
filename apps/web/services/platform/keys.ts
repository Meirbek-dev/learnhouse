import { getAPIUrl } from '@services/config/config';

export function getUsersSwrKey() {
  return `${getAPIUrl()}members`;
}

export function getInvitesSwrKey() {
  return `${getAPIUrl()}invites`;
}

export function getUsergroupsSwrKey() {
  return `${getAPIUrl()}usergroups`;
}

export function getUsergroupUsersSwrKey(usergroupId: number | null | undefined) {
  if (!usergroupId) return '';
  return `${getAPIUrl()}usergroups/${usergroupId}/users`;
}
