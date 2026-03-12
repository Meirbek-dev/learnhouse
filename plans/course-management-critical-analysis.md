# Course Management Workflow, UI, and UX Critical Analysis Plan

## Scope

This plan covers the current course management surface across:

- `apps/web/app/orgs/[orgslug]/dash/courses/**`
- `apps/web/components/Dashboard/Courses/**`
- `apps/web/components/Dashboard/Pages/Course/**`
- supporting hooks and services used by the workflow

The goal is not a cosmetic polish pass. The goal is to fix the workflow model, remove current bugs, and bring the UI back under a consistent shadcn-based design system.

## Executive Summary

The current course management rewrite has the right broad direction: a dedicated course index, guided creation, a course workspace, explicit save flows for form sections, and a review/publish stage. The implementation is not coherent enough yet.

The main problems are:

- authorization is over-permissive in the workspace shell and route model
- filtering, totals, and summary cards are computed from paginated subsets, so the dashboard can show incorrect numbers and empty states
- curriculum mutations still bypass the concurrency strategy the rewrite already established
- edit sections mix staged and immediate-save behaviors in ways that are hard to reason about
- destructive actions still use invalid trigger composition in several places
- the visual layer is inconsistent and still carries “vibecoded” cues: gradients in shared chrome, ad hoc warning colors, and improvised spacing and interaction patterns

This plan prioritizes fixing correctness and mental-model issues first, then tightening the UI around shadcn primitives and token-based styling.

## Confirmed Problems And Suggested Fixes

### P0. Workspace authorization is too broad and can leak stage access

Files:

- `apps/web/lib/course-management-server.ts`
- `apps/web/app/orgs/[orgslug]/dash/courses/[courseuuid]/layout.tsx`
- all stage pages under `apps/web/app/orgs/[orgslug]/dash/courses/[courseuuid]/**`

Problem:

- `getCourseWorkspaceCapabilitiesForOrg` derives permissions at the org level and treats `Scopes.OWN` as a global capability without resolving whether the current course is actually owned by the current user.
- the `[courseuuid]/layout.tsx` route guard allows any user with update, manage, or certificate-create capability into the whole workspace tree.
- individual stage routes do not add stage-specific server authorization.

Impact:

- a user with only “own course” permissions can be shown edit capabilities for courses they do not own
- a certificate manager can get into details or curriculum routes directly by URL even if the UI hides the tabs later
- the shell capability map is not a trustworthy authorization boundary

Suggested fix:

- resolve workspace capabilities against the actual course record, not just org session scopes
- split route guards by stage: details and curriculum need course update permission, access and collaboration need course manage permission, certificate needs certificate permission, review should follow publish-review policy
- keep the capability map as a UI convenience only after server authorization is correct

### P0. Course dashboard filtering and counts are mathematically wrong

Files:

- `apps/web/app/orgs/[orgslug]/dash/courses/page.tsx`
- `apps/web/app/orgs/[orgslug]/dash/courses/client.tsx`

Problem:

- the page fetches one paginated backend slice, then applies preset filtering on that slice only
- summary cards in `client.tsx` derive “ready”, “private”, and “attention” counts from the visible page data, not from the full result set
- `totalCourses` is still the backend total for the unfiltered query, so pagination and counts drift apart

Impact:

- preset pages can show empty results even when matching courses exist on later pages
- counts in the summary cards are wrong for any org with more than one page of courses
- users cannot trust the dashboard state

Suggested fix:

- move preset filtering into the backend query contract
- return filtered totals from the server
- return aggregate summary stats from the server instead of deriving them from the current page slice

### P0. Curriculum mutations still bypass concurrency protection

Files:

- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ChapterElement.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ActivityElement.tsx`
- `apps/web/services/courses/chapters.ts`
- `apps/web/services/courses/activities.ts`

Problem:

- the rewrite foundation explicitly calls for `last_known_update_date` style protection on stateful mutations, but chapter and activity operations still do not consistently send concurrency metadata
- chapter rename, chapter delete, activity rename, activity publish, activity delete, and several create flows mutate directly and then revalidate
- reorder uses conflict handling, but most row-level mutations do not

Impact:

- two editors can overwrite each other silently in curriculum editing
- the UI already has a conflict dialog, but large parts of the curriculum surface do not participate in that model
- users can lose edits without a clear explanation

Suggested fix:

- extend `last_known_update_date` handling to all chapter and activity mutations
- standardize all stateful course mutations behind one mutation layer with the same conflict contract
- only keep optimistic updates where rollback and conflict states are explicit and tested

### P1. Access and collaboration use split persistence models that confuse users

Files:

- `apps/web/components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors.tsx`

Problem:

- access policy is staged and requires Save
- user-group linking applies immediately
- contributor policy is staged and requires Save
- contributor add, remove, role change, and status change apply immediately

Impact:

- each page has two persistence models at once
- the UI explains this in alerts, which is already a signal that the behavior is not self-evident
- users have to remember which controls are drafts and which controls are live mutations

Suggested fix:

- split these pages into clearly separated sections with different headers and action areas
- use one explicit “Policy” card for staged settings and one explicit “Live memberships” card for immediate mutations
- visually separate local draft actions from server-live actions with different affordances and copy
- if possible, move all policy editing to staged save and all membership editing to row-level actions with no shared Save bar

### P1. Invalid trigger composition still exists in destructive actions

Files:

- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ChapterElement.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ActivityElement.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess.tsx`

