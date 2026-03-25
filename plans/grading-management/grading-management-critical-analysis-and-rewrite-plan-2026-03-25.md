# Grading Management Workflow Critical Analysis and Rewrite Plan

## Document Status

- Date: 2026-03-25
- Scope: current grading management and workflow system across backend and frontend
- Goal: define a practical rewrite and redesign plan that simplifies the model, improves UI and UX, improves developer experience, and fixes confirmed bugs and structural risks
- Basis: direct code reading in `apps/api` and `apps/web`, including both the newer unified grading v2 path and the older assignment-task submission path that still remains active in parts of the product

## Executive Summary

The grading system is not one system yet. It is two overlapping systems with a partial migration between them.

The newer path is the unified `submission` model and the `grading/*` API surface. That path is clearly the right direction: it centralizes statuses, attempts, timestamps, and teacher review into one model. The problem is that the product is still carrying a large legacy assignment-task workflow beside it. That legacy path still owns meaningful parts of the student submission and grading experience, especially inside assignment task editors.

The result is unnecessary complexity in three dimensions:

- Product complexity: teachers and students move through different grading experiences depending on assessment type and page entry point.
- Technical complexity: the codebase duplicates submission, grading, attempt, and review logic across unrelated models and APIs.
- Operational complexity: analytics, grading backlog, CSV export, permissions, and future rubric support cannot rely on a single trustworthy data contract.

The current system is usable, but it is fragile. The next step should not be another patch layer. It should be a controlled rewrite around one grading domain, one submission lifecycle, and one teacher grading workspace. And complete removal of the legacy model.

## Confirmed Current State

### Backend

The newer grading backend already exists and is materially better than the older assignment-task path.

- `apps/api/src/db/grading/submissions.py` defines a unified `Submission` model for `QUIZ`, `ASSIGNMENT`, `EXAM`, and `CODE_CHALLENGE`.
- `apps/api/src/routers/grading/submit.py` and `apps/api/src/routers/grading/teacher.py` expose student start/submit endpoints and teacher list/detail/grade endpoints.
- `apps/api/src/services/grading/submit.py` orchestrates draft creation, attempt counting, permission checks, time-limit enforcement, and automatic grading.
- `apps/api/src/services/grading/grader.py` dispatches grading by assessment type.
- `apps/api/src/services/grading/teacher.py` handles teacher list, aggregate stats, and grade persistence.

At the same time, the older assignment-task grading system is still active.

- `apps/api/src/db/courses/assignments.py` still defines `AssignmentTaskSubmission` with separate grading fields.
- `apps/api/src/services/courses/activities/assignments.py` still handles task submission, task grading, file uploads, and teacher review for assignment tasks.
- `apps/api/src/routers/courses/assignments.py` still exposes task-submission endpoints.

This means the backend has two grading data models and two grading API families.

### Frontend

The newer teacher UI already points at the unified grading backend.

- `apps/web/components/Grading/SubmissionsTable.tsx` is the teacher entry point for listing submissions.
- `apps/web/components/Grading/GradingPanel.tsx` is the teacher side panel for viewing a submission and saving a score.
- `apps/web/hooks/useSubmissions.ts`, `useSubmissionStats.ts`, `useGradingPanel.ts`, and `useMySubmission.ts` wrap the new endpoints.
- `apps/web/services/grading/grading.ts` provides the shared service client.

The student and authoring side is still mixed.

- `apps/web/app/_shared/withmenu/course/[courseuuid]/activity/[activityid]/activity.tsx` already uses the unified grading endpoint for assignment submission status.
- `apps/web/components/Grading/Student/SubmissionShell.tsx` and `SubmissionResult.tsx` provide a new student-facing shell for the unified model.
- `apps/web/app/_shared/dash/assignments/[assignmentuuid]/_components/TaskEditor/Subs/TaskTypes/TaskQuizObject.tsx` still manages timing, attempts, violations, answers, submit, and grading through the older assignment-task flow.
- `apps/web/app/_shared/dash/assignments/[assignmentuuid]/_components/TaskEditor/Subs/TaskTypes/TaskFormObject.tsx` still performs inline auto-grading and posts to the old task-submission API.
- `apps/web/components/Contexts/Assignments/AssignmentContext.tsx` and `AssignmentsTaskContext.tsx` remain part of the active architecture.

