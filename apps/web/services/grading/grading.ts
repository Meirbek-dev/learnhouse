'use server';

/**
 * Grading API service — v2.
 */

import type {
  AssessmentType,
  BatchGradeItem,
  BatchGradeResponse,
  Submission,
  SubmissionsPage,
  SubmissionStats,
  TeacherGradeInput,
} from '@/types/grading';
import { RequestBodyWithAuthHeader, getResponseMetadata } from '@services/utils/ts/requests';
import { getServerAPIUrl } from '@services/config/config';
import { revalidateTag } from 'next/cache';

const API = () => getServerAPIUrl();

// ── Student endpoints ─────────────────────────────────────────────────────────

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

  revalidateTag('submissions', 'max');
  return meta.data as Submission;
}

export async function getMySubmissions(activityId: number, accessToken: string): Promise<Submission[]> {
  const url = `${API()}grading/submissions/me?activity_id=${activityId}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, { tags: ['submissions'] }, accessToken));
  const meta = await getResponseMetadata(res);
  if (!meta.success) return [];
  return meta.data as Submission[];
}

export async function getMySubmissionResult(submissionUuid: string, accessToken: string): Promise<Submission | null> {
  const url = `${API()}grading/submissions/me/${submissionUuid}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, { tags: ['submissions'] }, accessToken));
  const meta = await getResponseMetadata(res);
  if (!meta.success) return null;
  return meta.data as Submission;
}

// ── Teacher endpoints ─────────────────────────────────────────────────────────

export async function getSubmissionsForActivity(
  activityId: number,
  accessToken: string,
  options: {
    status?: string;
    search?: string;
    sortBy?: string;
    sortDir?: string;
    page?: number;
    pageSize?: number;
  } = {},
): Promise<SubmissionsPage> {
  const params = new URLSearchParams({ activity_id: String(activityId) });
  if (options.status) params.set('status', options.status);
  if (options.search) params.set('search', options.search);
  if (options.sortBy) params.set('sort_by', options.sortBy);
  if (options.sortDir) params.set('sort_dir', options.sortDir);
  if (options.page) params.set('page', String(options.page));
  if (options.pageSize) params.set('page_size', String(options.pageSize));

  const url = `${API()}grading/submissions?${params}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, { tags: ['submissions'] }, accessToken));
  const meta = await getResponseMetadata(res);
  if (!meta.success) return { items: [], total: 0, page: 1, page_size: 25, pages: 1 };
  return meta.data as SubmissionsPage;
}

export async function getSubmissionStats(activityId: number, accessToken: string): Promise<SubmissionStats | null> {
  const url = `${API()}grading/submissions/stats?activity_id=${activityId}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, { tags: ['submissions'] }, accessToken));
  const meta = await getResponseMetadata(res);
  if (!meta.success) return null;
  return meta.data as SubmissionStats;
}

export async function getSubmission(submissionUuid: string, accessToken: string): Promise<Submission | null> {
  const url = `${API()}grading/submissions/${submissionUuid}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, { tags: ['submissions'] }, accessToken));
  const meta = await getResponseMetadata(res);
  if (!meta.success) return null;
  return meta.data as Submission;
}

export async function saveGrade(
  submissionUuid: string,
  gradeInput: TeacherGradeInput,
  accessToken: string,
): Promise<Submission> {
  const url = `${API()}grading/submissions/${submissionUuid}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('PATCH', gradeInput, null, accessToken));
  const meta = await getResponseMetadata(res);
  if (!meta.success) throw new Error(meta.data?.detail ?? 'Failed to save grade');

  revalidateTag('submissions', 'max');
  return meta.data as Submission;
}

export async function batchGradeSubmissions(
  grades: BatchGradeItem[],
  accessToken: string,
): Promise<BatchGradeResponse> {
  const url = `${API()}grading/submissions/batch`;
  const res = await fetch(url, RequestBodyWithAuthHeader('PATCH', { grades }, null, accessToken));
  const meta = await getResponseMetadata(res);
  if (!meta.success) throw new Error(meta.data?.detail ?? 'Failed to submit batch grades');

  revalidateTag('submissions', 'max');
  return meta.data as BatchGradeResponse;
}

/**
 * Export grades for an activity as CSV.
 *
 * Uses the server-side export endpoint — no 1000-row cap, no client-side CSV generation.
 * Returns the raw CSV string for the caller to trigger a browser download.
 */
export async function exportGradesCSV(activityId: number, accessToken: string): Promise<string> {
  const url = `${API()}grading/submissions/export?activity_id=${activityId}`;
  const res = await fetch(url, RequestBodyWithAuthHeader('GET', null, null, accessToken));
  if (!res.ok) return '';
  return res.text();
}
