import { PLATFORM_THUMBNAIL_IMAGE_PATH } from '@/lib/constants';
import { getPublicConfig } from '@services/config/env';

const getMediaUrl = () => getPublicConfig().mediaUrl;

export function getCourseThumbnailMediaDirectory(courseUUID: string, fileId: string): string {
  return `${getMediaUrl()}content/platform/courses/${courseUUID}/thumbnails/${fileId}`;
}

export function getLandingMediaDirectory(fileId: string): string {
  return `${getMediaUrl()}content/platform/landing/${fileId}`;
}

export function getUserAvatarMediaDirectory(userUUID: string, fileId: string): string {
  return `${getMediaUrl()}content/users/${userUUID}/avatars/${fileId}`;
}

export function getActivityBlockMediaDirectory(
  courseId: string,
  activityId: string,
  blockId: string,
  fileId: string,
  type: string,
): string {
  return `${getMediaUrl()}content/platform/courses/${courseId}/activities/${activityId}/dynamic/blocks/${type}/${blockId}/${fileId}`;
}

export function getTaskRefFileDir(
  courseUUID: string,
  activityUUID: string,
  assignmentUUID: string,
  assignmentTaskUUID: string,
  fileID: string,
): string {
  return `${getMediaUrl()}content/platform/courses/${courseUUID}/activities/${activityUUID}/assignments/${assignmentUUID}/tasks/${assignmentTaskUUID}/${fileID}`;
}

export function getTaskFileSubmissionDir(
  courseUUID: string,
  activityUUID: string,
  assignmentUUID: string,
  assignmentTaskUUID: string,
  fileSubID: string,
): string {
  return `${getMediaUrl()}content/platform/courses/${courseUUID}/activities/${activityUUID}/assignments/${assignmentUUID}/tasks/${assignmentTaskUUID}/subs/${fileSubID}`;
}

export function getActivityMediaDirectory(
  courseUUID: string,
  activityUUID: string,
  fileId: string,
  activityType: string,
): string | undefined {
  if (activityType === 'video') {
    return `${getMediaUrl()}content/platform/courses/${courseUUID}/activities/${activityUUID}/video/${fileId}`;
  }
  if (activityType === 'documentpdf') {
    return `${getMediaUrl()}content/platform/courses/${courseUUID}/activities/${activityUUID}/documentpdf/${fileId}`;
  }
  return undefined;
}

export function getLogoMediaDirectory(fileId: string): string {
  return `${getMediaUrl()}content/platform/logos/${fileId}`;
}

export function getThumbnailMediaDirectory(fileId: string): string {
  return `${getMediaUrl()}content/platform/thumbnails/${fileId}`;
}

export function getPlatformThumbnailImage(fileId?: string | null): string {
  if (fileId) {
    return getThumbnailMediaDirectory(fileId);
  }

  const thumbnailPath = PLATFORM_THUMBNAIL_IMAGE_PATH.startsWith('/')
    ? PLATFORM_THUMBNAIL_IMAGE_PATH.slice(1)
    : PLATFORM_THUMBNAIL_IMAGE_PATH;

  return `${getPublicConfig().siteUrl}${thumbnailPath}`;
}

export function getPreviewMediaDirectory(fileId: string): string {
  return `${getMediaUrl()}content/platform/previews/${fileId}`;
}
