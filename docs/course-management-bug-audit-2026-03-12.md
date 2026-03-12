# Course Management Bug Audit

Date: 2026-03-12

Scope: static code audit of the current course-management rewrite across the course dashboard, course workspace, staged edit tabs, and the course API used by those screens.

Note: this is a code-backed findings report, not a full runtime test pass. The issues below are concrete defects or high-confidence breakpoints visible from the current implementation.

## Executive Summary

The current course-management stack has several real regressions and contract mismatches. The two user-reported failures around the Access and Collaboration tabs are supported by the code:

1. the mode controls are implemented in a way that is likely not reliably clickable,
2. successful saves refresh the wrong client-side cache, so the canonical course state remains stale,
3. the Collaboration tab is gated by one permission model but saved through another.

There are also broader defects in the course API and creation flow, including a public metadata leak for unpublished content, broken template deep-links, broken outline cloning, and incorrect SQL null checks in course listing/count queries.

---

## Findings

### 1. Critical: public course metadata can expose unpublished chapters and activities

- Area: API metadata endpoint
- Evidence:
  - `apps/api/src/routers/courses/courses.py` exposes `GET /courses/{course_uuid}/meta` with `with_unpublished_activities` as a public query parameter.
  - `apps/api/src/services/courses/courses.py:343-389` calls `get_course_chapters(..., with_unpublished_activities)`.
  - The same function only enforces `course:read` when `course.public` is false (`apps/api/src/services/courses/courses.py:377-378`).
- Impact:
  - Any caller can request `with_unpublished_activities=true` for a public course and potentially receive draft chapters/activities.
  - This is a content disclosure bug, not just a UI issue.
- Suggested improvement:
  - Split public metadata from editor metadata.
  - Force `with_unpublished_activities=false` unless the caller has `course:update` or `course:update_content` for that course.
  - Add API tests covering anonymous and authenticated access to public courses with and without unpublished content.

### 2. High: Access and Collaboration mode cards are likely wired incorrectly

- Area: staged mode selectors in Access and Collaboration tabs
- Evidence:
  - `CourseChoiceCard` renders a `<Label htmlFor={id}>` around a hidden `RadioGroupItem` (`apps/web/components/Dashboard/Courses/courseWorkflowUi.tsx:106-121`).
  - The radio control comes from `@base-ui/react/radio`, not a native `<input type="radio">` (`apps/web/components/ui/radio-group.tsx`).
  - The card hides the actual control with `sr-only`, so the main interaction depends on label-to-control behavior that is not guaranteed for a custom radio root.
  - This matches the reported symptom: "switching mode isn't working" in Access and Collaboration.
- Impact:
  - Users may click the visual card and get no state change, or only be able to toggle the tiny hidden radio hitbox.
  - The most visible regression is in Access and Collaboration because those tabs are entirely driven by this control pattern.
- Suggested improvement:
  - Do not rely on `htmlFor` against a custom radio primitive.
  - Make the whole card explicitly interactive: either render a native radio input, or handle card clicks with `onClick={() => onValueChange(value)}` while keeping the radio primitive purely for semantics.
  - Add a Playwright test that clicks both cards and asserts the selected value changes.

### 3. High: Access and Collaboration saves refresh the wrong cache, so the workspace stays stale

- Area: staged save flow for `public` and `open_to_contributors`
- Evidence:
  - Access uses `saveWithEditorRefresh` before calling `updateCourseAccess` (`apps/web/components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess.tsx:58,82-87`).
  - Collaboration does the same (`apps/web/components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors.tsx:197,386-392`).
  - `saveWithEditorRefresh` only calls `refreshCourseEditor()` with `refresh: 'editor'`, which refreshes the editor bundle, not the course metadata snapshot that contains `public` and `open_to_contributors` (`apps/web/hooks/useSaveSection.ts`).
  - The workspace shell and review/overview screens read `course.courseStructure.public` from `CourseContext` (`apps/web/components/Dashboard/Courses/CourseWorkspacePageShell.tsx`, `apps/web/components/Dashboard/Courses/CourseReviewPublish.tsx`, `apps/web/components/Dashboard/Courses/CourseWorkspaceOverview.tsx`).
