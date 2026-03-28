# Grading System — Critical Analysis & Rewrite Plan

> Generated: 2026-03-28
> Scope: `apps/api/src/services/grading/`, `apps/api/src/routers/grading/`, `apps/web/components/Grading/`, `apps/web/types/grading.ts`, `apps/web/services/grading/`, `apps/web/hooks/`

---

## 1. Current State Summary

The system was clearly rewritten once already (the "v2" and "Bx fix" comments throughout). That rewrite solved real DB-level bugs (in-memory pagination, client-falsifiable timestamps, attempt-counting holes). The data model is sound. What remains are two categories of problem:

- **Structural debt** accumulated during the bugfix rewrite — logic that was patched rather than redesigned.
- **UX/DX rough edges** that make the teacher workflow error-prone and the codebase hard to extend.

---

## 2. Backend — Problems

### 2.1 `submit.py` is an overloaded god-function

`submit_assessment()` (321 lines total in the service, 289 in the function body) does all of this in one shot:

1. Permission check
2. DRAFT lookup (or inline creation for ASSIGNMENT only)
3. Attempt limit enforcement
4. Time limit enforcement
5. Violation count enforcement
6. Payload parsing for three different answer shapes (quiz/exam/code challenge)
7. Grading dispatch
8. Late detection
9. Status transition
10. DB persist
11. XP award

Every one of those steps is interleaved with the others. Adding a new check (e.g. an IP-based submission block) means finding the right spot in the middle of this function. Testing any single concern requires stubbing everything else.

**Concrete bugs this enables:**

- ASSIGNMENT type gets its attempt counted **twice**: once in `start_submission` if called, and again inside `submit_assessment` because it skips the DRAFT check. The duplicate-count path can assign `attempt_number = 2` for a student's first-ever assignment submission if they happened to call `start` beforehand.
- Violation enforcement only fires if *both* `track_violations` AND `block_on_violations` are truthy. A settings dict with only `track_violations: true` silently ignores violations.

### 2.2 Business logic lives in the router

`apps/api/src/routers/grading/submit.py:71–105` fetches questions and settings from the DB and builds the `settings` dict directly in the router. This means:

- The router imports `Block` and `QuizSettings` DB models — a layer violation.
- ASSIGNMENT and CODE_CHALLENGE receive an empty `settings={}` — no due-date enforcement for those types.
- The exam settings extraction (`block.content.get("settings", {}).get(...)`) duplicates keys that quiz settings already handles via `QuizSettings`.

### 2.3 `_grade_multiple_choice` has 6-alias answer-ID resolution

```python
raw_selected = (
    user_answer.get("answer_id")
    or user_answer.get("selected_option_id")
    or user_answer.get("selected_options")
    or user_answer.get("selected_options_id")
    or user_answer.get("selected_option_ids")
    or user_answer.get("selected_option")
)
```

This is a fossil of prior schema drift. It means the frontend can submit answers in any of six shapes and the server accepts all of them — silently. There is no validation that the submitted format matches the expected schema, making it impossible to know which format is "current".

### 2.4 `get_submission_stats` fires 5 separate SQL queries

```python
total   = db_session.exec(select(func.count()).where(...)).one()
graded  = db_session.exec(select(func.count()).where(...)).one()
needs   = db_session.exec(select(func.count()).where(...)).one()
late    = db_session.exec(select(func.count()).where(...)).one()
scores  = db_session.exec(select(Submission.final_score).where(...)).all()
```

A single `SELECT status, COUNT(*), AVG(final_score)... GROUP BY status` followed by Python aggregation would reduce this to one round-trip.

### 2.5 CSV export is unsafe

```python
lines.append(
    f'"{name}","{email}",{s.attempt_number},{s.status},{submitted},'
    f"{s.auto_score if s.auto_score is not None else ''},"
    f"{s.final_score if s.final_score is not None else ''}"
)
```

A student name containing a double-quote (`O"Brien`) or a newline breaks the CSV. The status and score columns are not quoted. Python's `csv` module handles this correctly and is one import away.

### 2.6 `save_grade` does fragile dict surgery on `grading_json`

```python
item_map = {item["item_id"]: item for item in existing_items}
for fb in grade_input.item_feedback:
    if fb.item_id in item_map:
        item_map[fb.item_id]["feedback"] = fb.feedback
        ...
    else:
        item_map[fb.item_id] = GradedItem(...).model_dump()
```

