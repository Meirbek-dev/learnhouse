# Course Management Workflow - Critical Analysis (Current State)

**Date:** 2026-03-11 **Scope:** Current course management flow in `apps/web` and `apps/api`
**Goal:** Document the current workflow problems in course management and define concrete solutions
that make the experience coherent, safe, and maintainable.

---

## Executive Assessment

The current course management area is meaningfully better than the older implementation, but it is
still not coherent as a workflow.

Two earlier problems have already been improved:

1. The course list is now properly paginated and supports search and sorting.
2. The old page-wide global save orchestration has been replaced with section-level save buttons.

Those changes reduced some of the worst complexity. The remaining problems are deeper:

1. Authorization is still split across the wrong boundaries.
2. Individual sections still mix immediate-save and deferred-save behavior.
3. Shared course state can overwrite local drafts.
4. Unsaved-change protection is incomplete.
5. Concurrency protection is only implemented for part of the editor.
6. Cache invalidation and freshness handling are redundant, inconsistent, and hard to reason about.

The editor mostly works when one user changes one field at a time. It becomes fragile when
permissions differ by scope, when multiple people edit the same course, or when a user mixes
media/actions with unsaved drafts.

---

## Current Workflow Summary

### 1. Course list

- `apps/web/app/orgs/[orgslug]/dash/courses/page.tsx` fetches editable courses server-side.
- The page now supports pagination, search, and sort through `getEditableOrgCourses()`.
- `apps/web/app/orgs/[orgslug]/dash/courses/client.tsx` renders the list and opens course creation.

### 2. Editor shell

- `apps/web/app/orgs/[orgslug]/dash/courses/layout.tsx` applies one shared permission gate to both
  the list page and course-detail routes.
- `apps/web/app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page.tsx` server-fetches
  initial course metadata.
- `apps/web/app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page-client.tsx` renders
  tab navigation and gates individual tabs on the client.
- `apps/web/components/Contexts/CourseContext.tsx` stores shared course data and per-section dirty
  flags.

### 3. Persistence behavior by section

The workflow is no longer "one global save button", but it is still internally inconsistent.

- General tab:
  - Metadata fields are deferred until Save.
  - Thumbnail upload is immediate.
- Access tab:
  - Public/private access is deferred until Save.
  - User-group link/unlink actions are immediate.
- Contributors tab:
  - `open_to_contributors` is deferred until Save.
  - Add/remove/update contributor actions are immediate.
- Certification tab:
  - Enable/disable certification is immediate.
  - Certification config edits are deferred until Save.
- Content tab:
  - Create/rename/delete/reorder actions are immediate.

The result is not a single editing model. It is several editing models sharing one UI.

---

## Critical Issues And Solutions

## 1. Route-Level Authorization Is Split Across The Wrong Boundaries

### Problem

The same route layout protects both the course list and the course editor, but the list and the
editor do not actually require the same permissions.

### Evidence

- `apps/web/app/orgs/[orgslug]/dash/courses/layout.tsx` allows access if the user has any of:
  - `course:create:org`
  - `course:update:org`
  - `course:update:own`
  - `course:manage:org`
  - `course:manage:own`
- `apps/web/app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page-client.tsx` then
  gates actual editor tabs separately.

### Why this is a problem

This creates two concrete failures:

1. A user with only `course:create:org` can pass the shared `dash/courses` layout and reach the
   course-detail shell even though they cannot use any edit tab.
2. A user with org-level course permissions can still be blocked from tabs because the client checks
   exact `OWN` scope in multiple places.

The client permission helper in `apps/web/components/Security/PermissionProvider.tsx` does exact
permission-string matching. It does not broaden `ORG` into `OWN`. That means a user with
`course:update:org` does not automatically satisfy checks written as `course:update:own`.

### Impact

- Users can be admitted to the wrong shell and then see an access-denied state only after load.
- Org-level editors can be blocked from tabs they should be allowed to use.
- Authorization logic becomes hard to audit because list access and detail access are coupled.

### Solution

1. Split the current `dash/courses` layout into separate authorization boundaries:
   - list/create shell
   - course-detail shell
2. Define one explicit permission matrix for each course tab.
3. Stop encoding org-level editor access as `OWN` checks on the client.
4. Either:
   - pass resolved tab access from the server, or
   - implement scope broadening rules in the client permission layer intentionally.

---

## 2. The Editor Still Uses Mixed Save Models Inside The Same Section

### Problem

The old global save model is gone, but each section still mixes immediate writes and deferred writes
in ways users cannot infer reliably.

### Evidence

- General tab:
  - `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral.tsx` saves text
    metadata explicitly.
  - `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/ThumbnailUpdate.tsx` uploads
    thumbnails immediately.
- Contributors tab:
  - `apps/web/components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors.tsx`
    saves `open_to_contributors` explicitly.
  - The same component adds/removes/updates contributors immediately.
- Certification tab:
  - `apps/web/components/Dashboard/Pages/Course/EditCourseCertification/EditCourseCertification.tsx`
    creates/deletes certification immediately.
  - The same component saves certification config separately.