- Impact:
  - After a successful save, badges, review state, overview panels, and any other metadata-driven UI can continue showing the old value until a hard refresh or a later metadata mutation happens.
  - This makes Access/Collaboration appear broken even when the API call succeeds.
- Suggested improvement:
  - Use `save(...)` instead of `saveWithEditorRefresh(...)` for access mutations, or explicitly refresh both `mutateCourseMeta()` and `mutateEditorBundle()`.
  - Keep the CourseContext metadata snapshot authoritative for all workspace screens.

### 4. High: Collaboration tab capability and save authorization do not match

- Area: permissions model between workspace routing and save endpoint
- Evidence:
  - Collaboration route access is granted from `manage_contributors` (`apps/web/lib/course-management-server.ts:39,89`).
  - The Collaboration tab saves `open_to_contributors` by calling `updateCourseAccess(...)` (`apps/web/components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors.tsx:386-392`).
  - `update_course_access` on the API requires `course:manage` (`apps/api/src/services/courses/courses.py:1105-1108`).
  - Contributor-management endpoints also require `course:manage` (`apps/api/src/services/courses/contributors.py:121,245,352`), while rights are reported separately as `manage_contributors` and `manage_access` (`apps/api/src/services/courses/courses.py:1649,1658`).
- Impact:
  - A user can be authorized to enter the Collaboration tab but still be unauthorized to save the Collaboration mode toggle.
  - The page-level capability model and endpoint-level permission model are inconsistent.
- Suggested improvement:
  - Decide whether `open_to_contributors` belongs to Access or Collaboration from a permission standpoint.
  - If it belongs to Collaboration, expose a collaboration-specific mutation guarded by `manage_contributors`.
  - If it belongs to Access, move the toggle out of Collaboration or gate the entire control on `canManageAccess`.

### 5. Medium: “Use as template” deep-links do not prefill the wizard

- Area: course creation flow
- Evidence:
  - `buildCourseCreationPath` emits `?template=outline&source=...` (`apps/web/lib/course-management.ts:52-54`).
  - The wizard reads `tpl` and `src` instead (`apps/web/components/Dashboard/Courses/CourseCreationWizard.tsx:46-47`).
- Impact:
  - Links such as “Use as template” do not actually pre-select outline mode or the source course.
  - The user lands in the wizard with default state, which makes the action feel broken.
- Suggested improvement:
  - Standardize on a single query contract.
  - Either change the builder to use `tpl` and `src`, or make the wizard parse both the old and new names for backwards compatibility.

### 6. Medium: outline cloning fetches the source course with the wrong UUID format

- Area: course creation wizard, outline import
- Evidence:
  - The wizard stores source selection as a clean UUID with the `course_` prefix removed (`apps/web/components/Dashboard/Courses/CourseCreationWizard.tsx:66-68,431-443`).
  - It then calls `getCourseMetadata(sourceCourseUuid, ...)` directly (`apps/web/components/Dashboard/Courses/CourseCreationWizard.tsx:117-120`).
  - The rest of the course-management API uses prefixed UUIDs such as `course_xxx`.
- Impact:
  - Outline creation from an existing course can fail with a 404 because the fetch is made against the wrong resource identifier.
  - Even if the deep-link parameter bug is fixed, the outline import path still breaks.
- Suggested improvement:
  - Store the full course UUID in wizard state, or normalize before fetch with `prefixedCourseUuid(sourceCourseUuid)`.
  - Add an integration test that creates a course from an existing outline and verifies chapters are copied.

### 7. Medium: authenticated course listing/count queries use Python `is None` inside SQL filters

