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
