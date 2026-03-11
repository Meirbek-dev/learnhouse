# Course Management Workflow - Critical Analysis (Current State)

**Date:** 2026-03-10
**Scope:** Current course management flow in `apps/web` and `apps/api`
**Goal:** Document the major workflow, authorization, state-management, data, and UX issues in the current course management implementation and define the fixes required to make it coherent and reliable.

---

## Executive Assessment

The current course management system is functional, but the workflow is not internally consistent.

The main problem is not a single broken page. The problem is that the system mixes three different editing models at once:

1. **Immediate actions**: contributor changes, chapter creation, chapter rename, activity creation, thumbnail upload, certification create/delete.
2. **Deferred local changes**: course metadata, access visibility, contributor openness, drag-and-drop ordering, certification config edits.
3. **Global save orchestration**: one shared save button tries to persist multiple unrelated sections in one sequence.

That makes the editor hard to reason about for users and fragile to maintain for engineers.

The most serious defects are:

1. **Authorization rules are inconsistent across server layouts, client tabs, and API behavior.**
2. **The save model is inconsistent and sometimes incorrect.**
3. **The list page ignores real pagination and overfetches heavily.**
4. **The editor state is too coupled, so unrelated sections interfere with each other.**
5. **The save path causes excessive refresh, revalidation, and stale-state risk.**

Until those are fixed, the course management area will continue to feel unpredictable even when individual components appear to work.

---

## Current Workflow Summary

### 1. Course list

- `apps/web/app/orgs/[orgslug]/dash/courses/page.tsx` fetches org data and editable courses server-side.
- The page requests `getEditableOrgCourses(..., 1, 999)` and passes the entire list to the client.
- `apps/web/app/orgs/[orgslug]/dash/courses/client.tsx` renders the cards and opens the create modal.

### 2. Course creation

- `CreateCourseModal` submits to `createNewCourse()`.
- On success it revalidates course tags, closes the modal, and refreshes the router.

### 3. Course editing

- `apps/web/app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page.tsx` is a client page.
- It gates tabs with client-side permissions.
- `CourseProvider` then fetches `/courses/{uuid}/meta?with_unpublished_activities=true` through SWR.
- Each tab edits part of a shared `CourseContext` state.

### 4. Persistence behavior today

- **Immediate write**:
  - chapter create/delete/rename
  - activity create/delete/rename/publish
  - contributor add/remove/role/status updates
  - usergroup unlink
  - thumbnail upload
  - certification create/delete
- **Deferred until Save button**:
  - general metadata edits
  - visibility/public toggle
  - `open_to_contributors` toggle
  - drag-and-drop order
  - certification config edits
- **Global save entry point**:
  - `apps/web/components/Dashboard/Misc/SaveState.tsx`

This is the central workflow flaw: users are in one editor, but the system behaves like several unrelated editors sharing the same screen.

---

## Critical Issues And Fixes

## 1. Permission Model Is Internally Inconsistent

### Issue 1.1: The server layout blocks `own`-scope editors before the page loads

**Evidence**

- `apps/web/app/orgs/[orgslug]/dash/courses/layout.tsx` only allows:
  - `CREATE COURSE ORG`
  - `UPDATE COURSE ORG`
  - `MANAGE COURSE ORG`
- The detail page itself uses client checks for `Scopes.OWN` on multiple tabs.
- The API endpoint `get_editable_courses_orgslug()` in `apps/api/src/services/courses/courses.py` explicitly supports `course:update:own`.

**Impact**

- A user who is allowed to edit only their own course can be denied by the route layout before they ever reach the page.
- The backend, list API, and client tab model do not agree on who is allowed to use the editor.

**Fix**

1. Update the course layout to accept both `ORG` and `OWN` scopes where appropriate.
2. Separate list-page access from course-detail access if needed.
3. Define one canonical permission matrix for:
   - list page
   - detail page shell
   - each tab
   - each mutation endpoint

### Issue 1.2: Access-sensitive fields are mixed into the general course update endpoint

**Evidence**