This means the frontend has one new teacher grading surface, one partial student grading surface, and several still-active legacy task-specific grading implementations.

## Current Workflow Map

### Unified v2 flow

The intended unified lifecycle is:

1. Student starts an attempt for timed assessments.
2. Backend creates a `DRAFT` submission with server-owned `started_at`.
3. Student submits answers.
4. Backend auto-grades where possible and stores `answers_json`, `grading_json`, `auto_score`, and status.
5. Teacher views submissions in a unified table.
6. Teacher reviews a submission in a side panel and saves a final score and feedback.
7. Student sees the result through the unified result shell.

### Actual workflow in the codebase

The real workflow is split:

1. Assignment-level submission state may go through the new `grading/submit` API.
2. Individual assignment tasks may still save answers and grades through `AssignmentTaskSubmission`.
3. Teacher assignment submission review uses the new `SubmissionsTable`, but many task-specific grading semantics still live elsewhere.
4. Quiz tasks inside assignment editors still track start state, attempt count, timer, violations, answers, autosave, submit, and grading locally inside a large component.
5. Analytics and backlog views assume a unified grading story, while parts of the product still produce data through older task-specific records.

The system is therefore halfway through a migration without a clean cutover.

## Critical Problems

## 1. Two competing submission models

The most important structural problem is the coexistence of `Submission` and `AssignmentTaskSubmission`.

- The new model is attempt-centric and assessment-centric.
- The old model is task-centric and assignment-task-specific.
- Both models store answers as JSON blobs.
- Both models store grades and feedback.
- Both are still used by active frontend code.

This is the main reason the workflow feels complicated. The application is paying the cost of two systems without getting the safety of either one.

## 2. The unified backend is not actually unified for all assessment types

`apps/api/src/services/grading/submit.py` calls `grade_submission(...)`, but only passes quiz-style `questions` and `user_answers`.

That creates a confirmed correctness gap:

- `AssessmentType.EXAM` in `apps/api/src/services/grading/grader.py` expects `exam_answers`, but `submit.py` never passes them.
- `AssessmentType.CODE_CHALLENGE` expects `test_results` and optionally `code_strategy`, but `submit.py` never passes them.
- Only quiz submission is wired into the unified grader with meaningful inputs.

This means the current unified grading pipeline is not truly multi-assessment yet. It is mostly a quiz plus manual-assignment pipeline with placeholders for exam and code challenge support.

## 3. The teacher grading UI is too shallow for the backend model

The backend already supports more than the teacher panel exposes.

- `TeacherGradeInput` supports `item_feedback`.
- `save_grade(...)` in `apps/api/src/services/grading/teacher.py` merges per-item feedback into `grading_json.items`.
- `GradingPanel.tsx` only exposes one overall numeric score and one overall comment.
- Manual-review items are shown as read-only text with no per-item scoring inputs.

This creates a workflow mismatch:

- The backend models item-level review.
- The teacher UI only supports submission-level review.
- Open-text or manually reviewed items can remain internally unresolved while a final score is still entered.

This is a UX problem and a correctness problem.

## 4. Manual-review semantics are inconsistent

The current manual-review logic is under-specified.

- Auto-graders mark `needs_manual_review` on items and on the breakdown.
- `save_grade(...)` clears item review flags only when item-level feedback with a score is sent.
- The fallback `still_needs_review` check uses `needs_manual_review` and missing feedback as the deciding condition.
- The current UI does not send item-level feedback at all.

That means manual-review state can become misleading:

- a teacher can save a final score without resolving manual-review items
- item scores can remain `0` while the submission gets a non-zero `final_score`
- the system has no clean concept of “partially reviewed”, “rubric pending”, or “ready to publish”

## 5. Frontend state is still fragmented across SWR, contexts, local component state, and legacy task logic

The new grading hooks are relatively clean, but they are sitting beside older state models instead of replacing them.

- `useMySubmission` and `useGradingPanel` use SWR and the unified API.
- `AssignmentContext` still pulls assignment, task list, course, and activity through a multi-request context provider.
- `AssignmentsTaskContext` remains active for task editor coordination.
- `TaskQuizObject` and `TaskFormObject` still own large workflow state locally.