This manually reconstructs `GradedItem` dicts by key mutation. If a new field is added to `GradedItem`, the merge silently drops it from items that weren't updated. The `isinstance(fb, dict)` guard (line 394) suggests this was hit once before.

### 2.7 `SubmissionRead.grading_json` is typed as `dict`

The read model's most important field — `grading_json: dict` — is completely opaque to type checkers. Callers get an untyped blob and must re-validate it themselves (or not at all). The `GradingBreakdown` Pydantic model already exists; `SubmissionRead` should embed it directly.

### 2.8 `datetime.utcnow` is deprecated

`created_at` and `updated_at` use `datetime.utcnow` (`submissions.py:238,242`), which is deprecated since Python 3.12. The rest of the service already uses `datetime.now(UTC)`.

### 2.9 `mark_under_review` fires a separate user lookup

```python
result = SubmissionRead.model_validate(submission)
user = db_session.exec(select(User).where(User.id == submission.user_id)).first()
```

Same N+1 pattern avoided elsewhere with `users_by_id` batching, but replicated here.

---

## 3. Frontend — Problems

### Rewrite grading panel: remove custom drawer panel and use shadcn ui's drawer component.

### 3.1 Silent data loss on panel navigation

`GradingPanel.tsx:64–87` resets all local state when `submissionUuid` changes:

```tsx
useEffect(() => {
  if (submissionUuid === null) { setScore(''); setFeedback(''); setItemFeedbacks({}); return; }
  setScore(submission?.final_score != null ? String(submission.final_score) : '');
  ...
}, [submissionUuid, submission?.final_score, submission?.grading_json]);
```

If a teacher edits the score, clicks "Next" without saving, **all edits are silently discarded**. There is no dirty-state guard, no "unsaved changes" prompt, nothing. This is the most critical UX bug in the system.

### 3.2 Double-fire `useEffect` dependency

The effect depends on both `submission?.final_score` and `submission?.grading_json`. When the SWR revalidation returns a freshly saved grade, both fields change simultaneously, which means the effect runs twice and resets the form twice. For most users this is invisible (the second reset is a no-op), but it creates a window where controlled inputs briefly show the old value between renders.

### 3.3 Navigation is bounded by the current page

```tsx
const allUuids = submissions.map((s) => s.submission_uuid);
```

`allSubmissionUuids` passed to `GradingPanel` is only the UUIDs on the currently-loaded page (25 entries). Once the teacher navigates to the last item on the page, "Next" is disabled — even if there are 50 more ungraded submissions on the next page.

### 3.4 Post-save navigation race condition

```tsx
const handleGradeSaved = useCallback((updated: Submission) => {
  mutate();  // async — triggers refetch
  const currentIndex = allUuids.indexOf(updated.submission_uuid);
  const nextIndex = allUuids.findIndex(      // runs synchronously against stale array
    (uuid, i) => i > currentIndex && needsTeacherAction(submissions.find(...))
  );
  if (nextIndex !== -1) setOpenSubmissionUuid(allUuids[nextIndex] ?? null);
}, [allUuids, submissions, mutate]);
```

`mutate()` is async, but the auto-advance logic runs synchronously against the pre-revalidation `submissions` array. If the just-graded submission changed status (it did), `needsTeacherAction` will still return `true` for it from the stale snapshot, potentially re-opening the same submission.

### 3.5 Three API calls for stats (duplicated SWR keys)

`SubmissionsTable` calls `useSubmissionStats(activityId)` (line 63). Then it renders `<GradingStats activityId={activityId} />` which calls `useSubmissionStats(activityId)` again (GradingStats.tsx:40). Because both components are mounted under the same parent and use the same SWR key, this deduplicates to one network request — but it's still two independent hook calls managing the same data.

Additionally, `needsGradingCount` on line 64 of `SubmissionsTable` has a confusing dual-source:

```tsx
const needsGradingCount = activeFilter === 'NEEDS_GRADING' ? total : (stats?.needs_grading_count ?? 0);
```

When the filter is `NEEDS_GRADING`, `total` comes from the paginated list response. Otherwise it comes from the stats. These two counts can briefly diverge, showing inconsistent numbers.

