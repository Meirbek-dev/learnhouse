# Grading System Redesign Plan

> **Branch:** `feat/analytics-dashboard`
> **Date:** 2026-03-25
> **Scope:** Full rewrite of the grading management system — backend models, services, API, and frontend UI/UX

---

## 1. Executive Summary

The current grading system is split across three disconnected subsystems (Quiz, Assignment, Code Challenge) that each reinvent the same concepts: submission tracking, status workflow, score storage, and teacher review. The result is fragmented data models, an under-built grading UI, `any`-typed React components, and missing features like manual open-text grading. This plan describes a unified redesign that is simpler to maintain, faster to extend, and dramatically better for teachers grading at scale.

---

## 2. Critical Problems Found

### 2.1 Backend

| Problem                                                                                                      | Location                                                                 | Impact                                          |
| ------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------ | ----------------------------------------------- |
| 4-table chain for one assignment submission                                                                  | `db/courses/assignments.py`                                              | Complex queries, N+1 risks                      |
| Three separate, isolated grading engines                                                                     | `quizBlock/grading.py`, `assignments.py`, `code_challenges/grading.py`   | No unified score concept                        |
| `dict`/`JSON` columns for grading results with no Pydantic schema                                            | `QuizAttempt.grading_result`, `AssignmentTaskSubmission.task_submission` | Schema drift, no validation                     |
| Client-controlled timestamps for quiz time limits                                                            | `quizBlock.py:submit_quiz`                                               | Trivially exploitable                           |
| Open-text answers always score 0, `needs_grading: True` never acted on                                       | `quizBlock/grading.py:_grade_custom_answer`                              | Broken feature, teacher has no UI to resolve it |
| XP award is fire-and-forget with no retry                                                                    | `quizBlock.py`                                                           | Silent gamification failures                    |
| `putFinalGrade` has no score input — it just flips a status                                                  | `services/courses/activities/assignments.py`                             | Teacher cannot actually enter a numeric grade   |
| Inconsistent status tracking across types                                                                    | Quiz=none, Assignment=5-state enum, Exam=separate model                  | Frontend must know each system's model          |
| `course_id`, `chapter_id`, `activity_id` duplicated on every `AssignmentTask` and `AssignmentTaskSubmission` | `db/courses/assignments.py`                                              | Denormalized, diverges from parent              |

### 2.2 Frontend

| Problem                                                               | Location                                                                     | Impact                                                      |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------------- |
| `submission: any`, `task: any` everywhere                             | `AssignmentSubmissionsSubPage.tsx`, `EvaluateAssignment.tsx`                 | No type safety, hidden bugs                                 |
| `console.log(assignmentSubmission)` left in production                | `AssignmentSubmissionsSubPage.tsx:24`                                        | Data leak in DevTools                                       |
| `globalThis.location.reload()` to refresh state after rejection       | `EvaluateAssignment.tsx:66`                                                  | Breaks SPA navigation, loses scroll position                |
| 3 nested Context Providers stacked inside a modal trigger for grading | `AssignmentSubmissionsSubPage.tsx:124-129`                                   | Over-engineered, race conditions on open                    |
| No numeric grade input in the "Evaluate" modal                        | `EvaluateAssignment.tsx`                                                     | Teacher clicks "Set Final Grade" but never enters a number  |
| Kanban with no filtering, sorting, or search for submissions          | `AssignmentSubmissionsSubPage.tsx`                                           | Unusable at scale (50+ students)                            |
| Exam activity uses `useReducer` with 5 phases + 2 sub-reducers        | `ExamActivity/`                                                              | Hard to follow, easy to reach invalid state                 |
| SWR hooks for exam data, questions, attempts all fire independently   | `ExamActivity.tsx`                                                           | Waterfall fetches, no loading coordination                  |
| Multiple parallel Context providers with duplicate session reads      | `AssignmentContext`, `AssignmentsTaskContext`, `AssignmentSubmissionContext` | Three separate SWR calls that share the same session object |