- `apps/api/src/services/courses/courses.py:update_course()` allows one payload to update both general metadata and sensitive access fields.
- It adds special checks only when `public` or `open_to_contributors` are present.
- The frontend uses the same shared course object and the same save flow for unrelated edits.

**Impact**

- Access-management concerns are coupled to basic metadata edits.
- It is harder to reason about who can change what.
- The API contract encourages oversized update payloads.

**Fix**

1. Split the API into section-specific mutations:
   - `PATCH /courses/{uuid}/metadata`
   - `PATCH /courses/{uuid}/access`
   - `PATCH /courses/{uuid}/ordering`
   - certification endpoints stay separate
2. Keep sensitive-field authorization isolated in the access endpoint.
3. Make each tab call only the endpoint for the section it owns.

---

## 2. The Save Workflow Is Inconsistent And Sometimes Wrong

### Issue 2.1: One page mixes immediate-save and deferred-save behaviors

**Evidence**

- Immediate actions are scattered across content, contributors, thumbnail, and certification flows.
- Deferred changes are stored in `CourseContext` and later pushed via `SaveState`.

**Impact**

- Users cannot predict whether a change is already persisted or still local.
- Engineers must remember which tab uses which persistence model.
- The workflow is much harder to test because there is no single editing contract.

**Fix**

Choose one model and apply it consistently.

**Recommended direction:** section-level save, not one global save.

1. Each tab owns its own draft state.
2. Each tab has its own save/discard lifecycle.
3. Immediate actions remain immediate only when they are naturally atomic.
4. Reordering becomes a tab-local draft with an explicit save action inside the content tab.

### Issue 2.2: The global save button saves unrelated sections together

**Evidence**

- `apps/web/components/Dashboard/Misc/SaveState.tsx` always attempts:
  - order save
  - metadata save
  - certification save
- It does this from a single click regardless of which tab the user was working in.

**Impact**

- A user changing one field can trigger writes for multiple domains.
- Failures are hard to communicate accurately because one click maps to several backend calls.
- Partial success is likely and difficult to explain.

**Fix**

1. Remove the cross-tab global save orchestration.
2. Remove page-wide save
3. Move save ownership into each tab.

### Issue 2.3: The page is marked dirty on first load

**Evidence**

- In `SaveState.tsx`, the initial `useEffect` builds `chapter_order_by_ids` and then dispatches `setIsNotSaved()` on first initialization.

**Impact**

- The UI can show unsaved changes before the user edits anything.
- The save button can encourage needless writes.

**Fix**

1. Initial state hydration must not mark the page dirty.
2. Dirty state should only change after a real user mutation.
3. Compare current order against an initial snapshot instead of forcing dirty on initialization.

### Issue 2.4: Reordering is deferred, but other structure changes are immediate

**Evidence**

- In the content editor:
  - new chapter/activity creation is immediate
  - rename/delete actions are immediate
  - drag-and-drop reordering is local and requires the shared save button

**Impact**

- The content tab has two different persistence models inside one interaction surface.
- Users cannot build a clear mental model of when content changes are committed.

**Fix**

1. Make all content mutations follow the same model.
2. Preferred option: content tab has explicit save for structural edits, including reorder, rename, create, and delete.
3. Alternative: persist reorder immediately as well, with optimistic rollback.

---

## 3. State Architecture Is Too Coupled

### Issue 3.1: All tabs mutate one shared `CourseContext` object

**Evidence**

- `apps/web/components/Contexts/CourseContext.tsx` stores a single `courseStructure`, `courseOrder`, and `isSaved` flag.
- General, access, contributors, certification, and content tabs all write into that shared state.

**Impact**

- Unrelated tabs are coupled through one mutable object.
- Dirty tracking is coarse and unreliable.
- Saving one section can accidentally include stale or unrelated data from another section.

**Fix**

1. Reduce `CourseContext` to shared read-only course data plus invalidation hooks.
2. Move editable draft state into section-local hooks.
3. Track dirty state per section, not for the whole editor.