### 3.6 Score is a string all the way through

The teacher's score input is a `string` state (`const [score, setScore] = useState<string>('')`), parsed with `Number.parseFloat` at save time. Validation is manual:

```tsx
const scoreInvalid = score !== '' && (Number.isNaN(scoreNum) || scoreNum < 0 || scoreNum > 100);
const canSave = !isSaving && score !== '' && !scoreInvalid;
```

`score === ''` disables saving even if the auto-score is the right answer. Teacher has to re-type the auto-score to save. The intended shortcut of "click Save to confirm auto-score" doesn't exist.

### 3.7 `SubmissionShell` passes `currentStatus={null}` for re-submit

```tsx
{canResubmit && (
  <SubmitButton
    currentStatus={null}   // ← lying: actual status is RETURNED
    ...
  />
)}
```

`SubmitButton` receives `null` when status is `RETURNED`, which causes it to use the first-submission code path (calling `start_submission` before submitting) even though the student is on a re-submission. The submit flow may work by coincidence (DRAFT is created idempotently) but the intent is wrong and fragile.

### 3.8 `answers_json` union type isn't narrowed

```ts
answers_json: QuizAnswers | AssignmentAnswers | ExamAnswers | CodeChallengeAnswers | Record<string, unknown>;
```

This union is never narrowed in any component. Every consumer falls back to `JSON.stringify` for any structured answer. There's no rendering logic that understands quiz option labels, assignment file names, or code challenge test results — they all show as raw JSON in the grading panel.

### 3.9 Duplicated answer-display logic

`AnswerItem` in `GradingPanel.tsx` and `ResultItem` in `SubmissionResult.tsx` both render:

- Student answer (with `JSON.stringify` fallback)
- Correct answer (only if wrong)
- Item feedback

They are nearly identical (~40 lines each) and will inevitably diverge.

### 3.10 No URL state for teacher workflow

Refreshing the submissions page resets the teacher's position (filter, search, sort, pagination, open submission). Teachers navigating back from a student's profile page have to reconstruct their working context.

---

## 4. Rewrite Plan

These are safe, isolated changes that reduce risk before the larger rewrite.

| #    | File                         | Fix                                                                                                 |
| ---- | ---------------------------- | --------------------------------------------------------------------------------------------------- |
| P0-1 | `submissions.py:238,242`     | Replace `datetime.utcnow` with `datetime.now(UTC)`                                                  |
| P0-2 | `teacher.py:290–350`         | Replace manual CSV string-building with `import csv; csv.writer(io.StringIO())`                     |
| P0-3 | `quiz_grader.py:125–132`     | Document the 6-alias answer lookup; add a TODO to consolidate once frontend is updated              |
| P0-4 | `GradingPanel.tsx:106–137`   | Add dirty-state guard before navigation: if `isDirty`, show confirmation dialog before `onNavigate` |
| P0-5 | `SubmissionsTable.tsx:68–85` | Fix post-save auto-advance: use the `updated` submission's new status, not the stale list           |

## Extract settings loading from the router

Create `services/grading/settings_loader.py`:

```python
async def load_activity_settings(
    activity_id: int,
    assessment_type: AssessmentType,
    db_session: Session,
) -> AssessmentSettings:
    """Load questions and grading settings for any assessment type."""
```

`AssessmentSettings` is a typed dataclass (not a raw dict) with fields: `questions`, `max_attempts`, `time_limit_seconds`, `max_score_penalty_per_attempt`, `due_date_iso`, `track_violations`, `block_on_violations`, `max_violations`.

The router calls this before `submit_assessment`. The service receives `AssessmentSettings`, not a raw `dict`.

Break the monolith into small, testable steps:

```python
# New structure in submit.py

async def submit_assessment(request, activity_id, assessment_type, answers_payload, current_user, db_session) -> SubmissionRead:
    settings = await load_activity_settings(activity_id, assessment_type, db_session)
    draft = _get_or_create_draft(activity_id, assessment_type, current_user, db_session)
    _enforce_attempt_limit(draft, settings, activity_id, current_user.id, db_session)
    _enforce_time_limit(draft, settings)
    violation_exceeded = _check_violations(settings, violation_count)
    result = grade_submission(...)
    status = _resolve_status(assessment_type, result, settings, now)
    _persist(draft, answers_payload, result, status, violation_exceeded, db_session)
    await _award_xp_if_passed(...)
    return SubmissionRead.model_validate(draft)
```