### Impact

- Users cannot form a reliable mental model of what is already persisted.
- Partial updates are easy to create accidentally.
- Error handling becomes inconsistent because one section contains multiple mutation styles.

### Solution

Pick one contract per section and enforce it consistently.

Recommended direction:

1. Each section owns one draft and one save lifecycle.
2. Keep truly atomic actions immediate only when they do not coexist with unsaved draft fields in
   the same section.
3. Move media actions and configuration actions into separate sections if they must keep different
   persistence behavior.
4. If a section mixes both kinds of change, make the section explicitly stage everything until Save.

---

## 3. Shared Course State Can Overwrite Local Drafts

### Problem

The editor uses a shared `CourseContext` as both a read model and a synchronization source for local
section state. That makes local drafts vulnerable to unrelated updates.

### Evidence

- `apps/web/components/Contexts/CourseContext.tsx` stores one shared `courseStructure` object for
  the editor.
- `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral.tsx` resets the
  form whenever `courseStructure` changes.
- `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/ThumbnailUpdate.tsx` mutates course
  metadata immediately after thumbnail upload.

This means a user can:

1. type unsaved changes into the general form,
2. upload a thumbnail,
3. trigger a course metadata refresh,
4. have the form reset from shared state.

The same structural risk exists anywhere section-local state is re-derived automatically from
`courseStructure` after external mutations.

### Impact

- Unsaved edits can be silently replaced by refreshed server state.
- Draft reliability depends on mutation ordering, not just user intent.
- The shared context becomes an accidental source of destructive resets.

### Solution

1. Treat `CourseContext` as shared canonical read data, not as the live source for resetting local
   drafts after mount.
2. Move section drafts into isolated local stores or hooks.
3. Only reset a section draft when one of these is true:
   - the user explicitly discards,
   - that section saved successfully,
   - the page is re-entered fresh.
4. When immediate mutations return partial server updates, merge only the affected fields instead of
   force-resetting the whole section form.

---

## 4. Unsaved-Changes Protection Is Incomplete

### Problem

The editor only protects some navigation paths.

### Evidence

- `apps/web/hooks/useUnsavedChangesGuard.ts` only installs a `beforeunload` listener.
- `apps/web/app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page-client.tsx` only
  prompts when the user clicks another course tab and the current tab is dirty.

This does not cover:

- sidebar navigation,
- breadcrumb navigation,
- browser back/forward within the app,
- any other client-side route transition outside the tab strip.

It also only checks the current tab, not whether another section already has unsaved work.

### Impact

- Users can lose changes through normal in-app navigation.
- Dirty-state warnings are inconsistent and easy to bypass unintentionally.

### Solution

1. Add one centralized in-app route-leave guard for the course editor.
2. Warn when any section is dirty, not only the active tab.
3. Keep the warning message section-aware so it still tells the user which draft would be lost.

---

## 5. Optimistic Concurrency Protection Is Only Partially Implemented

### Problem

The codebase already has a good concurrency primitive, `last_known_update_date`, but only some
mutations use it.

### Evidence

- `apps/api/src/services/courses/courses.py` enforces `_ensure_course_is_current()` for:
  - `update_course_metadata()`
  - `update_course_access()`
- `apps/api/src/services/courses/chapters.py` does not enforce any equivalent check in
  `reorder_chapters_and_activities()`.
- Immediate flows such as thumbnail upload and contributor mutations also do not share one
  consistent optimistic-concurrency contract.

### Impact

- Metadata and access changes are protected from overwriting stale state.
- Structure changes are not.
- The same editor therefore has different data-loss guarantees depending on which action the user
  takes.

### Additional UX gap

When the protected mutations do fail, the UI mainly surfaces a generic error string. There is no
structured conflict recovery flow.

### Solution

1. Extend optimistic concurrency to all course-editing mutations that can overwrite prior state.
2. Add `last_known_update_date` to reorder and any other stateful edit operations.
3. Return structured conflict metadata on 409 responses.
4. Offer a concrete recovery path in the UI:
   - reload latest version,
   - compare changes,
   - retry safely.

---

## 6. Cache Invalidation And Freshness Handling Are Redundant And Inconsistent

### Problem

The course workflow currently uses too many freshness mechanisms at once:

- server-side `revalidateTag()` in server actions,
- client-side calls to `/api/revalidate`,
- local SWR `mutate()`,
- `router.refresh()` in some flows.

### Evidence

- `apps/web/services/courses/courses.ts` revalidates server tags inside mutations.
- `apps/web/services/courses/chapters.ts` does the same for structure mutations.
- `apps/web/services/utils/ts/requests.ts` exposes a separate client `revalidateTags()` helper that
  posts to `/api/revalidate`.
- Components like:
  - `apps/web/components/Objects/Modals/Course/Create/CreateCourse.tsx`
  - `apps/web/components/Objects/Thumbnails/CourseThumbnail.tsx`
  - `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/Buttons/NewActivityButton.tsx`
    combine multiple freshness mechanisms in one user action.