This fragmentation causes three classes of problems:

- developer overhead when tracing one grading bug across systems
- duplicated validation and attempt logic
- inconsistent UI behavior when one view reads from unified submissions and another still reads from task submissions

## 6. The new teacher list is better than the old board, but it is still not a real grading workspace

`SubmissionsTable.tsx` is already an improvement over the older modal-based review flow, but it is still a thin CRUD layer.

Current limitations:

- no batch grading actions
- no queue grouping by assessment needs
- no rubric or criterion editor
- no per-item scoring controls
- no compare-to-auto-grade view
- no keyboard-first review workflow
- no learner history or prior attempts in the grading panel
- no publish vs return vs save-draft distinction

The side panel is not enough for high-volume teacher work.

## 7. Start-attempt semantics exist on the backend but are mostly not used on the web

`apps/web/services/grading/grading.ts` exports `startSubmission(...)`, but current code search shows no active source usage in the real app code outside the service definition.

This matters because the backend expects timed assessments to call `/grading/start/...` before submit. Right now:

- the timed-start contract exists
- the web still carries legacy quiz start logic in task-specific components
- the unified student shell does not fully own timed assessment lifecycle

This is a classic half-migration bug source.

## 8. Export and analytics are built on incomplete workflow assumptions

The grading export and backlog views help, but they are not yet production-grade.

- `exportGradesCSV(...)` in `apps/web/services/grading/grading.ts` fetches only the first page with `page_size=1000` and builds CSV client-side.
- That silently truncates exports once submissions exceed 1000 rows.
- `get_submission_stats(...)` in `apps/api/src/services/grading/teacher.py` still loads all submissions for an activity into memory and computes counts in Python.
- Analytics backlog components assume a unified grading funnel, while task-level legacy grading still exists elsewhere.

The teacher-facing reporting is therefore directionally correct but not yet reliable as the canonical grading operations layer.

## 9. Legacy task objects are overloaded and difficult to maintain

`TaskQuizObject.tsx` is doing far too much inside one component.

It currently mixes:

- teacher editing
- student answering
- timing
- attempt tracking
- violation tracking
- focus-mode management
- persistence
- submission
- grading
- review-state hydration

That is both a DX problem and a bug multiplier. `TaskFormObject.tsx` repeats the same pattern with different rules.

These components should not survive the rewrite as workflow owners.

## Confirmed Bugs and High-Risk Gaps

These are the most important issues to treat as real rewrite inputs, not just style concerns.

### Confirmed or strongly evidenced issues

1. Unified grading does not actually handle exam and code-challenge payloads end-to-end.
2. The teacher panel cannot enter item-level feedback even though the backend supports it.
3. Manual-review items can remain unresolved while a submission receives a final score.
4. Export truncates at 1000 rows because CSV generation is client-side over a single paged fetch.
5. Submission stats still use whole-activity in-memory aggregation.
6. The timed-start endpoint exists but is not actively used by the new web flow.
7. Legacy task-specific grading logic is still active and duplicates attempt and grading rules.
8. Assignment submission state and task submission state can diverge conceptually because they are persisted in different models.

### Likely user-facing symptoms

1. Teachers see an oversimplified grading UI that does not match the actual work required for open-ended responses.
2. Students can encounter inconsistent grading states depending on whether an activity uses new or old submission flows.
3. Large courses will eventually hit slow grading dashboards and partial exports.
4. Future additions like rubrics, moderation, second review, or grade publishing will be much harder than they need to be.

## Root Cause Analysis

The root problem is not one bug. It is architectural indecision.

The codebase has already chosen the correct domain boundary once: the unified `Submission` model. But the product has not completed the cutover, so every new improvement is being layered onto a mixed stack.

That causes several anti-patterns:

- abstraction without deletion
- shared types without shared behavior
- backend contracts that frontend workflows do not fully honor
- teacher tooling that exposes the storage layer but not the real grading workflow

The rewrite should therefore do one thing above all else: finish the migration and remove the older grading ownership points.

## Rewrite Goals

The rewrite should optimize for simplicity, consistency, and operational clarity.