Each private function is individually testable with no HTTP dependencies.

The duplicate attempt-counting for ASSIGNMENT moves into `_get_or_create_draft`, which handles both the DRAFT-exists and no-DRAFT paths with one shared counting query.

Change:

```python
grading_json: dict = SQLField(default_factory=dict)
```

To:

```python
grading_json: GradingBreakdown = SQLField(
    default_factory=GradingBreakdown,
    sa_column=Column(JSON),
)
```

Add a `@field_validator("grading_json", mode="before")` that coerces `dict → GradingBreakdown`. This makes the read model strongly typed end-to-end: the frontend's `grading_json` field becomes `GradingBreakdown` (not `GradingBreakdown | null | dict`).

#### Consolidate stats into one query

Replace the 5-query pattern in `get_submission_stats` with:

```sql
SELECT
  status,
  COUNT(*) AS cnt,
  AVG(CASE WHEN status IN ('GRADED','PUBLISHED') THEN final_score END) AS avg_score
FROM submission
WHERE activity_id = :activity_id
  AND status != 'DRAFT'
GROUP BY status
```

Aggregate in Python from the rows. One round-trip, same result.

#### Fix `save_grade` merge logic

Replace the dict-mutation approach with a model-aware merge:

```python
existing = GradingBreakdown.model_validate(submission.grading_json)
item_map = {item.item_id: item for item in existing.items}
for fb in grade_input.item_feedback:
    if fb.item_id in item_map:
        item_map[fb.item_id] = item_map[fb.item_id].model_copy(update={
            "feedback": fb.feedback,
            **({"score": fb.score, "needs_manual_review": False} if fb.score is not None else {}),
        })
```

Model-level merge: new fields in `GradedItem` are automatically preserved. No `isinstance` guards needed.

#### Consolidate `mark_under_review` user lookup

Join `User` in the initial `select(Submission)` query, same as `get_submissions_for_activity`. Remove the second query.

---

### Frontend restructure

#### Dirty-state guard in GradingPanel

Add `isDirty` state that becomes `true` when the teacher modifies any field. Before navigating (prev/next) or closing, show an `AlertDialog`: "You have unsaved changes. Discard and continue?"

```tsx
const isDirty = useMemo(
  () => score !== initialScore || feedback !== initialFeedback || hasItemFeedbackChanges,
  [score, feedback, itemFeedbacks, initialScore, initialFeedback]
);
```

`initialScore` and `initialFeedback` are separate state that only update on successful save or panel switch (not on every SWR revalidation).

#### Fix the useEffect dependency

Separate "reset on new submission" from "pre-fill from server":

```tsx
// Reset form when the submission UUID changes
useEffect(() => {
  setScore('');
  setFeedback('');
  setItemFeedbacks({});
  setIsDirty(false);
}, [submissionUuid]);   // only submissionUuid

// Pre-fill once the submission data arrives (but only if form is clean)
useEffect(() => {
  if (!submission || isDirty) return;
  setScore(submission.final_score != null ? String(submission.final_score) : '');
  ...
}, [submission?.id]);   // only when a different submission entity loads
```

#### Auto-fill score from auto_score

When `score === ''` and `submission.auto_score != null`, show a clickable hint:

```tsx
{score === '' && submission?.auto_score != null && (
  <button
    type="button"
    className="text-xs text-blue-600 underline"
    onClick={() => setScore(String(submission.auto_score))}
  >
    Use auto-score ({submission.auto_score})
  </button>
)}
```

This removes the friction of re-typing the auto-score for auto-gradeable quizzes with open-text questions.

#### Add per-status counts to filter tabs

The `useSubmissions` hook already returns `total` for the filtered view. Extend the tab rendering:

```tsx
<TabsTrigger value={opt.value}>
  {t(opt.labelKey)}
  {opt.value !== 'ALL' && statusCounts[opt.value] != null && (
    <span className="ml-1.5 rounded-full bg-slate-200 px-1.5 text-xs tabular-nums">
      {statusCounts[opt.value]}
    </span>
  )}
</TabsTrigger>
```

