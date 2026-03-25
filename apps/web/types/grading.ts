/**
 * Grading system type definitions — v2.
 */

// ── Enums ────────────────────────────────────────────────────────────────────

export type SubmissionStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'GRADED'
  | 'LATE'
  | 'RETURNED';

export type AssessmentType =
  | 'QUIZ'
  | 'ASSIGNMENT'
  | 'EXAM'
  | 'CODE_CHALLENGE';

// ── Grading breakdown ────────────────────────────────────────────────────────

export interface GradedItem {
  item_id: string;
  item_text: string;
  score: number;
  max_score: number;
  correct: boolean | null;   // null for non-auto-gradeable items
  feedback: string;
  needs_manual_review: boolean;
  user_answer: unknown;
  correct_answer: unknown;
}

export interface GradingBreakdown {
  items: GradedItem[];
  needs_manual_review: boolean;
  auto_graded: boolean;
  feedback?: string;
}

// ── Submission ───────────────────────────────────────────────────────────────

export interface QuizAnswer {
  question_id: string;
  selected_option_ids: string[];
  text_answer?: string | null;
}

export interface QuizAnswers {
  answers: QuizAnswer[];
  started_at: string;
  submitted_at: string;
}

export interface AssignmentTaskAnswer {
  task_uuid: string;
  content_type: 'file' | 'text' | 'form';
  file_key?: string | null;
  text_content?: string | null;
  form_data?: Record<string, unknown> | null;
}

export interface AssignmentAnswers {
  tasks: AssignmentTaskAnswer[];
}

export interface Submission {
  id: number;
  submission_uuid: string;
  assessment_type: AssessmentType;
  activity_id: number;
  user_id: number;

  auto_score: number | null;
  final_score: number | null;

  status: SubmissionStatus;
  attempt_number: number;

  answers_json: QuizAnswers | AssignmentAnswers | Record<string, unknown>;
  grading_json: GradingBreakdown | null;

  started_at: string | null;
  submitted_at: string | null;
  graded_at: string | null;
  created_at: string;
  updated_at: string;
  grading_version: number;

  // Enriched by teacher endpoint
  user?: SubmissionUser;
}

export interface SubmissionUser {
  id: number;
  username: string;
  first_name?: string | null;
  last_name?: string | null;
  middle_name?: string | null;
  email: string;
  avatar_image?: string | null;
  user_uuid?: string | null;
}

// ── Paginated response ────────────────────────────────────────────────────────

export interface SubmissionsPage {
  items: Submission[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

// ── Aggregate stats ───────────────────────────────────────────────────────────

export interface SubmissionStats {
  total: number;
  graded_count: number;
  needs_grading_count: number;
  late_count: number;
  avg_score: number | null;
  pass_rate: number | null;
}

// ── Teacher grade input ───────────────────────────────────────────────────────

export interface ItemFeedback {
  item_id: string;
  score?: number | null;
  feedback: string;
}

export interface TeacherGradeInput {
  final_score: number;
  item_feedback?: ItemFeedback[];
  status: 'GRADED' | 'RETURNED';
  feedback?: string;
}

// ── Status display helpers ────────────────────────────────────────────────────

export const STATUS_LABELS: Record<SubmissionStatus, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  GRADED: 'Graded',
  LATE: 'Late',
  RETURNED: 'Returned',
};

export const STATUS_COLORS: Record<SubmissionStatus, string> = {
  DRAFT: 'bg-slate-100 text-slate-700',
  SUBMITTED: 'bg-amber-100 text-amber-800',
  GRADED: 'bg-emerald-100 text-emerald-800',
  LATE: 'bg-rose-100 text-rose-800',
  RETURNED: 'bg-violet-100 text-violet-800',
};
