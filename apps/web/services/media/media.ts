import { getBackendUrl } from '@services/config/config';

const OPENU_MEDIA_URL = process.env.NEXT_PUBLIC_OPENU_MEDIA_URL;

function getMediaUrl(): string {
  return OPENU_MEDIA_URL || getBackendUrl();
}

export function getCourseThumbnailMediaDirectory(orgUUID: string, courseUUID: string, fileId: string): string {
  return `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseUUID}/thumbnails/${fileId}`;
}

export function getOrgLandingMediaDirectory(orgUUID: string, fileId: string): string {
  return `${getMediaUrl()}content/orgs/${orgUUID}/landing/${fileId}`;
}

export function getUserAvatarMediaDirectory(userUUID: string, fileId: string): string {
  return `${getMediaUrl()}content/users/${userUUID}/avatars/${fileId}`;
}

export function getActivityBlockMediaDirectory(
  orgUUID: string,
  courseId: string,
  activityId: string,
  blockId: string,
  fileId: string,
  type: string,
): string {
  return `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseId}/activities/${activityId}/dynamic/blocks/${type}/${blockId}/${fileId}`;
}

export function getTaskRefFileDir(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  assignmentUUID: string,
  assignmentTaskUUID: string,
  fileID: string,
): string {
  return `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/assignments/${assignmentUUID}/tasks/${assignmentTaskUUID}/${fileID}`;
}

export function getTaskFileSubmissionDir(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  assignmentUUID: string,
  assignmentTaskUUID: string,
  fileSubID: string,
): string {
  return `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/assignments/${assignmentUUID}/tasks/${assignmentTaskUUID}/subs/${fileSubID}`;
}

export function getActivityMediaDirectory(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  fileId: string,
  activityType: string,
): string | undefined {
  if (activityType === 'video') {
    return `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/video/${fileId}`;
  }
  if (activityType === 'documentpdf') {
    return `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/documentpdf/${fileId}`;
  }
  return undefined;
}

export function getVideoSubtitlesDirectory(
  orgUUID: string,
  courseUUID: string,
  activityUUID: string,
  fileId: string,
): string | undefined {
  return `${getMediaUrl()}content/orgs/${orgUUID}/courses/${courseUUID}/activities/${activityUUID}/video/subtitles`;
}

export function getOrgLogoMediaDirectory(orgUUID: string, fileId: string): string {
  return `${getMediaUrl()}content/orgs/${orgUUID}/logos/${fileId}`;
}

export function getOrgThumbnailMediaDirectory(orgUUID: string, fileId: string): string {
  return `${getMediaUrl()}content/orgs/${orgUUID}/thumbnails/${fileId}`;
}

export function getOrgPreviewMediaDirectory(orgUUID: string, fileId: string): string {
  return `${getMediaUrl()}content/orgs/${orgUUID}/previews/${fileId}`;
}