`statusCounts` comes from the stats endpoint, which already has `total`, `graded_count`, `needs_grading_count`, `late_count`. Map the remaining statuses from the stats rather than a separate query.

#### Infinite-scroll or cross-page navigation

Replace the bounded `allSubmissionUuids` with a cursor/window approach:

- Track `openSubmissionUuid` in `SubmissionsTable`
- When teacher is at the last item on the page and clicks Next, auto-advance `page` before opening the next submission
- Or: fetch all UUIDs for the current filter (IDs only, no full data) as a separate lightweight query and pass those as the navigation list

The simpler fix: bump `page` when navigating past the edge, and let the `useSubmissions` hook refetch.

#### URL state for teacher workflow

Use `nuqs` (already likely in the project given Next.js usage) or Next.js `useSearchParams` to persist:

```
/assignments/[uuid]/submissions?status=NEEDS_GRADING&sort=submitted_at&page=2&open=submission_01HXX...
```

Refreshing the page restores the teacher's exact position. Sharing the URL opens the same submission for a co-teacher.

#### Unify answer rendering

Extract a shared `<AnswerDisplay item={item} />` component used by both `GradingPanel` and `SubmissionResult`. Add assessment-type-aware rendering:

- **Quiz**: Show selected option text (not raw option UUID)
- **Assignment**: Show file link or text content
- **Exam**: Show selected option text
- **Code challenge**: Show test result table (pass/fail per test case with weights)

Currently all of these render as `JSON.stringify(item.user_answer)` — essentially useless for file submissions or structured answers.

#### Fix `SubmissionShell` RETURNED re-submit

Pass the actual status:

```tsx
{canResubmit && (
  <SubmitButton
    currentStatus="RETURNED"   // not null
    ...
  />
)}
```

Update `SubmitButton` to: if `currentStatus === 'RETURNED'`, call `start_submission` to create a new DRAFT, then submit. (This is already what should happen; passing `null` just hides the intent.)

---

### UX redesign

#### Status model simplification

The 7-status model creates edge cases in every component. Proposed simplification:

| Old          | New                                 | Notes                                                                         |
| ------------ | ----------------------------------- | ----------------------------------------------------------------------------- |
| DRAFT        | DRAFT                               | Unchanged                                                                     |
| SUBMITTED    | PENDING                             | Renamed for clarity                                                           |
| LATE         | PENDING (with `is_late: bool` flag) | LATE is a modifier, not a state — make it explicit                            |
| UNDER_REVIEW | PENDING                             | Collapsed: "teacher has opened it" is an internal detail, not student-visible |
| GRADED       | GRADED                              | Teacher-only visibility                                                       |
| PUBLISHED    | PUBLISHED                           | Student-visible                                                               |
| RETURNED     | RETURNED                            | Unchanged                                                                     |

This reduces 7 states to 5 (`DRAFT`, `PENDING`, `GRADED`, `PUBLISHED`, `RETURNED`) and makes `is_late` a boolean column on the `Submission` table instead of a status modifier. The UI only needs to handle 5 cases.

This is a **breaking change** — requires a migration and frontend update. Worth it before the system scales.

#### Grading panel layout

Current layout problems:

- Score and feedback are in the footer, but item-level scores are inline in the scroll area. Teacher has to scroll up to see items, then scroll down to enter the final score.
- Publish and Save are two separate buttons with confirmation dialogs — 3–4 clicks to publish a grade.
- The panel header wastes space repeating info visible in the table row.

Proposed layout:

```
┌─────────────────────────────────────┐
│ [←] Student Name  Attempt #2  LATE  │  (compact header)
├─────────────────────────────────────┤
│ Auto-score: 78/100                   │
│ ┌──────────────┐                    │
│ │ Final: [__]  │ ← type or click    │
│ │ /100         │   "use 78"         │
│ └──────────────┘                    │
├─────────────────────────────────────┤  (sticky, not in scroll area)
│ [Item 1]  ✓ correct  12/15          │
│ [Item 2]  ✗ wrong    0/20           │
│   Your answer: X / Correct: Y       │
│ [Item 3]  ⚠ needs review  0/30     │
│   Student wrote: "..."              │
│   Score: [__] /30   Feedback: [__]  │
├─────────────────────────────────────┤
│ Overall feedback: [__________]      │
│                                     │
│ [Return for revision] [Save] [Publish →] │
└─────────────────────────────────────┘
```