- Area: course listing and course count queries
- Evidence:
  - `count_courses_orgslug` uses `UserGroupResource.resource_uuid is None` inside an `or_(...)` clause (`apps/api/src/services/courses/courses.py:450`).
  - `get_courses_orgslug` repeats the same pattern (`apps/api/src/services/courses/courses.py:519`).
- Impact:
  - `is None` is evaluated by Python before SQLAlchemy builds the query, so the intended `IS NULL` check is lost.
  - Authenticated users can miss courses that are private but not linked to any user group.
  - Total counts can be wrong, which also breaks pagination and dashboard summaries.
- Suggested improvement:
  - Replace those expressions with `UserGroupResource.resource_uuid.is_(None)`.
  - Add regression tests for authenticated users seeing private courses that have no user-group restrictions.

### 8. Medium: editor-bundle SWR cache key ignores auth identity

- Area: client caching for course workspace editor data
- Evidence:
  - `getCourseEditorBundleKey` returns `['course-editor-bundle', courseUuid]` even though it accepts `accessToken` (`apps/web/services/courses/editor.ts:57-58`).
- Impact:
  - If the session changes in the same browser context, SWR can reuse a previous user's contributor/user-group/certification bundle for the same course until revalidation completes.
  - That causes stale permissions, stale UI availability flags, and a possible short-lived data exposure problem.
- Suggested improvement:
  - Include a stable auth identity in the key, such as user id or a token-derived session key.
  - Also consider namespacing the metadata cache if response shape or permissions differ by user.

### 9. Low: unsaved-change guards are registered twice

- Area: workspace navigation guard
- Evidence:
  - `useDirtySection` calls `useUnsavedChangesGuard(isDirty)` (`apps/web/hooks/useDirtySection.ts:20`).
  - The workspace shell also calls `useUnsavedChangesGuard(hasDirtySections, { interceptInAppNavigation: true, ... })` (`apps/web/components/Dashboard/Courses/CourseWorkspacePageShell.tsx:62`).
- Impact:
  - The page can accumulate overlapping guard logic, especially around `beforeunload` and prompt state.
  - This is more likely to create inconsistent prompt behavior than provide useful protection.
- Suggested improvement:
  - Keep unsaved-navigation interception only at the workspace-shell level.
  - Let section hooks report dirty state upward, but do not register their own guards.

### 10. Low: source course options are arbitrarily capped at 100

- Area: new course page
- Evidence:
  - The new course page fetches editable courses with `limit = 100` (`apps/web/app/orgs/[orgslug]/dash/courses/new/page.tsx:12`).
- Impact:
  - In larger organizations, source courses beyond the first 100 cannot be used as templates.
  - This becomes worse once the template deep-link and outline import bugs are fixed, because the flow will still be incomplete at scale.
- Suggested improvement:
  - Replace the fixed preload with paginated or searchable source-course lookup.
  - If the initial preload stays, at least surface truncation in the UI.

---

## Priority Order For Fixes

1. Lock down the public metadata endpoint so unpublished content cannot leak.
2. Fix the Access/Collaboration mode controls so the cards are actually clickable.
3. Refresh course metadata, not just editor data, after `updateCourseAccess` mutations.
4. Align Collaboration permissions with the endpoint used to persist collaboration settings.
5. Fix template query-parameter naming and source UUID normalization together.
6. Correct the SQL null checks in course list/count queries.
7. Harden SWR keys against cross-session stale data.

## Recommended Test Coverage Additions

- API tests for `GET /courses/{uuid}/meta` with public/private courses and `with_unpublished_activities=true`.
- Playwright test for Access tab: click Public/Private cards, verify selected state, save, and verify shell badge updates.
- Playwright test for Collaboration tab: click Open/Closed cards, save, and verify the saved state persists after navigation.
- Integration test for “Use as template” link from the dashboard into the wizard.
- Integration test for outline cloning from an existing course.
- API tests for authenticated course listing/count with and without user-group links.