---

## 3. Redesigned Backend

### 3.1 Unified `Submission` Model

Replace the 4-table assignment chain and the isolated quiz/exam attempt tables with a single polymorphic `Submission` model. Each assessment type writes one row per student.

```python
# NEW: db/grading/submissions.py

class SubmissionStatus(StrEnum):
    DRAFT      = "DRAFT"       # student working, not yet submitted
    SUBMITTED  = "SUBMITTED"   # submitted, awaiting grading
    GRADED     = "GRADED"      # teacher (or auto-grader) set final score
    LATE       = "LATE"        # submitted after due_date
    RETURNED   = "RETURNED"    # teacher sent back for revision

class AssessmentType(StrEnum):
    QUIZ            = "QUIZ"
    ASSIGNMENT      = "ASSIGNMENT"
    EXAM            = "EXAM"
    CODE_CHALLENGE  = "CODE_CHALLENGE"

class Submission(SQLModel, table=True):
    id:              int | None  = Field(default=None, primary_key=True)
    submission_uuid: str         = Field(index=True)

    # What is being submitted
    assessment_type: AssessmentType
    activity_id:     int         = Field(foreign_key="activity.id", ondelete="CASCADE")

    # Who submitted
    user_id:         int         = Field(foreign_key="user.id", ondelete="CASCADE")

    # Scores — always 0-100 percentage
    auto_score:      float | None = None   # set by auto-grader
    final_score:     float | None = None   # set by teacher (or copied from auto_score)

    # Workflow
    status:          SubmissionStatus = SubmissionStatus.DRAFT
    attempt_number:  int              = 1

    # Typed payload — validated by Pydantic before storage
    answers_json:    dict = Field(sa_column=Column(JSON))   # typed by assessment_type
    grading_json:    dict = Field(sa_column=Column(JSON))   # per-question breakdown

    # Timestamps
    submitted_at:  datetime | None = None
    graded_at:     datetime | None = None
    created_at:    datetime        = Field(default_factory=datetime.utcnow)
    updated_at:    datetime        = Field(default_factory=datetime.utcnow)
```

**What this replaces:**

- `AssignmentTaskSubmission` (one per task) → one `Submission` row per assignment
- `AssignmentUserSubmission` (status tracker) → merged into `Submission.status`
- `QuizAttempt` → one `Submission` row per attempt
- Denormalized `course_id`, `chapter_id` on every task row → look up via `activity_id`

**Typed payload schemas (validated before saving):**

```python
# grading/schemas.py

class QuizAnswers(BaseModel):
    answers: list[QuizAnswer]    # {question_id, selected_option_ids, text_answer}
    started_at: datetime         # server-stamped on quiz start, NOT client-provided
    submitted_at: datetime       # server-stamped on receive

class AssignmentAnswers(BaseModel):
    tasks: list[AssignmentTaskAnswer]  # {task_uuid, content_type, file_key | text | form_data}

class GradingBreakdown(BaseModel):
    items: list[GradedItem]      # per-question or per-task score+feedback
    needs_manual_review: bool    # true if any open-text question present
    auto_graded: bool
```

### 3.2 Unified Grading Service

One entry point for all assessment types instead of three separate files:

```python
# NEW: services/grading/grader.py

class GradingResult(BaseModel):
    auto_score: float
    breakdown:  GradingBreakdown
    needs_manual_review: bool

def grade_submission(
    assessment_type: AssessmentType,
    content: dict,           # the activity's block content (questions, rubric, etc.)
    answers: BaseModel,      # typed answer payload
    settings: BaseModel,     # assessment settings
    attempt_number: int,
) -> GradingResult:
    match assessment_type:
        case AssessmentType.QUIZ:
            return _grade_quiz(content, answers, settings, attempt_number)
        case AssessmentType.EXAM:
            return _grade_exam(content, answers, settings, attempt_number)
        case AssessmentType.CODE_CHALLENGE:
            return _grade_code_challenge(content, answers, settings)
        case AssessmentType.ASSIGNMENT:
            return GradingResult(auto_score=0, breakdown=..., needs_manual_review=True)
```

