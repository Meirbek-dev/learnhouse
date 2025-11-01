import { getBackendUrl } from '@services/config/config';

function getMediaUrl(): string {
  return process.env.NEXT_PUBLIC_PLATFORM_MEDIA_URL || getBackendUrl();
}

const MEDIA_URL = getMediaUrl();

export function getCourseThumbnailMediaDirectory(orgUUID: string, courseUUID: string, fileId: string): string {
  return `${MEDIA_URL}content/orgs/${orgUUID}/courses/${courseUUID}/thumbnails/${fileId}`;
}

export function getOrgLandingMediaDirectory(orgUUID: string, fileId: string): string {
  return `${MEDIA_URL}content/orgs/${orgUUID}/landing/${fileId}`;
}

export function getUserAvatarMediaDirectory(userUUID: string, fileId: string): string {
  return `${MEDIA_URL}content/users/${userUUID}/avatars/${fileId}`;
}

export function getActivityBlockMediaDirectory(
  orgUUID: string,
  courseId: string,
  activityId: string,
  blockId: string,
  fileId: string,
  type: string,
): string {
  return `${MEDIA_URL}content/orgs/${orgUUID}/courses/${courseId}/activities/${activityId}/dynamic/blocks/${type}/${blockId}/${fileId}`;
}

export function getTaskRefFileDir(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  assignmentUUID: string,
  assignmentTaskUUID: string,
  fileID: string,
): string {
  return `${MEDIA_URL}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/assignments/${assignmentUUID}/tasks/${assignmentTaskUUID}/${fileID}`;
}

export function getTaskFileSubmissionDir(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  assignmentUUID: string,
  assignmentTaskUUID: string,
  fileSubID: string,
): string {
  return `${MEDIA_URL}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/assignments/${assignmentUUID}/tasks/${assignmentTaskUUID}/subs/${fileSubID}`;
}

export function getActivityMediaDirectory(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  fileId: string,
  activityType: string,
): string | undefined {
  if (activityType === 'video') {
    return `${MEDIA_URL}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/video/${fileId}`;
  }
  if (activityType === 'documentpdf') {
    return `${MEDIA_URL}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/documentpdf/${fileId}`;
  }
  return undefined;
}

export function getOrgLogoMediaDirectory(orgUUID: string, fileId: string): string {
  return `${MEDIA_URL}content/orgs/${orgUUID}/logos/${fileId}`;
}

export function getOrgThumbnailMediaDirectory(orgUUID: string, fileId: string): string {
  return `${MEDIA_URL}content/orgs/${orgUUID}/thumbnails/${fileId}`;
}

export function getOrgPreviewMediaDirectory(orgUUID: string, fileId: string): string {
  return `${MEDIA_URL}content/orgs/${orgUUID}/previews/${fileId}`;
}
