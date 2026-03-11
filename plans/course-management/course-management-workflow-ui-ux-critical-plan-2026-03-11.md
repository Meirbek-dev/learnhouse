# Course Management Workflow, UI And UX Critical Plan

**Date:** 2026-03-11
**Scope:** `apps/web` course management surfaces for index, creation, workspace, and course-edit sections
**Primary Goal:** Define a concrete plan to make course management coherent, predictable, and visually consistent using shadcn/ui patterns and semantic design tokens.

---

## Executive Verdict

The current course-management rewrite is moving in the right direction, but it is still not a finished workflow.

The product now has a better course index, a stronger workspace shell, a proper review stage, and section-level dirty tracking. Those are real improvements. The remaining issues are structural, not cosmetic:

1. The experience still has multiple creation patterns.
2. The workspace still mixes incompatible save models.
3. Shared course refreshes can still interfere with local editing drafts.
4. The index is part management console and part browsing gallery.
5. Several course surfaces still depend on custom visual treatment instead of a strict shadcn design language.
6. Visual polish is undermined by decorative gradients, hardcoded emphasis blocks, and legacy color habits that make parts of the app feel improvised.

The next iteration should not be a reskin. It should finish the product model first, then normalize the UI around shadcn primitives and semantic tokens.

---

## Current Workflow Map

### 1. Entry and creation

- The main course index lives at `apps/web/app/orgs/[orgslug]/dash/courses/page.tsx` and `client.tsx`.
- The newer canonical creation route is `apps/web/app/orgs/[orgslug]/dash/courses/new/page.tsx` with `CourseCreationWizard.tsx`.
- The legacy modal flow still exists in `apps/web/components/Objects/Modals/Course/Create/CreateCourse.tsx`.

### 2. Workspace shell

- The workspace shell is rendered through `renderCourseWorkspacePage.tsx` and `CourseWorkspacePageShell.tsx`.
- Stage pages are split into `overview`, `details`, `curriculum`, `access`, `collaboration`, `certificate`, and `review`.
- Capabilities are resolved server-side in `apps/web/lib/course-management-server.ts`.

### 3. State and persistence

- Shared canonical course data lives in `CourseContext.tsx`.
- Dirty tracking is section-based through `useDirtySection.ts`.
- Some sections save explicitly, while others mutate immediately.

### 4. Current editing contracts by section

- `EditCourseGeneral.tsx`: deferred form save.
- `ThumbnailUpdate.tsx`: immediate save.
- `EditCourseAccess.tsx`: deferred visibility save, immediate user-group linking and unlinking.
- `EditCourseContributors.tsx`: deferred openness setting, immediate contributor mutations.
- `EditCourseCertification.tsx`: mixed immediate lifecycle actions and deferred configuration.
- `EditCourseStructure.tsx`: immediate optimistic edits.

This is the core UX problem. The product is visually grouped as one workspace, but behaviorally it is still multiple tools.

---

## Critical Problems And Suggested Improvements

## 1. Course creation is still split across two product models

### Problem

Course creation still exists as both a full-page wizard and a legacy modal. That means the product still teaches two different creation behaviors.

### Evidence

- `apps/web/app/orgs/[orgslug]/dash/courses/new/page.tsx`
- `apps/web/components/Dashboard/Courses/CourseCreationWizard.tsx`
- `apps/web/components/Objects/Modals/Course/Create/CreateCourse.tsx`

### UX impact

- Users do not learn one canonical start flow.
- The modal is too shallow for an important authoring task.
- Template choice, launch destination, and initial course setup are not consistently presented.

### Suggested improvement

1. Make the wizard the only supported creation flow for course management.
2. Replace remaining “New course” modal entry points with route navigation to `/dash/courses/new`.
3. Keep a modal only if it is intentionally a different quick-create workflow with fewer promises.
4. Standardize wizard structure on shadcn `Card`, `RadioGroup`, `Button`, `Input`, `Textarea`, `Alert`, and `Separator`.

---

## 2. The course index still mixes browse UX with management UX

### Problem

The course index has proper server pagination, search, presets, bulk selection, and a table view, but it still behaves partly like a browse surface.

### Evidence

- `apps/web/app/orgs/[orgslug]/dash/courses/client.tsx`
- `apps/web/components/Objects/Thumbnails/CourseThumbnail.tsx`

### UX impact

- Managers need density, not visual detours.
- Important states exist, but they are not the organizing principle of the page.
- Card view still carries too much product weight for an admin workflow.

### Suggested improvement

1. Make table view the default management mode.
2. Treat card view as optional browse mode.
3. Promote `All`, `Drafts`, `Published`, `Private`, `Recent`, and `Needs attention` into a stable first-row control set.
4. Keep summary metrics lightweight and operational, not decorative.
5. Use shadcn `DataTable`, `Input`, `Tabs`, `Badge`, `DropdownMenu`, `Pagination`, and `AlertDialog` as the default language of the page.
6. Reduce thumbnail-heavy visual weight in the management view.

---

## 3. Route structure and capability boundaries are better, but still not aligned tightly enough to workflow intent

### Problem