**Key improvements:**

- Quiz time limits use **server-recorded** `started_at` (stored when the student clicks "Start"), not client-provided timestamps
- Attempt penalty is applied inside `_grade_quiz` with the formula isolated and unit-tested
- Open-text questions produce a `ManualReviewItem` that surfaces in the teacher grading UI
- All intermediate results validated with Pydantic before touching the DB

### 3.3 Teacher Grading API

Replace the confusing `putFinalGrade` (which had no grade input) with a clear endpoint:

```
# REMOVED
POST /assignments/{uuid}/submissions/{user_id}/grade   # no body, just flips status

# NEW — single endpoint for all assessment types
PATCH /grading/submissions/{submission_uuid}
Body: {
  "final_score": 87,           # 0-100
  "item_feedback": [           # optional per-item comments
    { "item_id": "q1", "score": 10, "feedback": "Good analysis" }
  ],
  "status": "GRADED" | "RETURNED"
}
```

### 3.4 Backend File Structure (after)

```
apps/api/src/
├── db/
│   └── grading/
│       ├── submissions.py     # Submission model
│       └── schemas.py         # Typed answer/grading payloads
├── services/
│   └── grading/
│       ├── grader.py          # Unified grade_submission()
│       ├── quiz_grader.py     # Quiz-specific logic
│       ├── exam_grader.py     # Exam-specific logic
│       ├── code_grader.py     # Code challenge logic
│       └── submit.py          # submit_assessment() orchestrator
└── routes/
    └── grading/
        ├── submit.py          # POST /grading/submit/{activity_id}
        └── teacher.py         # PATCH /grading/submissions/{uuid}
                               # GET  /grading/submissions?activity_id=&status=
```

---

## 4. Redesigned Frontend

### 4.1 Student Submission Experience

**Current:** Each activity type has its own flow. Assignment renders 3 task type components with no unified submit action.

**New:** One `<SubmissionShell>` wraps any activity type, providing a consistent chrome: attempt count, due date, status badge, and submit button.

```
┌─────────────────────────────────────────────────────┐
│  Assignment: "Case Study Analysis"                  │
│  Due: Apr 10 · 2 attempts remaining · DRAFT         │
│─────────────────────────────────────────────────────│
│                                                     │
│  Task 1: Upload your analysis PDF          [Upload] │
│  Task 2: Short reflection (300 words)      [typed]  │
│                                                     │
│─────────────────────────────────────────────────────│
│         [Save Draft]          [Submit for Grading]  │
└─────────────────────────────────────────────────────┘
```

- Single "Submit for Grading" button at the bottom, disabled until all required tasks are filled
- "Save Draft" persists locally and to the server without changing status
- Status badge updates optimistically

### 4.2 Teacher Grading Interface

**Current:** A 3-column kanban board (Late | Submitted | Graded) with fixed 350px cards, no filtering, and a modal with no grade input.

**New:** A data table with inline grading.

#### 4.2.1 Submissions Table (replaces kanban)

```
┌────────────────────────────────────────────────────────────────────────────┐
│  Submissions for "Case Study Analysis"                                     │
│  Filter: [All ▾]  [Submitted ▾]  [Late ▾]  Search: [____________]  [CSV] │
│────────────────────────────────────────────────────────────────────────────│
│  Student         Submitted     Status      Score   Action                  │
│  ────────────    ──────────    ────────    ─────   ──────                  │
│  Alice Smith     Apr 8, 9am    SUBMITTED   —       [Grade ▸]               │
│  Bob Jones       Apr 9, 11pm   LATE        —       [Grade ▸]               │
│  Carol Lee       Apr 7, 3pm    GRADED      88/100  [View ▸]                │
│────────────────────────────────────────────────────────────────────────────│
│  Showing 3 of 42                              [← Prev]  Page 1/5  [Next →] │
└────────────────────────────────────────────────────────────────────────────┘
```