### Product goals

1. One submission lifecycle for every assessment type.
2. One teacher grading workspace for every manual or hybrid review flow.
3. One student result model and one submission history model.
4. One analytics and export source of truth.

### UX goals

1. Make it obvious what needs review and why.
2. Reduce clicks for common grading flows.
3. Support both quick grading and deep grading.
4. Show attempt history, auto-grade context, and rubric context in one place.
5. Replace ambiguous statuses with clear workflow states.

### DX goals

1. Remove duplicated grading logic from task-specific components.
2. Replace JSON-shape guessing with typed payloads per assessment type.
3. Make grading services composable and testable by assessment adapter.
4. Keep the frontend on a single data-fetching and mutation pattern.

## Target Product Design

## Teacher experience

Replace the side panel-first experience with a dedicated grading workspace that can still open from tables.

The new workspace should contain:

- a queue sidebar with filters like `Needs review`, `Returned`, `Late`, `Auto-graded with overrides`, and `Ready to publish`
- a submission review surface with learner identity, attempt history, timestamps, and assessment metadata
- an answer canvas that renders by assessment type through one shared review-shell API
- a rubric or criterion panel for item-level scoring when applicable
- an overall summary panel showing auto score, teacher score, final score, status, and change history
- primary actions for `Save draft`, `Return for revision`, `Publish grade`, and `Next in queue`

This gives teachers an actual review workflow rather than a score input attached to a table row.

## Student experience

Every assessment type should adopt one student-facing lifecycle shell.

That shell should handle:

- starting attempts when required
- autosave or draft-save when supported
- submit confirmation
- post-submit state
- returned-for-revision state
- result history and attempt history

The student should not need different mental models for assignment, quiz, exam, and code challenge submission states.

## Target Technical Architecture

## 1. Make `Submission` the only grading record

Finish the migration to the unified grading model.

- Deprecate `AssignmentTaskSubmission` as a grading record.
- If task-level artifacts still matter, store them as typed submission item payloads under the unified `Submission` domain.
- Move all final-score, review-state, and feedback semantics into the unified grading model only.

## 2. Introduce typed answer payloads by assessment adapter

The current `answers_json` and `grading_json` are too permissive.

Keep JSON storage if necessary, but enforce adapter-level schemas such as:

- `QuizSubmissionPayload`
- `AssignmentSubmissionPayload`
- `ExamSubmissionPayload`
- `CodeChallengeSubmissionPayload`

Each adapter should own:

- answer validation
- draft lifecycle rules
- auto-grade support
- manual-review requirements
- review renderer metadata

## 3. Separate workflow state from grading result state

The current status model is minimal and easy to misuse. The rewrite should model workflow more explicitly.

Recommended lifecycle:

- `DRAFT`
- `SUBMITTED`
- `UNDER_REVIEW`
- `RETURNED`
- `GRADED`
- `PUBLISHED`
- `LATE` as an attribute or modifier, not a separate final state

This avoids overloading one status field with both review workflow and timing semantics.

## 4. Move teacher review to a formal review aggregate

The submission itself should remain the source of truth, but teacher review should be a first-class concept.

Suggested review structure:

- overall teacher comment
- criterion or item decisions
- rubric snapshot
- grader identity
- graded-at and published-at timestamps
- optional moderation fields

This is a cleaner basis for audits, analytics, and future multi-review workflows.

## 5. Remove workflow ownership from task components

Task components should render content, not own grading lifecycle.

They may provide:

- authoring controls in teacher mode
- answer-capture helpers in student mode
- review-render helpers in teacher mode

They should not implement their own attempt counting, grading persistence, or grade storage.

## Rewrite Plan - One shot! big bang

Deliver fast, low-risk fixes first.

1. Wire exam and code-challenge payloads correctly into the unified `grade_submission(...)` flow.
2. Add backend tests for unified exam and code-challenge submission paths.
3. Replace client-side CSV export with a backend streaming or generated export endpoint.
4. Move submission stats aggregation to SQL.
5. Add explicit telemetry for submission lifecycle transitions and grade saves.

Lock the target model before redesigning the UI.