Problem:

- `AlertDialogTrigger` wraps `Button` in several places instead of using the shadcn `render` or `asChild` style composition that the codebase already uses elsewhere

Impact:

- invalid nested interactive elements
- inconsistent click behavior and accessibility semantics
- destructive controls remain brittle in the exact flows that need to feel safest

Suggested fix:

- refactor all dialog and dropdown triggers to the same composition pattern used elsewhere in the repo
- treat this as a shared cleanup rule for the whole dashboard, not a one-off course fix

### P1. Shared save infrastructure is only half adopted

Files:

- `apps/web/hooks/useSaveSection.ts`
- `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseCertification/EditCourseCertification.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure.tsx`

Problem:

- `useSaveSection` exists to centralize save, conflict, refresh, and toast behavior
- not all sections use it
- `useSaveSection` itself still contains hardcoded English strings and two near-duplicate save paths
- curriculum editing uses a different mutation model entirely

Impact:

- inconsistent save UX across stages
- translation coverage is incomplete
- conflict handling is uneven
- maintenance cost stays high because new bugs are fixed per page instead of once in the save layer

Suggested fix:

- make `useSaveSection` the default path for staged forms
- inject translated copy into the hook instead of hardcoding messages
- split the hook into a single configurable mutation primitive if necessary, rather than carrying duplicated save functions
- keep curriculum separate only if its immediate-save model is intentionally different and fully conflict-safe

### P1. Curriculum rows are overloaded with too many interaction modes

Files:

- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ChapterElement.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ActivityElement.tsx`

Problem:

- the same row is simultaneously a drag handle, an inline editor, a status surface, a publish toggle, a preview launcher, and a destructive action container

Impact:

- noisy layout
- weak scanability
- frequent accidental clicks during drag-heavy workflows
- mobile degradation because the row action density is too high

Suggested fix:

- make the drag handle the only draggable target, not the whole card
- move secondary actions into a compact overflow menu on desktop and a bottom sheet on mobile
- keep only the most important inline signals visible: name, type, publish state, and conflict or error state
- reserve inline editing for the selected row, not every row by default

### P1. Current stage chrome does not fully match the workflow model

Files:

- `apps/web/components/Dashboard/Courses/CourseWorkspacePageShell.tsx`
- `apps/web/components/Dashboard/Courses/CourseWorkspaceOverview.tsx`
- `apps/web/components/Dashboard/Courses/CourseReviewPublish.tsx`

Problem:

- the shell is route-based, but the visual treatment still behaves like a tab strip plus status bar plus command bar compressed into one sticky header
- overview, review, and edit stages repeat similar readiness and status blocks with slightly different tone and structure
- review is positioned like the final gate, but publish state is still editable from other places

Impact:

- the workspace lacks a single clear source of truth for “what state is this course in?”
- users have to re-read the same readiness state in different layouts

Suggested fix:

- keep route-based navigation, but simplify the chrome to three layers only: breadcrumb, title and status row, stage navigation
- define one reusable readiness summary component used by overview and review
- centralize publish and visibility decisions in review, or make the exceptions explicit

### P2. Translation fallbacks are being used as if `next-intl` supported default copy

Files:

- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ChapterElement.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ActivityElement.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors.tsx`

Problem:

- multiple calls use `t('key', { default: '...' })`
- this is not a reliable fallback strategy in this codebase and leaves translated copy ambiguous

Impact:

- inconsistent localized output
- hidden message-key failures during QA

Suggested fix:

- remove fake fallback usage
- add the missing messages explicitly
- fail fast in development for missing course-management translations

### P2. The current visual language still looks improvised instead of system-driven

Files:

- `apps/web/components/Dashboard/Courses/courseWorkflowUi.tsx`
- `apps/web/components/Dashboard/Menus/DashSidebar.tsx`
- several course workspace pages using one-off muted panels and alert styling

Problem:

- shared dashboard chrome still uses gradient styling in places such as the sidebar org badge
- warning and status treatments are hand-assembled instead of coming from a consistent token strategy
- course pages use repeated ad hoc card and panel combinations rather than a small set of approved surface patterns

Impact:

- the UI feels assembled from local decisions instead of one design system
- gradients and flashy accents cheapen an otherwise enterprise workflow
- future maintenance will continue to reintroduce off-brand styles unless there is a clear rule set

