'use server';

import { RequestBodyWithAuthHeader, getResponseMetadata } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { tags } from '@/lib/cacheTags';

export async function createInviteCode(org_id: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/invites`,
    RequestBodyWithAuthHeader('POST', null, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate organizations cache after creating invite code
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return metadata;
}

export async function createInviteCodeWithUserGroup(org_id: number, usergroup_id: number, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/invites_with_usergroups?usergroup_id=${usergroup_id}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate organizations cache after creating invite code with usergroup
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return metadata;
}

export async function deleteInviteCode(org_id: number, org_invite_code_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/invites/${org_invite_code_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate organizations cache after deleting invite code
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return metadata;
}

export async function changeSignupMechanism(org_id: number, signup_mechanism: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/signup_mechanism?signup_mechanism=${signup_mechanism}`,
    RequestBodyWithAuthHeader('PUT', null, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate organizations cache after changing signup mechanism
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
  }

  return metadata;
}

export async function validateInviteCode(org_id: number, invite_code: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/invites/code/${invite_code}`,
    RequestBodyWithAuthHeader('GET', null, null, access_token),
  );
  return await getResponseMetadata(result);
}

export async function inviteBatchUsers(org_id: number, emails: string, invite_code_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}orgs/${org_id}/invites/users/batch?emails=${emails}&invite_code_uuid=${invite_code_uuid}`,
    RequestBodyWithAuthHeader('POST', null, null, access_token),
  );
  const metadata = await getResponseMetadata(result);

  // Revalidate organizations and users cache after batch invite
  if (metadata.success) {
    const { revalidateTag } = await import('next/cache');
    revalidateTag(tags.organizations, 'max');
    revalidateTag(tags.users, 'max');
  }

  return metadata;
}
