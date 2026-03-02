# Code Quality Report — High-ROI Issues

> Generated: 2026-03-02
> Branch: `csmooc`
> Stack: FastAPI (Python) + Next.js 16 (TypeScript/React)

---

## How to read this report

Each issue is tagged with an effort/gain estimate:

- **Effort**: S (< 1 hour) · M (half day) · L (1–2 days)
- **Gain**: type safety · security · performance · maintainability · DX

Issues are ordered by ROI (highest first).

---

## TIER 2 — High Gain, Low-to-Medium Effort

### 5. Widespread `any` types defeat TypeScript's purpose

**Effort: M | Gain: type safety, correctness**

`any` is used pervasively in components that handle core domain objects. When a bug occurs in these areas, TypeScript provides zero protection.

Most impactful occurrences:

```typescript
// apps/web/app/orgs/[orgslug]/(withmenu)/course/[courseuuid]/activity/[activityid]/activity.tsx
activity: any | null;           // line 218
course: any;                    // line 219
assignment: any;                // line 227
course.chapters.forEach((chapter: any) => {   // line 236

// apps/web/app/orgs/[orgslug]/(withmenu)/collections/new/NewCollection.tsx
(course: any) => course.name... // line 50

// apps/web/app/auth/login/login.tsx
org: any;                       // line 22
```

**Fix**:

1. Define proper interfaces for `Course`, `Chapter`, `Activity`, `Assignment` in a shared `types/` file or in the respective service files.
2. Use `unknown` + type guards for catch blocks (`catch (error: unknown)`).

---

### 6. Styled-components mixed with Tailwind — dual CSS runtime

**Effort: M | Gain: performance, bundle size, maintainability**

10 files still use `styled-components` alongside Tailwind CSS. Styled-components adds a runtime CSS-in-JS layer (~12kB gzipped) and makes SSR more complex (requires the `styled-registry` wrapper).

```
apps/web/components/Objects/Activities/DynamicCanva/DynamicCanva.tsx
apps/web/components/Objects/Activities/DynamicCanva/TableOfContents.tsx
apps/web/components/Objects/Editor/Editor.tsx
apps/web/components/Objects/Editor/Extensions/Callout/Info/InfoCalloutComponent.tsx
apps/web/components/Objects/Editor/Extensions/Callout/Warning/WarningCalloutComponent.tsx
apps/web/components/Objects/Editor/Extensions/MathEquation/MathEquationBlockComponent.tsx
apps/web/components/Objects/Editor/Extensions/Video/VideoBlockComponent.tsx
apps/web/components/Objects/Editor/Toolbar/ToolbarButtons.tsx
apps/web/components/Objects/StyledElements/Tooltip/Tooltip.tsx
apps/web/components/Utils/libs/styled-registry.tsx
```

Previous refactoring was started (commit `6fef51df`, `b95bc7ac`) but did not fully complete the migration.

**Fix**: Migrate these 10 files to Tailwind utility classes. Then remove `styled-components`, `@types/styled-components` from `package.json`, and delete `styled-registry.tsx`.

---

### 7. Inline SWR fetcher construction — raw API URLs in components

**Effort: M | Gain: maintainability, DX, type safety**

Throughout the frontend, `useSWR` is called with raw `getAPIUrl()` string concatenations directly inside components. This duplicates URL logic, bypasses the typed service layer, and makes endpoint changes error-prone.

```typescript
// apps/web/app/orgs/[orgslug]/(withmenu)/collections/new/NewCollection.tsx:43
useSWR(`${getAPIUrl()}courses/org_slug/${orgslug}/page/1/limit/20`, ...)

// apps/web/app/orgs/[orgslug]/dash/assignments/.../AssignmentSubmissionsSubPage.tsx:85
useSWR(`${getAPIUrl()}users/id/${user_id}`, ...)
```

The project already has typed service files in `apps/web/services/` (e.g. `services/courses/courses.ts`), but they are not consistently used with SWR.

