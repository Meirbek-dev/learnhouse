# Course Management Rewrite Plan

**Date:** 2026-03-11
**Scope:** Course management experience in `apps/web` and supporting course-management flows in `apps/api`
**Primary Goal:** Rewrite the current course management experience into a coherent workspace with clear navigation, predictable save behavior, stronger feedback, and better task completion for course creators, maintainers, and org-level managers.

---

## Executive Summary

The current course management system is functional, but it is not a coherent product experience.

It behaves like a set of technical sections placed behind one route rather than a workflow designed around how people actually manage a course. Users move between list, create, edit, structure, access, contributors, and certification screens that each follow different rules for saving, permissions, refresh, and conflict handling. That inconsistency creates unnecessary cognitive load, especially for org-level staff who need to create and maintain many courses reliably.

The rewrite should not be a visual reskin. It should restructure the experience around the course lifecycle:

1. Find and assess courses quickly.
2. Create a course with enough guidance to start correctly.
3. Edit the course in a stable workspace with a clear mental model.
4. Understand what is draft, saved, blocked, published, or conflicted.
5. Complete core management tasks with fewer route changes and fewer hidden side effects.

The target product should feel closer to a modern content workspace than a tabbed admin page.

---

## Current State Assessment

## 1. The course index is usable, but weak as a management surface

### What works

- Server-rendered course loading with pagination, search, and sort is already in place.
- Course cards provide a visual browse experience.
- Users with create permission can open a create-course modal directly from the index.

### UX problems

- The page behaves more like a gallery than an operational management screen.
- Search, sort, result count, pagination, creation, and per-course actions are all present, but they are not organized around common management tasks.
- There is no strong segmentation for draft, published, private, recently updated, or needs-attention states.
- Card actions are partially hidden behind hover menus, which is weak for dense management workflows.
- There are no bulk actions, saved views, or quick filters for common maintenance tasks.
- The creation flow opens as a modal on top of the list, which is fast but too shallow for a high-value authoring workflow.

### Code-level evidence

- `apps/web/app/orgs/[orgslug]/dash/courses/client.tsx` organizes the page around a search bar, sort control, card grid, and pagination.
- `apps/web/components/Objects/Thumbnails/CourseThumbnail.tsx` emphasizes browsing and per-card menus rather than management density.
- `apps/web/components/Objects/Modals/Course/Create/CreateCourse.tsx` creates a course inside a modal with minimal onboarding.

### Consequence

The current list is adequate for small catalogs, but it is not the right primary tool for org staff managing many courses or returning repeatedly to maintain content quality.

---

## 2. The editor shell mirrors backend boundaries instead of user intent

### What works

- The course editor has a stable top area, tab navigation, and a shared provider.
- Tabs cover the key domains: general, content, access, contributors, certification.
- Conflict handling and dirty-state tracking have started to appear.

### UX problems

- The navigation is organized by technical sections, not by the user journey.
- There is no persistent overview of course state, publish readiness, save status, or issues requiring attention.
- The interface does not communicate a clear distinction between content authoring, settings, collaboration, and publishing.
- The editor opens as a full-height shell with tab switching, but not as a workspace with progressive completion.
- Access denial can happen after the shell has already loaded, which creates a broken-feeling route transition.

### Code-level evidence

- `apps/web/app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page-client.tsx` defines the editor around tabs and client-side permission filtering.
- `apps/web/app/orgs/[orgslug]/dash/courses/course/[courseuuid]/layout.tsx` and `apps/web/app/orgs/[orgslug]/dash/courses/layout.tsx` still split route access in a way that does not align cleanly with the detail workflow.
- `apps/web/components/Dashboard/Misc/CourseOverviewTop.tsx` provides identity and breadcrumbs, but not enough workspace context for course management.

### Consequence

Users are asked to understand the application structure before they can understand the course workflow.

---

## 3. Save behavior is still inconsistent enough to erode trust

### What works

- The older single global save pattern has already been reduced.
- Some sections now have explicit save buttons.
- Dirty-state tracking exists at the section level.

### UX problems

- The same section can contain both deferred and immediate writes.
- Users cannot reliably predict whether a change is local, saved, or still processing.
- Thumbnail updates, contributor actions, access updates, certification toggles, structure changes, and metadata edits all follow different persistence rules.
- The editor communicates state primarily through implementation behavior, not explicit UI language.

### Code-level evidence

