import { getAPIUrl } from '@services/config/config';

/**
 * key builder for getting course discussions
 * Usage: use this key builder with the discussions query fetcher for course discussions.
 */
export function getDiscussionsSwrKey(course_uuid: string, include_replies = false, limit = 50, offset = 0) {
  const params = new URLSearchParams({
    include_replies: include_replies.toString(),
    limit: limit.toString(),
    offset: offset.toString(),
  });
  return `${getAPIUrl()}courses/${course_uuid}/discussions?${params.toString()}`;
}

/**
 * key builder for getting discussion replies
 * Usage: use this key builder with the discussions query fetcher for discussion replies.
 */
export function getDiscussionRepliesSwrKey(course_uuid: string, discussion_uuid: string, limit = 50, offset = 0) {
  const params = new URLSearchParams({
    limit: limit.toString(),
    offset: offset.toString(),
  });
  return `${getAPIUrl()}courses/${course_uuid}/discussions/${discussion_uuid}/replies?${params.toString()}`;
}
