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
