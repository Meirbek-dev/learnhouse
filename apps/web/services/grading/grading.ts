'use server';

/**
 * Grading API service.
 *
 * Replaces the scattered assignment/quiz service functions with a single
 * module that covers the full grading lifecycle.
 */

import { revalidateTag } from 'next/cache';
import { getServerAPIUrl } from '@services/config/config';
import { RequestBodyWithAuthHeader, getResponseMetadata } from '@services/utils/ts/requests';
import type {
  AssessmentType,
  Submission,
  SubmissionsPage,
  TeacherGradeInput,
} from '@/types/grading';

const API = () => getServerAPIUrl();

// ── Student endpoints ─────────────────────────────────────────────────────────

/**
 * Record the server-stamped start time for a quiz/exam attempt.
 * Must be called before submitting — the returned submission_uuid identifies the draft.
 */
export async function startSubmission(
  activityId: number,
  assessmentType: AssessmentType,
  accessToken: string,
): Promise<Submission> {
  const url = `${API()}grading/start/${activityId}?assessment_type=${assessmentType}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('POST', null, null, accessToken));
  const meta = await getResponseMetadata(res);
  if (!meta.success) throw new Error(meta.data?.detail ?? 'Failed to start submission');
  return meta.data as Submission;
}

/**
 * Submit an assessment attempt and receive grading results.
 */
export async function submitAssessment(
  activityId: number,
  assessmentType: AssessmentType,
  answersPayload: Record<string, unknown>,
  accessToken: string,
  violationCount = 0,
): Promise<Submission> {
  const url = `${API()}grading/submit/${activityId}?assessment_type=${assessmentType}&violation_count=${violationCount}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('POST', answersPayload, null, accessToken));
  const meta = await getResponseMetadata(res);
  if (!meta.success) throw new Error(meta.data?.detail ?? 'Failed to submit assessment');

  revalidateTag('submissions');
  return meta.data as Submission;
}

/**
 * Fetch the current user's submissions for an activity.
 */
export async function getMySubmissions(
  activityId: number,
  accessToken: string,
): Promise<Submission[]> {
  const url = `${API()}grading/submissions/me?activity_id=${activityId}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, { tags: ['submissions'] }, accessToken));
  const meta = await getResponseMetadata(res);
  if (!meta.success) return [];
  return meta.data as Submission[];
}

// ── Teacher endpoints ─────────────────────────────────────────────────────────

/**
 * Paginated submissions list for a teacher.
 * Replaces the kanban board that had no filtering or pagination.
 */
export async function getSubmissionsForActivity(
  activityId: number,
  accessToken: string,
  options: {
    status?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<SubmissionsPage> {
  const params = new URLSearchParams({ activity_id: String(activityId) });
  if (options.status) params.set('status', options.status);
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('page_size', String(options.pageSize));

  const url = `${API()}grading/submissions?${params}`;
  const res = await fetch(
    url,
    RequestBodyWithAuthHeader('GET', null, { tags: ['submissions'] }, accessToken),
  );
  const meta = await getResponseMetadata(res);
  if (!meta.success) return { items: [], total: 0, page: 1, page_size: 25, pages: 1 };
  return meta.data as SubmissionsPage;
}

/**
 * Fetch a single submission with full answers + grading breakdown.
 */
export async function getSubmission(
  submissionUuid: string,
  accessToken: string,
): Promise<Submission | null> {
  const url = `${API()}grading/submissions/${submissionUuid}`;
  const res = await fetch(
    url,
    RequestBodyWithAuthHeader('GET', null, { tags: ['submissions'] }, accessToken),
  );
  const meta = await getResponseMetadata(res);
  if (!meta.success) return null;
  return meta.data as Submission;
}

/**
 * Save a teacher-entered final score and optional per-item feedback.
 *
 * Replaces the broken POST .../grade endpoint that had no body and
 * therefore no way to accept a numeric score.
 */
export async function saveGrade(
  submissionUuid: string,
  gradeInput: TeacherGradeInput,
  accessToken: string,
): Promise<Submission> {
  const url = `${API()}grading/submissions/${submissionUuid}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('PATCH', gradeInput, null, accessToken));
  const meta = await getResponseMetadata(res);
  if (!meta.success) throw new Error(meta.data?.detail ?? 'Failed to save grade');

  revalidateTag('submissions');
  return meta.data as Submission;
}