Suggested fix:

- remove gradients from course management and its shared dashboard shell
- do not use `slate-*`, `gray-*`, `neutral-*`, or hardcoded amber classes for core workflow surfaces
- standardize on shadcn semantic tokens: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-destructive`
- define a small status vocabulary for course workflow badges and alerts, then reuse it everywhere

## Recommended UX And UI Direction

### 1. Course Index

Use the course index as an operational dashboard, not a gallery.

Recommended structure:

- top row: page title, one primary `New course` action, saved filters, search
- second row: server-truth summary cards using real aggregate counts
- main area: table-first by default, cards as an alternate view
- bulk actions: sticky toolbar that appears only when rows are selected

Shadcn components to lean on:

- `Card` for summary blocks
- `DataTable` for the main surface
- `Select`, `Input`, `Badge`, `Button`, `DropdownMenu`, `AlertDialog`

### 2. Course Creation Wizard

The wizard direction is good, but it should feel more operational and less decorative.

Recommended changes:

- keep the 3-step flow
- reduce the hero-like treatment and make the summary panel denser
- avoid large ornamental step visuals; use a cleaner shadcn stepper treatment or segmented progress row
- make template behavior explicit: blank, starter outline, or chapter-only copy from source

### 3. Workspace Shell

The shell should communicate status first and options second.

Recommended structure:

- breadcrumb row
- title row with course name, status badges, and a small action cluster
- stage nav row
- page body with one consistent max width and spacing system

Remove:

- redundant readiness blocks repeated across overview and review
- decorative emphasis that competes with course status

### 4. Details, Access, Collaboration, Certificate

Every staged section should use the same mental model:

- section header with dirty state, discard, save
- primary form card
- secondary informational cards below
- destructive or live-mutation areas isolated in their own card with explicit copy

Use `SectionHeader`, `Card`, `Form`, `Alert`, `Separator`, `Table`, and `Dialog` consistently.

### 5. Curriculum Editor

This should feel like a structured editor, not a pile of draggable tiles.

Recommended changes:

- chapter cards become calmer containers with smaller shadows and no theatrical drag state
- drag only from the grip handle
- row actions move into overflow menus
- add clear saved, saving, conflict, and error states near the section header and the affected row
- reserve inline editing for one selected entity at a time

### 6. Review And Publish

Review should be the authoritative launch gate.

Recommended changes:

- readiness checklist on the left
- publish state and launch controls on the right
- one reusable readiness summary shared with overview
- no other stage should feel like an alternative publish control center unless that is a deliberate product rule

## Visual System Cleanup Rules

Apply these rules across course management and any shared dashboard surfaces it depends on.

- use shadcn primitives and semantic tokens only for core surfaces
- remove gradients from the course workspace, course dashboard, and shared sidebar elements used in those flows
- remove slate, gray, and neutral utility classes from course-management-adjacent UI
- do not invent status styles locally; route them through shared badge and alert variants
- prefer `Card` plus `Separator` over custom muted panel stacks unless there is a proven reuse case
- keep shadows subtle and functional; avoid high-drama drag states, rotations, or flashy badges

## Prioritized Delivery Plan - One shot

- fix capability resolution so route guards and visible stages are course-aware
- move preset filtering and aggregate counts to the backend
- add concurrency metadata to all chapter and activity mutations
- standardize conflict handling for curriculum row actions

- unify staged section save behavior behind shared infrastructure
- split staged policy editing from live membership editing in access and collaboration
- refactor invalid dialog trigger composition
- simplify curriculum row actions and drag behavior

- remove gradients from shared dashboard chrome used by course management
- replace ad hoc status styling with shared workflow variants
- normalize spacing, panel structure, and badge treatments across overview, review, and edit stages
- audit and remove remaining hardcoded non-semantic color utilities in course management files

- verify permissions by role and by ownership
- verify multi-editor conflict behavior on the same course
- verify pagination, preset filters, and summary counts on orgs with more than one page of courses
- verify localization coverage for all course workflow messages
- verify desktop and mobile behavior for curriculum action density

## Acceptance Criteria

- a user cannot access a stage they are not authorized for, even by direct URL
- dashboard totals, presets, and pagination remain correct for large orgs
- concurrent edits produce explicit conflict handling instead of silent overwrites
- every staged edit page follows the same save and discard model
- live mutations are visually and behaviorally separate from staged form edits
- curriculum rows are calmer, easier to scan, and safer to operate
- course management uses shadcn tokens and components without gradients, slate, gray, or neutral hacks in shared workflow UI

## Final Recommendation

Do not treat this as a pure styling pass. The biggest problems are product-model and systems problems: authorization, concurrency, and mixed persistence semantics. Fix those first, then apply the design cleanup so the UI accurately communicates how the system works.