### Issue 3.3: There is no navigation guard for unsaved local edits

**Evidence**

- The editor exposes `isSaved`, but there is no route-leave or `beforeunload` guard.

**Impact**

- Deferred edits are easy to lose.

**Fix**

1. Add browser unload protection for dirty sections.
2. Add in-app route-change confirmation when the current tab has unsaved changes.
3. Scope the warning to the active tab, not the whole editor.

---

## 4. Data Contracts Are Inconsistent

### Issue 4.1: The course list page throws away pagination and fetches 999 items

**Evidence**

- `apps/web/app/orgs/[orgslug]/dash/courses/page.tsx` hardcodes `COURSES_PER_PAGE = 999`.
- The API already returns `X-Total-Count` and supports page/limit.
- `totalCourses` is passed to the client but not used for pagination.

**Impact**

- Large orgs pay unnecessary server and render cost.
- The UI cannot scale with real course volume.
- The backend pagination support is effectively bypassed.

**Fix**

1. Use real pagination on the list page.
2. Add search and sort at the list level.
3. Render only one page of cards at a time.
4. Keep `X-Total-Count` as the source of truth for controls.

### Issue 4.2: The general editor and create flow do not share the same learnings format

**Evidence**

- `CreateCourseModal` sends `learnings` as `values.learnings?.join(', ')`.
- `EditCourseGeneral` expects `learnings` as JSON string content representing structured items.
- The backend accepts `learnings` as a plain string.

**Impact**

- Course creation and course editing are not using the same data model.
- Structured learning items degrade into an untyped string contract.
- The editor has to carry format-recovery logic.

**Fix**

1. Define one canonical backend schema for `learnings`.
2. Store it as structured JSON, not overloaded free-form string content.
3. Make creation and editing use the same serializer and validator.

### Issue 4.3: Backend validation is too weak for structured course metadata

**Evidence**

- `CourseUpdate` accepts `learnings` and `tags` as strings.
- The frontend performs more validation than the backend does.

**Impact**

- Invalid data can still reach storage if the request does not come from the current form.
- The backend does not protect the domain model.

**Fix**

1. Move structural validation to the API boundary.
2. Enforce shape, length, and normalization server-side.
3. Treat the frontend validator as UX help, not the source of truth.

### Issue 4.4: Certification default instructor extraction is using the wrong shape

**Evidence**

- `apps/web/components/Dashboard/Pages/Course/EditCourseCertification/EditCourseCertification.tsx` reads `courseStructure.authors[0].first_name` and `last_name`.
- Backend course author objects are shaped as `AuthorWithRole { user: UserRead, ... }`.

**Impact**

- The default instructor field can initialize blank even when author data exists.

**Fix**

1. Read from `author.user.first_name` and `author.user.last_name`.
2. Add a typed course-author interface on the frontend to prevent this class of bug.

---

## 5. Fetching, Refresh, And Cache Invalidation Are Too Expensive

### Issue 5.1: One save click can trigger multiple refresh cycles

**Evidence**

- `SaveState.tsx` calls `router.refresh()` inside `changeOrderBackend()` and again inside `changeMetadataBackend()`.
- It also calls `mutate()` repeatedly around the same course meta URL.
- It revalidates tags multiple times in the same save path.

**Impact**

- Unnecessary network and rendering work.
- The page can feel unstable during save.
- Save latency is inflated by orchestration overhead rather than only backend work.

**Fix**

1. Collapse one save action into one refresh cycle at most.
2. Prefer optimistic local update plus targeted SWR mutate.
3. Revalidate only the tags actually affected by the section that changed.

### Issue 5.2: Cache invalidation is too broad

**Evidence**

- `apps/web/services/courses/courses.ts` revalidates both `tags.courses` and `tags.editableCourses` for create, update, thumbnail update, and delete.

**Impact**

- Small updates invalidate more cache than necessary.
- This increases the reload surface across the app.

**Fix**

1. Add section- and entity-specific cache tags.
2. Invalidate the course list only when list-visible data changes.
3. Keep course-detail caches separate from editable list caches.