- Status filter tabs: All / Needs Grading / Graded / Late
- Search by student name or email
- Sort by submitted_at, score, name
- Grading backlog count displayed in the header: "14 need grading"

#### 4.2.2 Grading Panel (replaces modal + 3 nested providers)

Clicking "Grade ▸" opens a **side panel** (not a modal) so the teacher can scroll through student work without losing context.

```
┌──── Student Submission ──────────────────────────────────┐
│  Alice Smith · Case Study Analysis · Submitted Apr 8     │
│──────────────────────────────────────────────────────────│
│  Task 1: Upload                                          │
│  [PDF Viewer / File Preview]                             │
│                                                          │
│  Task 2: Reflection                                      │
│  "The case demonstrates how supply chains..."            │
│──────────────────────────────────────────────────────────│
│  Final Score   [____] / 100    ← number input           │
│  Feedback      [_________________________]  (optional)   │
│                                                          │
│  [← Previous]  [Return to Student]  [Save Grade →]      │
└──────────────────────────────────────────────────────────┘
```

- "Previous / Next" navigation between ungraded submissions without closing the panel
- `Return to Student` sets status to `RETURNED` with the feedback visible to the student
- Score input is a controlled `<input type="number" min={0} max={100}>` with validation
- Auto-advances to next ungraded submission after "Save Grade"

### 4.3 Component & Data Architecture

#### Remove 3 nested Context Providers

**Current:**

```tsx
// Inside a modal trigger render prop:
<AssignmentProvider assignment_uuid={...}>
  <AssignmentsTaskProvider>
    <AssignmentSubmissionProvider assignment_uuid={...}>
      <EvaluateAssignment user_id={user_id} />
    </AssignmentSubmissionProvider>
  </AssignmentsTaskProvider>
</AssignmentProvider>
```

**New:** One hook that fetches everything needed for the grading panel in a single call:

```ts
// hooks/useGradingPanel.ts
function useGradingPanel(submissionUuid: string) {
  // Single SWR call to GET /grading/submissions/{uuid}?include=activity,tasks,answers
  const { data, mutate } = useSWR<GradingPanelData>(
    `/grading/submissions/${submissionUuid}`,
    fetcher
  )
  return { submission: data, mutate }
}
```

#### Typed grading state (replace `any`)

```ts
// types/grading.ts

export type SubmissionStatus = 'DRAFT' | 'SUBMITTED' | 'GRADED' | 'LATE' | 'RETURNED'
export type AssessmentType = 'QUIZ' | 'ASSIGNMENT' | 'EXAM' | 'CODE_CHALLENGE'

export interface Submission {
  submission_uuid: string
  assessment_type: AssessmentType
  status: SubmissionStatus
  auto_score: number | null
  final_score: number | null
  submitted_at: string | null
  graded_at: string | null
  user: PublicUser
  answers: AssignmentAnswers | QuizAnswers   // discriminated union
  grading: GradingBreakdown | null
}

export interface GradingBreakdown {
  items: GradedItem[]
  needs_manual_review: boolean
  auto_graded: boolean
}
```

#### Simplified Exam Activity state

**Current:** `useReducer(examFlowReducer)` + `useReducer(examTakingReducer)` + multiple SWR hooks firing independently.

**New:** One SWR call with `suspense: true` to fetch the exam config + prior attempts together, then a single flat state object:

```ts
interface ExamState {
  phase: 'pre' | 'taking' | 'submitted' | 'results'
  currentQuestionIndex: number
  answers: Record<string, string[]>
  startedAt: string | null   // server-stamped, not local Date.now()
}
```