The server capability model is a good foundation, but the workflow still reads like backend sections exposed directly in the UI.

### Evidence

- `apps/web/app/orgs/[orgslug]/dash/courses/layout.tsx`
- `apps/web/app/orgs/[orgslug]/dash/courses/[courseuuid]/layout.tsx`
- `apps/web/lib/course-management-server.ts`
- `apps/web/components/Dashboard/Courses/CourseWorkspacePageShell.tsx`

### UX impact

- Users are still navigating application structure more than task structure.
- Overview, review, details, and governance are separated correctly, but not yet framed as one lifecycle.

### Suggested improvement

1. Preserve server-resolved capabilities, but make stage labels task-oriented.
2. Treat the workspace as four mental groups:
   - Overview
   - Build
   - Governance
   - Publish
3. Keep current routes if needed technically, but rewrite visible copy and grouping around user goals instead of backend nouns.
4. Surface “what is blocked” and “what can I do next” directly in the shell.

---

## 4. The workspace still uses mixed save contracts

### Problem

The user cannot reliably predict which changes are local drafts, which are already saved, and which trigger network mutations immediately.

### Evidence

- `EditCourseGeneral.tsx` plus `ThumbnailUpdate.tsx`
- `EditCourseAccess.tsx`
- `EditCourseContributors.tsx`
- `EditCourseCertification.tsx`
- `EditCourseStructure.tsx`

### UX impact

- Trust is reduced.
- Toasts are doing too much explanatory work.
- The same screen can contain multiple persistence contracts.

### Suggested improvement

1. Define one save contract per section and enforce it.
2. Keep curriculum immediate and optimistic, but make that explicit in the UI.
3. Keep `General`, `Access`, `Contributors`, and `Certificate` as explicit draft sections with Save and Discard.
4. If an action must remain immediate, isolate it in a clearly labeled sub-panel such as “Instant actions”.
5. Use one shared section header pattern based on shadcn `CardHeader`, `Badge`, `Button`, and `Alert`.

---

## 5. Shared course refreshes still compete with local drafts

### Problem

The shared course snapshot is still close enough to section-local state that external refreshes can disrupt draft behavior.

### Evidence

- `apps/web/components/Contexts/CourseContext.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/ThumbnailUpdate.tsx`

### UX impact

- A user can lose confidence in whether their unsaved work is stable.
- Immediate mutations can appear to “jump” other fields.

### Suggested improvement

1. Treat `CourseContext` as canonical read state only.
2. Let each editable section own its draft after initial hydration.
3. Only reset a draft on explicit discard, successful save, or full page re-entry.
4. For immediate mutations, merge partial updates instead of forcing broad rehydration.
5. Keep concurrency handling consistent with `last_known_update_date` on all stateful mutations.

---

## 6. Overview and review are useful, but still somewhat duplicative and too panel-driven

### Problem

The overview and review pages both add value, but they still repeat similar summary blocks and rely heavily on panel composition instead of stronger task hierarchy.

### Evidence

- `apps/web/components/Dashboard/Courses/CourseWorkspaceOverview.tsx`
- `apps/web/components/Dashboard/Courses/CourseReviewPublish.tsx`

### UX impact

- The user sees multiple summary cards without a clear difference between “understand this course” and “decide whether to publish”.
- The screens read as collections of cards rather than clearly prioritized actions.

### Suggested improvement

1. Make `Overview` answer: current state, gaps, next actions.
2. Make `Review` answer: is this safe to publish right now, and what exactly blocks publishing.
3. Keep only one dominant call to action per page.
4. Standardize page layout on shadcn `Card`, `Alert`, `Badge`, `Button`, and `Separator` rather than multiple custom summary wrappers.

---

## 7. Access and collaboration are operationally useful, but still fragmented in interaction design

### Problem

The current access and contributor screens work, but they still behave like separate admin tools embedded in one workspace.

### Evidence

- `apps/web/components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors.tsx`

### UX impact

- Visibility and group linking are tightly related, but not expressed as one policy model.
- Contributor openness, search, bulk add, role update, and status update are all present, but the screen is doing too much with too many local patterns.

### Suggested improvement

1. Reframe Access as “who can see this course”.
2. Reframe Collaboration as “who can edit or contribute”.
3. Use shadcn `RadioGroup` for policy choice and `Table` + `Command` + `Popover` for management actions.
4. Move destructive and bulk actions into predictable toolbar zones instead of mixing them into the same reading flow.
5. Show policy consequences inline with `Alert` instead of relying on user interpretation.

---

## 8. Curriculum editing remains too toast-driven and action-dense

### Problem

The curriculum editor is powerful, but it still behaves like a set of immediate APIs surfaced directly as drag-and-drop controls and modal actions.

### Evidence

- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ChapterElement.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ActivityElement.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/Buttons/NewActivityButton.tsx`

### UX impact

- The screen is efficient for experienced users, but the contract is easy to misread.
- Feedback depends too much on toasts.
- Content taxonomy styling risks looking decorative rather than structured.

### Suggested improvement

1. Keep optimistic editing, but show inline pending and saved states in-context.
2. Add lightweight inline status text for reorder and rename operations.
3. Reduce the number of color-coded affordances.
4. Use shadcn `Badge`, `DropdownMenu`, `AlertDialog`, `Sheet`, and `Skeleton` consistently.
5. Treat activity type as taxonomy, not as a color event.

---

## 9. The course area still has visual-system drift

### Problem

Some newer course-management surfaces already use tokens well, but the area still contains visual habits that weaken product trust: decorative gradients, heavy thumbnail overlays, hardcoded emphasis panels, and adjacent shell elements that read as custom-styled instead of system-styled.

### Evidence

- `apps/web/components/Objects/Thumbnails/CourseThumbnail.tsx` uses a strong gradient image overlay.
- `apps/web/components/Dashboard/Menus/DashSidebar.tsx` uses a gradient brand tile in the dashboard shell.
- `apps/web/components/Contexts/OrgContext.tsx` still contains a yellow gradient warning surface.
- `apps/web/components/Dashboard/Courses/courseWorkflowUi.tsx` is directionally correct, but still relies on custom helper classes rather than a tighter variant system.

### UX impact

- The app looks partly system-designed and partly manually embellished.
- The visual language becomes less trustworthy on operational screens.
- The product starts to look “vibecoded” instead of intentionally designed.

### Suggested improvement

1. Remove gradients from course-management surfaces and the adjacent dashboard shell where they frame the workspace.
2. Remove slate-style or manually picked status palettes from course-management flows.
3. Replace decorative overlays with plain token-based surfaces.
4. Prefer contrast through spacing, type, border, and icon rhythm instead of tinted spectacle.
5. Consolidate workspace styling into shared shadcn-aligned primitives and local variants.

---

## 10. Hard requirement: remove gradients and slate-coded styling from this workflow

### Rule

The course-management rewrite should explicitly reject the following patterns in this area:

1. `bg-gradient-*`, `from-*`, `via-*`, `to-*` for operational surfaces.
2. Hardcoded `slate-*`, `blue-*`, `purple-*`, `amber-*`, `pink-*`, `cyan-*` classes for routine status or taxonomy.
3. Hero-card styling on admin screens.
4. Dark inverted emphasis blocks used only to create visual drama.

### Replacement approach

Use only semantic tokens and component variants:

- `bg-background`
- `bg-card`
- `bg-muted`
- `text-foreground`
- `text-muted-foreground`
- `border-border`
- `ring-ring`
- `primary`
- `accent`
- `destructive`

If a state needs stronger meaning, express it through shadcn component variants first, not arbitrary palette picks.

---

## Recommended shadcn UI contract for course management

### Index

- `DataTable` for default list view
- `Input` for search
- `Tabs` or segmented filter controls for presets
- `DropdownMenu` for row actions
- `AlertDialog` for destructive bulk actions
- `Badge` for course state and readiness

### Creation

- `Card` for step layout
- `RadioGroup` for visibility, template, and destination choices
- `Input` and `Textarea` for basics
- `Alert` for warnings or template constraints
- `Button` for linear progression

### Workspace shell

- `Card` and `Separator` for layout hierarchy
- `Badge` for save state, visibility, and readiness
- `Alert` for warnings, blockers, and conflict notices
- `Skeleton` for loading within sections

### Edit sections

- `CardHeader` plus a shared section action row
- `Table` for contributors and access-linked resources
- `Command` plus `Popover` for search and add flows
- `AlertDialog` for destructive confirmation
- `Sheet` or `Dialog` for scoped creation actions

---

## Proposed rollout order - One shot

1. Remove legacy create modal usage from course-management entry points.
2. Normalize save contracts by section.
3. Tighten local-draft isolation from shared course refresh.
4. Extend consistent concurrency checks to all course mutations.

5. Make table view the default course index.
6. Simplify overview and review so each page has one dominant job.
7. Reframe Access and Collaboration around policy first, actions second.
8. Improve curriculum inline feedback and reduce toast dependency.

9. Remove gradients from the course-management area.
10. Remove hardcoded slate and other ad hoc status colors from the course-management area.
11. Convert remaining custom panels into shadcn `Card`, `Alert`, `Badge`, and `Table` compositions.
12. Consolidate local course-workflow helper classes into a tighter token-first variant layer.

---

## Success criteria

The rewrite is successful when the course-management area meets these conditions:

1. A user can describe the save model of each section without guessing.
2. Course creation has one canonical entry flow.
3. The course index feels like a management console, not a course gallery.
4. Overview and review are clearly differentiated.
5. Gradients and hardcoded palette styling are gone from this workflow.
6. The UI reads as shadcn-based product UI rather than custom one-off styling.
7. The course workspace feels stable under long editing sessions and concurrent edits.

---

## Bottom line

The current course-management rewrite has good direction, but it is still only halfway from “working feature set” to “coherent product”.

The next pass should prioritize workflow consistency and system design discipline over additional decorative UI. The right target is a management-first workspace built from shadcn/ui primitives, semantic tokens, and explicit editing contracts. Gradients, slate-heavy presentation, and hand-authored visual drama should be removed from this area entirely.