**Fix**: Create typed custom hooks (e.g. `useCourseList`, `useUser`) in a `hooks/` directory that encapsulate both the SWR key and the fetcher. Components then call `const { data } = useCourseList(orgslug)` with full type inference.

---

### 8. `except Exception` overuse — masks specific error types

**Effort: M | Gain: reliability, security**

30+ locations catch `Exception` (the root of all exceptions) instead of specific exception types. This pattern can accidentally suppress `KeyboardInterrupt`, `SystemExit`, database integrity errors, and auth failures.

```
apps/api/src/core/events/database.py   — 8 occurrences
apps/api/src/routers/ai/ai.py          — 8 occurrences
apps/api/src/routers/courses/code_challenges.py — 9 occurrences
```

**Fix**: Replace with specific exception types (`SQLAlchemyError`, `ValidationError`, `HTTPException`, etc.). Where broad catching is intentional (top-level handlers), add `logger.exception("Unhandled error", exc_info=True)` and re-raise or return a proper HTTP 500.

---

### 9. ID type mismatch — `Number.parseInt(course.id)` with TODO

**Effort: S | Gain: correctness, type safety**

Two separate components have a `// TODO: why parsing course id as int?` comment, indicating a known type inconsistency between frontend and backend course IDs.

```typescript
// apps/web/components/Objects/Courses/CourseActions/CoursesActions.tsx:128
Number.parseInt(course.id, 10), // TODO: why parsing course id as int?

// apps/web/components/Objects/Courses/CourseActions/CourseActionsMobile.tsx:195
Number.parseInt(course.id, 10), // TODO: why parsing course id as int?
```

**Fix**: Decide on a canonical ID type (UUID string or integer) for courses and make it consistent across the API response schema and frontend types. Eliminate the parse calls once types are aligned.

---

## TIER 3 — Medium Effort, Significant Long-term Gains

### 10. Massive monolithic components

**Effort: L | Gain: maintainability, testability, performance**

Several components massively exceed reasonable limits, making them hard to review, test, and reason about:

| File                           | Lines |
| ------------------------------ | ----- |
| `OrgEditLanding.tsx`           | 2078  |
| `UserProfileBuilder.tsx`       | 1674  |
| `activity.tsx` (activity page) | 1564  |
| `TaskQuizObject.tsx`           | 1487  |
| `VideoActivityModal.tsx`       | 1254  |
| `roles/client.tsx`             | 1192  |

**Fix**: Apply the Single Responsibility Principle. Split by feature section. Each sub-component should be independently importable and testable. A target of ~500 lines per component is reasonable.

---

### 11. Missing `response_model` on FastAPI routes

**Effort: M | Gain: API documentation, serialization safety, data leakage prevention**

Many routes omit `response_model`, meaning FastAPI cannot filter the response to only expected fields. This risks accidentally serializing and returning internal fields (e.g. password hashes, internal IDs).

```python
@router.post("/start/activity_chat_session")   # no response_model
@router.post("/send/activity_chat_message")    # no response_model
@router.post("/login")                          # no response_model
```

**Fix**: Add `response_model=YourResponseSchema` to all route decorators. This ensures FastAPI auto-validates and filters output, and it powers the OpenAPI docs.

---

### 12. `print()` → `logging` in all service layer code

**Effort: S | Gain: observability, production readiness**

Related to issue #1 but broader: the service layer uses `print()` statements instead of Python's `logging` module. This means:

- No log levels (can't filter debug vs. warning in production)
- No structured output (incompatible with log aggregators)
- Output goes to stdout unformatted
- Leave CLI.py prints

```
apps/api/src/services/courses/activities/assignments.py:1503  — print(assignment_uuid)
apps/api/src/services/blocks/block_types/quizBlock/quizBlock.py:215
apps/api/src/services/courses/certifications.py:648
apps/api/src/services/payments/payments_stripe.py:131
```

**Fix**: Add to each file:

```python
import logging
logger = logging.getLogger(__name__)
```

Then replace `print(...)` with `logger.debug(...)` / `logger.warning(...)` / `logger.error(...)`.