Key changes:

- Score entry is at the top (visible without scrolling)
- "Save" and "Publish" are collapsed into a split button: default action is Publish (most common for auto-graded quizzes), with Save as secondary
- Keyboard: `Tab` through item scores, `Cmd+Enter` to publish

#### Student result view

Currently the student sees their grade only after PUBLISHED. The `GRADED` state is invisible to them ("Graded" in the banner but no score). Make it explicit:

```
SUBMITTED:     "Your work is being reviewed."
UNDER_REVIEW:  (same — students don't need to know this internal state)
GRADED:        "Your work has been graded. Grade will be shared soon."
PUBLISHED:     Score card + full breakdown
RETURNED:      Score card + "Your teacher has returned this for revision." + Re-submit button
```

---

### Answer-type rendering

Currently the grading panel shows all answers as raw JSON. This is the biggest teacher UX gap for anything other than auto-graded quizzes.

**Per-type improvements:**

**Quiz (multiple choice):**

- Show option text, not option UUID
- Green checkmark on selected correct option, red X on selected wrong option
- Grey for unselected options

**Quiz (open text):**

- Show student's text in a readable block
- Teacher scores inline (already exists, but needs the item score to auto-sum into the final score — see 4.1)

**Assignment (file):**

- Show a download/preview link if the file key is present
- Show text submission inline

**Exam:**

- Same as quiz options display

**Code challenge:**

- Show pass/fail table per test case
- Show source code in a syntax-highlighted read-only editor

#### Auto-sum item scores into final score

For submissions where all items have been scored, auto-compute and pre-fill the final score:

```
final_score = Σ(item.score / item.max_score) × 100
```

This removes the most common manual step for assignment and open-text quiz grading.

---

### Performance & observability

- **Replace 5-query stats with 1-query CTE** (Phase 1.4)
- **Add SWR `dedupingInterval`** to stats hook — stats don't need to refetch more than once per 30 seconds
- **Add `revalidateOnFocus: false`** to grading panel hook — prevents form state from being silently reset when teacher alt-tabs to look at reference material
- **Add a `grading_version` migration path** — `grading_json` has a `grading_version: 1` field but no reader checks it. Add a version-aware coercion on read so old records can be migrated forward gracefully.

---


## 6. What NOT to Change

- The unified `Submission` table design is correct. Don't split it back.
- The dispatcher pattern in `grader.py` is clean. Keep it.
- The `GradedItem` / `GradingBreakdown` Pydantic hierarchy is the right abstraction. Extend it, don't replace it.
- SWR for data fetching is fine. Don't introduce a new state library.
- The ULID-based `submission_uuid` is correct. Don't change IDs.
- `useGradingPanel` / `useSubmissions` hooks are the right abstraction level. Extend them rather than replacing with context providers.

---

## 7. Files to Touch (by phase)


- `apps/api/src/db/grading/submissions.py` (datetime.utcnow)
- `apps/api/src/services/grading/teacher.py` (CSV)
- `apps/web/components/Grading/GradingPanel.tsx` (dirty guard, post-save navigation)


- `apps/api/src/services/grading/submit.py` ← primary target
- `apps/api/src/services/grading/settings_loader.py` ← new file
- `apps/api/src/services/grading/teacher.py` (stats, save_grade, mark_under_review)
- `apps/api/src/routers/grading/submit.py` (remove business logic)
- `apps/api/src/db/grading/submissions.py` (typed grading_json)


- `apps/web/components/Grading/GradingPanel.tsx` ← primary target
- `apps/web/components/Grading/SubmissionsTable.tsx`
- `apps/web/components/Grading/Student/SubmissionShell.tsx`
- `apps/web/hooks/useSubmissions.ts`


- `apps/api/src/db/grading/submissions.py` (status enum)
- Migration file (new)
- `apps/web/types/grading.ts`
- `apps/web/components/Grading/SubmissionStatusBadge.tsx`


- `apps/web/components/Grading/AnswerDisplay.tsx` ← new shared component
- `apps/web/components/Grading/GradingPanel.tsx`
- `apps/web/components/Grading/Student/SubmissionResult.tsx`


## Notes

- Use uv run alembic revision to create migrations
- Use shadcn ui's design system and components
- UI should be fully localized using next-intl