### Why this is a problem

This is not just redundant. It makes correctness ownership unclear.

- Which layer is responsible for keeping server-rendered pages fresh?
- Which layer is responsible for SWR caches?
- Which tags are canonical for editable lists versus detail pages?
- Which mutations need `router.refresh()` and which do not?

Right now the answer varies by component.

### Additional operational risk

`apps/web/app/api/revalidate/route.ts` is publicly callable and does not require authentication or a
secret. Since the course workflow depends on that route from the client, anyone who can hit the app
can trigger arbitrary tag invalidation and force cache churn.

### Impact

- More refresh work than necessary.
- Hard-to-debug stale-state bugs.
- Higher chance of accidental over-invalidation.
- Public cache-invalidation surface area.

### Solution

1. Define a single freshness policy per mutation type:
   - server revalidation for server-rendered caches,
   - SWR mutate for client-local state,
   - `router.refresh()` only when route-level data actually changed.
2. Make tag ownership explicit and consistent.
3. Remove redundant revalidation calls from components once the mutation layer owns freshness.
4. Protect `/api/revalidate` with authentication or a server-only secret, or remove it from client
   mutation paths entirely.

---

## 7. Section Data Fetching Is Fragmented And Duplicative

### Problem

The course editor has a shared provider, but several tabs still fetch their own parallel data in
inconsistent ways.

### Evidence

- `apps/web/components/Contexts/CourseContext.tsx` fetches course metadata.
- `apps/web/components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors.tsx`
  separately fetches contributors.
- `apps/web/components/Dashboard/Pages/Course/EditCourseCertification/EditCourseCertification.tsx`
  separately fetches certifications and bypasses the shared service wrappers with a manual
  `fetch()`.
- `apps/web/components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess.tsx` separately
  fetches linked user groups.

Not every extra fetch is inherently wrong, but the current pattern has no clear contract. Some
sections use shared service helpers, some use raw `fetch`, some rely on `CourseContext`, and some
stitch their own data layer locally.

### Impact

- The editor is harder to maintain because each tab invents its own fetch pattern.
- Freshness and cache ownership differ by section.
- It becomes harder to predict which data should live in shared state and which should remain
  tab-local.

### Solution

1. Define explicit data boundaries:
   - shared editor shell data,
   - section-owned query data,
   - action-specific transient data.
2. Standardize on service-layer helpers instead of ad hoc tab-local `fetch()` calls.
3. Use shared SWR key helpers where applicable.
4. Only keep data in `CourseContext` if multiple sections truly depend on it.

---

## 8. The Thumbnail Workflow Depends On Timing Instead Of A Stable Readiness Contract

### Problem

The thumbnail upload flow relies on a hard-coded delay to let the backend "stabilize" before the UI
trusts the result.

### Evidence

- `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/ThumbnailUpdate.tsx` waits 1500ms
  after updating the thumbnail before continuing.

### Why this is a problem

This means correctness depends on elapsed time rather than an explicit backend contract.

Possible underlying causes include:

- asynchronous media processing,
- storage propagation delay,
- metadata not being ready when the mutation resolves.

### Impact

- Slower perceived save behavior.
- Non-deterministic freshness.
- Fragility on slower or faster infrastructure.

### Solution

1. Make the backend return the finalized media state that the frontend should render.
2. If processing is asynchronous, return a processing status and poll or subscribe explicitly.
3. Remove time-based waits from the client once the backend provides a readiness signal.

---

## Recommended Target Architecture

The cleanest path forward is:

1. Split route authorization by page responsibility.
2. Keep one permission matrix for course tabs and resolve it consistently across server and client.
3. Reduce `CourseContext` to shared canonical course data plus dirty-state registry.
4. Keep section drafts local and resilient to unrelated shared-state updates.
5. Standardize each section on one persistence model.
6. Extend concurrency protection to every stateful course mutation.
7. Centralize freshness rules in the mutation layer and remove public revalidation from the browser
   path.

---

## Priority Order

### Immediate

1. Fix the route and tab permission mismatch.
2. Prevent shared-state refreshes from resetting unsaved local drafts.
3. Add a real in-app dirty-navigation guard.

### Next

1. Extend optimistic concurrency to structure and other mutable sections.
2. Unify cache invalidation ownership.
3. Remove time-based thumbnail stabilization.

### After that

1. Normalize section query boundaries.
2. Standardize service usage and SWR keys.
3. Simplify the editor around one draft model per section.

---

## Bottom Line

The course management workflow is no longer failing because of one giant save button or fake
pagination. Those problems have already moved in the right direction.

The current failures are subtler and more structural:

- the wrong authorization boundary,
- mixed persistence rules inside sections,
- shared state that can overwrite drafts,
- incomplete unsaved-change protection,
- partial concurrency guarantees,
- and a freshness model with too many overlapping mechanisms.

If those are fixed, the editor will stop feeling fragile and start behaving like one deliberate
product instead of several mutation styles sharing the same route.
