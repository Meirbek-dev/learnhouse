/**
 * Grading system type definitions.
 *
 * Replaces the scattered `any` types in AssignmentSubmissionsSubPage,
 * EvaluateAssignment, and ExamActivity components.
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
  /** Overall teacher feedback comment stored after grading */
  feedback?: string;
}

// ── Submission ───────────────────────────────────────────────────────────────

/** Typed answer payloads — discriminated by assessment_type */
export interface QuizAnswer {
  question_id: string;
  selected_option_ids: string[];
  text_answer?: string | null;
}

export interface QuizAnswers {
  answers: QuizAnswer[];
  started_at: string;   // ISO datetime — server-stamped
  submitted_at: string; // ISO datetime — server-stamped
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

  submitted_at: string | null;
  graded_at: string | null;
  created_at: string;
  updated_at: string;

  // Enriched fields populated by the teacher endpoint
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