1. Write adapter-specific schemas for all submission payloads.
2. Define the canonical workflow states and their transitions.
3. Define review-level types for item feedback, rubric scoring, and publish state.
4. Define one backend read model for teacher queue rows and one for submission review detail.
5. Add migration rules from current `grading_json` shapes into the new review schema.

This is the highest-value UX rewrite.

1. Replace the current side panel with a routeable grading workspace.
2. Keep the submissions table as an entry point, but let it open the dedicated workspace.
3. Add item-level scoring and feedback for manual-review items.
4. Add attempt history, learner context, and auto-grade comparison.
5. Add keyboard navigation and `next needs review` workflow.
6. Add `Save draft`, `Return`, and `Publish` instead of one save button.

Move all submission ownership into one reusable shell.

1. Make `startSubmission(...)` part of the real timed assessment flow.
2. Move returned-for-revision handling into the shared shell.
3. Move result display and attempt history into shared student components.
4. Remove per-task grading lifecycle ownership from `TaskQuizObject`, `TaskFormObject`, and similar components.

This is the deletion phase and should be treated as mandatory.

1. Map all remaining assignment-task submission use cases to unified submission items.
2. Backfill data where historical task-submission records still matter.
3. Cut frontend reads away from old task-submission endpoints.
4. Mark old task-submission endpoints internal or deprecated.
5. Remove `AssignmentTaskSubmission` from grading ownership.

6. Make grading backlog analytics consume the unified lifecycle only.
7. Add bulk operations for export, publish, and reminder workflows.
8. Add audit logs for teacher review actions.
9. Add queue health metrics such as time-to-first-review and time-to-published-grade.
10. Add performance budgets for list, detail, and export operations.

## UI and UX Redesign Recommendations

The current UI is functional but too flat and too form-like for a grading-heavy workflow.

### Recommended interaction model

1. Table for discovery.
2. Workspace for grading.
3. Persistent queue sidebar for movement through submissions.
4. Center canvas for answers and artifacts.
5. Right-side review summary for scores, rubric, and actions.

### Recommended visual principles

1. Use clear semantic colors for `needs review`, `returned`, `published`, and `late`.
2. Show manual-review items as structured cards, not plain text blocks.
3. Separate auto-grade evidence from teacher judgment visually.
4. Show workflow progress with explicit labels, not only badges.
5. Keep score entry anchored and always visible during review.

### Recommended teacher productivity features

1. keyboard shortcuts for next, previous, publish, and return
2. bulk return or publish for simple assessments
3. saved filters like `Open text only` and `Late submissions`
4. focus mode for one submission at a time
5. printable and exportable review artifacts

## Developer Experience Recommendations

The rewrite should intentionally make the grading system easier to reason about.

1. One API family for grading.
2. One frontend service module for grading.
3. One state-management pattern for grading data.
4. One review renderer registry keyed by assessment type.
5. One adapter interface per assessment type.

Recommended backend layering:

- router
- submission lifecycle service
- assessment adapter
- review service
- analytics/export service

Recommended frontend layering:

- route-level grading workspace
- shared query hooks
- shared submission shell
- assessment-specific answer and review renderers
- shared mutation actions

## Recommended Implementation Order - One shot it all!

If this work needs to be staged pragmatically, do it in this order:

1. fix the unified backend correctness gaps
2. design and implement the canonical grading domain contract
3. build the teacher grading workspace
4. move the student lifecycle fully onto the shared submission shell
5. delete legacy task-submission grading ownership
6. harden export, analytics, and observability

Do not reverse that order. Building a polished UI on top of the current split model will only hide the complexity, not remove it.

## Final Recommendation

Do not keep incrementally patching both grading systems.

The repository already contains the right center of gravity: the unified `Submission` domain and the newer grading endpoints. The rewrite should complete that migration, delete legacy grading ownership from assignment-task flows, and invest in one high-quality teacher grading workspace and one high-quality student submission shell.

That path will make the system:

- simpler for teachers to use
- more consistent for students
- easier to extend with rubrics and moderation
- safer for analytics and exports
- significantly easier to maintain

Important:

- Fully remove all legacy, deprecated, unused code, approaches, etc.
- Completely migration to a new approach
- Use shadcn ui design system and shadcn components
- UI messages should be localized using next-intl