### Issue 5.3: The detail editor is client-gated and client-fetched end to end

**Evidence**

- The course detail page is a client page.
- It waits for client permission state.
- Then `CourseProvider` fetches course meta via SWR.

**Impact**

- Slower perceived load than a server-preloaded route.
- Tab switches depend on client fetch orchestration.
- Authorization and content load are split across two client steps.

**Fix**

1. Move the course editor shell to a server component.
2. Resolve permission and initial course data server-side.
3. Hydrate client tabs with initial data rather than fetching the first view entirely on the client.

### Issue 5.4: The same org data is fetched multiple times in the same flow

**Evidence**

- `generateMetadata()` fetches org context.
- `CoursesPage()` fetches org context again.
- The org context provider can also fetch org data client-side.

**Impact**

- Redundant requests during navigation.

**Fix**

1. Share org context from the server layout where possible.
2. Pass stable initial org data into the client provider.
3. Avoid refetching the same org object at page and provider level.

---

## 6. UX And Product Feedback Are Not Clear Enough

### Issue 6.1: The course list does not expose search, sort, or pagination even though the backend supports pagination

**Impact**

- Managing a large catalog becomes visually noisy and slow.
- The page is usable only for small organizations.

**Fix**

1. Add list filters and pagination.
2. Preserve the current card layout, but add a server-driven pager and search box.
3. Only fetch the current page.

### Issue 6.2: Error handling is uneven across sections

**Evidence**

- Some flows use detailed toasts.
- Some catch blocks collapse everything to a generic error.
- Multi-step saves do not report section-level success/failure clearly.

**Impact**

- Users do not know what actually failed.
- Retrying becomes guesswork.

**Fix**

1. Standardize mutation result handling.
2. Show section-specific failures.
3. In batch-like flows, report which subsection failed and which succeeded.

### Issue 6.3: The save model is not visible in the UI

**Impact**

- A user cannot tell which changes are already committed.
- Immediate-save and deferred-save sections look visually similar.

**Fix**

1. Make save behavior explicit per section.
2. Label sections as either auto-saved or manually saved.
3. Prefer removing mixed behavior rather than documenting a confusing model.

---

## Recommended Target State

The course management area should move to this model:

1. **List page**
   - server-paginated
   - searchable
   - uses real totals

2. **Editor shell**
   - server-authorized
   - server-hydrated with initial course data
   - tab access rules aligned with backend permission rules

3. **Per-tab editing model**
   - General tab owns metadata draft and save
   - Access tab owns access draft and save
   - Content tab owns structure draft and save
   - Contributors tab uses immediate atomic actions
   - Certification tab uses its own save lifecycle

4. **API model**
   - section-specific endpoints
   - strong backend validation
   - optimistic concurrency checks

5. **Cache model**
   - targeted invalidation
   - one refresh per user action at most
   - optimistic local updates where safe

---

## Priority Plan (one-shot)

1. Fix route/layout permission mismatch so `own`-scope editors are not blocked.
2. Split access updates out of the general course update path.
3. Stop marking the editor dirty on initial load.
4. Remove the page-wide save orchestration in `SaveState.tsx`.
5. Move to per-tab save ownership.
6. Normalize content-tab persistence behavior.
7. Define structured backend schemas for learnings and tags.
8. Add version-based conflict detection.
9. Tighten backend validation for course metadata.
10. Implement real list pagination and search.
11. Reduce refresh/revalidate churn.
12. Server-hydrate the editor shell and initial course payload.

---

## Bottom Line

The current course management area does not primarily suffer from missing components. It suffers from **inconsistent workflow semantics**.

The fastest way to improve it is not to keep patching individual tabs. The right move is to make the system coherent:

1. align permission rules,
2. split section responsibilities,
3. stop mixing immediate and deferred save models arbitrarily,
4. reduce shared mutable editor state,
5. use pagination and targeted invalidation everywhere.

Once those are fixed, the rest of the issues become smaller, clearer, and easier to solve.