- `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral.tsx` defers metadata save.
- `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/ThumbnailUpdate.tsx` uploads immediately.
- `apps/web/components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess.tsx` mixes section save with immediate user-group actions.
- `apps/web/components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors.tsx` mixes deferred settings with immediate contributor mutations.
- `apps/web/components/Dashboard/Pages/Course/EditCourseCertification/EditCourseCertification.tsx` mixes immediate lifecycle actions with deferred form edits.
- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure.tsx` performs immediate structural mutations.

### Consequence

The current UX forces users to guess the system contract. That is one of the fastest ways to make course management feel fragile.

---

## 4. Draft protection is still not reliable enough for heavy editing

### What works

- Dirty-state is tracked in shared course context.
- There is a browser unload guard.
- The editor attempts to intercept some in-app navigation.

### UX problems

- Draft protection still depends on route shape and link interception rather than one robust workspace leave policy.
- Shared course refreshes can still disturb local editing context.
- Users do not get a unified "unsaved work" view across the whole workspace.
- The editor does not offer a strong recovery model after conflict or refresh.

### Code-level evidence

- `apps/web/components/Contexts/CourseContext.tsx` combines canonical course data and dirty state in one shared provider.
- `apps/web/hooks/useUnsavedChangesGuard.ts` relies on `beforeunload`, document click interception, and `popstate` handling.
- `apps/web/app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page-client.tsx` attaches the guard at the course shell level.

### Consequence

Users doing longer editing sessions still have reason to distrust the editor, especially when combining structural edits, media changes, and configuration changes.

---

## 5. Permissions are technically rich, but experientially confusing

### What works

- The system has strong permission primitives for actions, resources, and scopes.
- Backend object metadata already exposes fine-grained action booleans in several places.

### UX problems

- Permissions are surfaced too late in some flows.
- The user can enter the shell and then discover that a tab is unavailable.
- The UI expresses permission states as disabled tabs and conditional rendering rather than role-aware task availability.
- Org-level and own-scope behavior is hard to reason about from the interface.

### Code-level evidence

- `apps/web/components/Security/PermissionProvider.tsx` performs exact client permission checks.
- `apps/web/app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page-client.tsx` filters visible tabs and redirects after render.
- `apps/web/app/orgs/[orgslug]/dash/courses/layout.tsx` and `apps/web/app/orgs/[orgslug]/dash/courses/course/[courseuuid]/layout.tsx` enforce access at different layers.

### Consequence

The product exposes the complexity of its permission system instead of translating it into a predictable experience.

---

## 6. Feedback, system status, and publishing readiness are underdesigned

### UX problems

- There is no clear saved/unsaved/saving/conflicted state model visible across the whole workspace.
- The course editor does not show readiness to publish or quality gaps in one place.
- Success, failure, and processing states rely too heavily on toasts.
- There is no central activity timeline or recent-changes context for collaborative editing.

### Consequence

The user has to remember the state of the course instead of reading it from the interface.

---

## Product Direction

The rewrite should target a course workspace built around tasks and course lifecycle stages, not backend tabs.

### Core product principles

1. One mental model per screen.
2. One save contract per workspace area.
3. Server-resolved capabilities, not client guesswork.
4. Drafts are durable and explain their state.
5. High-frequency tasks should take fewer clicks and fewer route changes.
6. The UI should always answer: what state is this course in, what can I do, and what is blocking me.

---

## Target Information Architecture

## 1. Course index becomes a management console

Replace the current card-first gallery with a management-first index that supports both browse and operations.

### Target layout

- Header with course count, create button, and quick filters.
- Saved view selector: All, Drafts, Published, Private, Recently Updated, Needs Attention.
- Search and advanced filters in one consistent toolbar.
- Density toggle for card view and table view.
- Table becomes the default for managers; card view remains optional for browse-heavy users.
- Bulk actions for archive, duplicate, visibility update, and export when permissions allow.

### Row design

Each course row should expose:

- name and thumbnail
- status badge set: draft, published, private, certificate enabled, collaboration open
- updated time and author
- structure metrics: chapters, activities
- quick warnings: missing description, no thumbnail, no content, unpublished changes
- primary actions: open workspace, preview, duplicate, archive/delete

### Why this matters

Course management is an operations problem as much as a browse problem. The list needs to support triage and maintenance, not just discovery.

---

## 2. Course creation becomes a guided setup flow

Replace the modal-first creation pattern with a lightweight creation sheet or dedicated setup flow.

### Target creation steps

1. Basic info: title, short description, visibility intent.
2. Template choice: blank course, copy existing, starter structure.
3. Optional collaborators and audience defaults.
4. Finish into the workspace with a clear next step.

### UX requirements

- Let users create quickly, but give enough scaffolding to avoid empty-course dead ends.
- Offer “create and continue” directly into curriculum editing.
- Show initial checklist items immediately after creation.

---

## 3. Course editor becomes a workspace with left-rail stages

Replace the flat tab strip with a persistent workspace navigation model.

### Recommended primary stages

1. Overview
2. Details
3. Curriculum
4. Access
5. Collaboration
6. Certificate
7. Review & Publish

### Stage responsibilities

- Overview: course summary, status, recent activity, unresolved issues, quick actions.
- Details: title, description, about, tags, learnings, cover media.
- Curriculum: chapters, activities, ordering, empty-state guidance, structure health.
- Access: visibility, audience, linked groups, enrollment rules.
- Collaboration: contributor settings, invite flow, role management.
- Certificate: certificate enablement and configuration.
- Review & Publish: preflight checklist, warnings, publish status, preview links.

### Why this is better

These stages map to how course owners think about the job. They separate authoring from governance and create a place to summarize readiness.

---

## 4. Overview becomes the control center for one course

The current editor opens straight into a subpage. The rewrite should open into a course overview screen.

### Overview content

- course identity, visibility, last updated, and key owners
- readiness checklist with clear blockers
- content summary: chapters, activities, unpublished items
- collaboration summary: contributors, pending invites, contribution openness
- certificate summary
- recent changes and conflicts if available
- primary actions: edit curriculum, preview course, review before publish

### Outcome

Users should no longer need to inspect multiple tabs just to understand the current state of a course.

---

## Interaction Model

## 1. Use two editing contracts, not five

The rewrite should standardize course management around two explicit interaction models.

### A. Form workspaces

Applies to:

- Details
- Access
- Collaboration settings
- Certificate settings

Behavior:

- local draft per stage
- sticky action bar with Save, Discard, and status label
- no hidden immediate writes for fields inside that stage
- validation inline and at submit
- clear “saved X seconds ago” messaging after success

### B. Structural canvas

Applies to:

- Curriculum

Behavior:

- immediate operations allowed for add, rename, move, publish/unpublish, remove
- every mutation uses optimistic UI plus undo where feasible
- persistent operation feedback inside the page, not toast-only
- conflict recovery is specific and visible

### Why split the model this way

Trying to force structural editing into the same contract as long-form form editing creates unnecessary friction. The right fix is not one universal save rule. The right fix is one clear save rule per workspace type.

---

## 2. Add persistent workspace status

Every editor screen should visibly communicate:

- save state
- conflict state
- last updated time
- active collaborators when available
- whether the current course is publish-ready

Recommended placement:

- header badge row near course title
- sticky action bar for form stages
- inline banners for conflicts and backend processing

---

## 3. Make system feedback local to the task

Toasts may remain supplemental, but they should stop being the primary way to understand what happened.

### Required improvements

- inline success confirmation after save
- inline validation summary for blocked publish/save
- section-level conflict banner with action choices
- visible loading skeletons and empty states for each workspace
- explicit processing state for media upload and long-running actions

---

## 4. Build a review and publish flow

The current experience lacks a strong preflight surface.

### Review & Publish page should include

- required fields checklist
- missing media or weak metadata warnings
- empty curriculum warnings
- access and discoverability summary
- certificate implications if enabled
- preview links
- publish or update confirmation

This page is where the UI should explain quality, not just data completeness.

---

## Technical Rewrite Plan

## 1. Split route responsibilities clearly

### New route structure

- `/orgs/[orgslug]/dash/courses`
  - management index
- `/orgs/[orgslug]/dash/courses/new`
  - optional guided creation flow if not using a sheet
- `/orgs/[orgslug]/dash/courses/[courseuuid]`
  - course workspace overview
- `/orgs/[orgslug]/dash/courses/[courseuuid]/details`
- `/orgs/[orgslug]/dash/courses/[courseuuid]/curriculum`
- `/orgs/[orgslug]/dash/courses/[courseuuid]/access`
- `/orgs/[orgslug]/dash/courses/[courseuuid]/collaboration`
- `/orgs/[orgslug]/dash/courses/[courseuuid]/certificate`
- `/orgs/[orgslug]/dash/courses/[courseuuid]/review`

### Route policy

- index and create routes use index-specific permissions
- workspace routes use course-specific capabilities
- unauthorized stages should be removed before render whenever possible

---

## 2. Replace tab-by-tab permission guessing with a server capability map

### Required model

The server should resolve and return a capability object for the workspace, for example:

- canViewWorkspace
- canEditDetails
- canEditCurriculum
- canManageAccess
- canManageContributors
- canManageCertificate
- canPublish
- canDeleteCourse

### Benefits

- one permission decision model for routes and navigation
- no client-side scope broadening ambiguity
- fewer access-denied after-load states
- easier QA matrix

---

## 3. Redesign shared state boundaries

### Course workspace provider should own only

- canonical course snapshot
- capability map
- revision metadata such as `last_known_update_date`
- workspace-level status and conflict state
- lightweight summary metrics used across stages

### Stage-local hooks should own

- form drafts
- validation state
- save state
- transient UI state

### Result

Shared canonical data stops resetting local drafts unexpectedly.

---

## 4. Standardize data ownership and freshness

### Mutation policy

- mutation services own server cache invalidation
- stage hooks own local optimistic state and SWR mutate
- `router.refresh()` only when route-level server data actually changed
- remove client dependence on publicly callable revalidation routes for normal editing flows

### Query policy

- workspace shell fetches overview snapshot and capability map
- each stage fetches only the data it owns when entering that stage
- all stage fetches go through shared service helpers and shared key factories

---

## 5. Extend optimistic concurrency to the whole workspace

Every stateful course mutation should use the same revision contract.

### Required coverage

- details update
- access update
- contributor setting update
- certificate config update
- chapter create, rename, reorder, delete
- activity create, reorder, publish, delete
- media updates where course state changes

### UX requirement

When conflicts occur, the UI must present a structured recovery choice:

- reload latest
- keep local draft for comparison where feasible
- retry after refresh

---

## 6. Replace timing-based UI waits with explicit readiness contracts

Media workflows should stop depending on arbitrary delays.

### Required backend support

- return finalized media metadata when the upload is complete, or
- return processing state and a polling contract

### Required UI behavior

- show media processing inline
- update preview only when authoritative media state is ready

---

## UX Rewrite Phases (One shot it)

### Deliverables

- final information architecture
- permission matrix by route and stage
- draft/save contract by stage
- publish-readiness rules
- success metrics baseline

### Exit criteria

- team agrees on one interaction model for form stages and one for curriculum
- no unresolved ambiguity about permission ownership or save semantics

---

### Deliverables

- management-first course index
- table and card modes
- quick filters and saved views
- stronger row actions and status badges
- revised creation entry point

### UX win

Managers can find, assess, and act on courses faster without opening each one.

---

### Deliverables

- new left-rail workspace shell
- overview page with readiness and summary cards
- server capability map wired into navigation
- workspace-level status bar and conflict banner

### UX win

Users understand course state immediately and stop using tabs as a discovery mechanism.

---

### Deliverables

- stage-local draft hook for details
- sticky save/discard bar
- media flow with explicit processing state
- no draft resets from unrelated shared updates

### UX win

The highest-frequency settings workflow becomes stable and predictable.

---

### Deliverables

- cleaner curriculum canvas
- stronger empty states and creation affordances
- inline operation feedback and undo where feasible
- full concurrency coverage for structural mutations

### UX win

Curriculum editing becomes fast without feeling dangerous.

---

### Deliverables

- separate access and collaboration workspaces
- unified form-stage save model
- invite and contributor flows that feel task-based instead of table-first
- certificate workflow separated into enablement, config, preview, and review

### UX win

Governance tasks become understandable for org admins and course owners alike.

---

### Deliverables

- review and publish stage
- readiness checklist and warnings
- preview flows
- publish history or last-published summary if backend support exists

### UX win

The system helps users finish a course, not just edit fields.

---

## Design Requirements

## Visual direction

- professional workspace tone, not consumer-gallery tone
- stronger hierarchy and denser information where appropriate
- status communicated with badges, summaries, and persistent state indicators
- mobile support for list and overview, but desktop-first optimization for authoring workflows

## Interaction requirements

- keyboard-friendly table and editor navigation
- accessible confirmation and validation patterns
- reduced reliance on hover-only affordances
- fewer modal stacks inside the editor

## Content design requirements

- every destructive action explains impact
- every blocked save explains the cause and recovery path
- every review warning is actionable, not generic

---

## Success Metrics

The rewrite should be measured, not judged only visually.

### Product metrics

- lower time-to-create-first-usable-course
- lower time-to-complete-common maintenance tasks
- reduced abandoned editing sessions
- reduced permission-related navigation failures
- reduced conflict-related support issues

### UX quality metrics

- fewer unsaved-change losses
- fewer unnecessary route transitions per task
- higher completion rate for publish readiness checklist
- lower dependence on toast-only feedback for critical actions

### Engineering metrics

- fewer duplicated fetch patterns across stages
- consistent mutation contracts and revalidation ownership
- full concurrency coverage for course mutations

---

## Recommended Implementation Order

1. Finalize IA, permission matrix, and save contracts.
2. Build the new course index and creation entry.
3. Build the new workspace shell and course overview.
4. Move details to stage-local draft architecture.
5. Rewrite curriculum with explicit operation feedback and conflict handling.
6. Rewrite access, collaboration, and certificate stages.
7. Add review and publish.
8. Remove legacy tab-based routing and redundant freshness paths.

---

## Bottom Line

The current course management system does not mainly suffer from missing features. It suffers from an inconsistent user contract.

The rewrite should therefore focus first on workflow clarity, save predictability, permission clarity, and workspace state visibility. If those foundations are fixed, the UI can become simpler and more powerful at the same time. Without that foundation, any purely visual redesign will leave the core UX problems intact.