Phase transitions are simple `setState` calls — no reducer needed.

### 4.4 Frontend File Structure (after)

```
apps/web/
├── types/
│   └── grading.ts                    # All grading types (replaces scattered `any`)
├── hooks/
│   ├── useGradingPanel.ts            # Single hook for grading side panel
│   └── useSubmissions.ts             # Hook for submissions table (with filters/pagination)
├── services/grading/
│   └── grading.ts                    # API calls: submitAssessment, saveGrade, returnSubmission
└── components/
    └── Grading/
        ├── SubmissionsTable.tsx      # Teacher view: paginated, filterable table
        ├── GradingPanel.tsx          # Side panel with file preview + score input
        ├── SubmissionStatusBadge.tsx # Shared status pill
        └── Student/
            ├── SubmissionShell.tsx   # Wraps any assessment type for student
            └── SubmitButton.tsx      # Unified submit action
```

---

## 5. Migration Strategy - One shot everything

1. Create `db/grading/submissions.py` with the new `Submission` model
2. Write a migration script that copies existing `AssignmentUserSubmission` + `QuizAttempt` rows into `Submission`
3. Add new routes `/grading/submit/{activity_id}` and `/grading/submissions/{uuid}` alongside existing routes (no removal yet)
4. Add server-side quiz start timestamp: `POST /grading/start/{activity_id}` stores `started_at` in `Submission` with `status=DRAFT`
5. Add typed Pydantic schemas for `QuizAnswers` and `AssignmentAnswers`; validate on write
6. Build `SubmissionsTable` component backed by the new `/grading/submissions?activity_id=` endpoint
7. Build `GradingPanel` side panel with real score input backed by `PATCH /grading/submissions/{uuid}`
8. Replace `EvaluateAssignment` modal + 3 providers with `GradingPanel` + `useGradingPanel` hook
9. Remove `console.log`, remove `globalThis.location.reload()`, add proper SWR `mutate()` invalidation
10. Replace all `any` types with the new `Submission` type
11. Build `SubmissionShell` that works for all assessment types
12. Migrate assignment student view to use `SubmissionShell`
13. Simplify `ExamActivity` state from 2 reducers + 4 SWR hooks to 1 SWR + flat state
14. Deprecate old assignment routes (`/assignments/{uuid}/submissions/{user_id}/grade`)
15. Remove `AssignmentTaskSubmission` and `AssignmentUserSubmission` tables after data migration is verified
16. Remove `AssignmentSubmissionContext`, `AssignmentsTaskContext` providers
17. Remove `AssignmentSubmissionsSubPage.tsx` kanban
18. Archive `services/quizBlock/quizBlock.py` orchestrator (logic moves into `services/grading/submit.py`)
19. Fully remove all deprecated, legacy, unused, backward compatibility code and migrate to new grading system

---

## 6. What Is NOT Changing

- Quiz question editor and question types
- Exam anti-cheat settings (copy paste protection, tab detection, etc.)
- Code challenge test runner and execution engine
- Analytics aggregation (`services/analytics/assessments.py`) — it will read from the new `Submission` table via a thin adapter
- RBAC / permission system
- XP / gamification hook (kept as-is, but wrapped in a proper error boundary with logging)
- File upload infrastructure (reference files and submission files)

---

## 7. Key Metrics for Success

| Metric                                                         | Current      | Target        |
| -------------------------------------------------------------- | ------------ | ------------- |
| DB tables touched to read one graded assignment submission     | 4            | 1             |
| React Context providers mounted for teacher grading modal      | 3            | 0 (hook only) |
| TypeScript `any` in grading components                         | ~12          | 0             |
| Time for teacher to enter a numeric grade                      | Not possible | < 3 clicks    |
| Open-text questions that surface to teacher for manual grading | 0 (no UI)    | All           |
| Client-controlled quiz time limits                             | Yes          | No            |
| `console.log` in production grading code                       | 1            | 0             |
