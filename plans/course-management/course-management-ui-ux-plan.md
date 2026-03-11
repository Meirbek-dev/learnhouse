# Course Management UI/UX Improvement Plan

**Date:** 2026-03-11
**Scope:** `apps/web` course management experience
**Primary Goal:** Turn course management into a coherent, management-first workspace built on shadcn/ui primitives and semantic design tokens, while removing gradients, slate-heavy styling, and hardcoded colors that currently break visual consistency and dark-theme support.

---

## Executive Verdict

The current course-management area is partially improved from the older tabbed editor, but it still reads like several unrelated implementations stitched together.

The main workflow problems are not only structural. The visual system is also inconsistent enough to lower trust:

1. Course creation exists in more than one pattern.
2. The course index still mixes browse UI and management UI.
3. The workspace shell is stronger than before, but sections still follow different save contracts and different interaction patterns.
4. Multiple screens use hardcoded slate, cyan, amber, blue, purple, pink, and gradient styling instead of theme tokens.
5. Several high-importance areas look custom-styled rather than system-designed, which makes the product feel unstable and weakens dark theme support.

This should not be fixed by repainting isolated components. The course area needs one product-level UI contract and one design-system contract.

---

## Current Workflow Summary

### 1. Entry points are split

There are currently multiple creation paths:

- The newer wizard flow at `apps/web/app/orgs/[orgslug]/dash/courses/new/page.tsx` using `CourseCreationWizard.tsx`.
- The older modal flow in `apps/web/components/Objects/Modals/Course/Create/CreateCourse.tsx`.
- Additional trigger usage in landing and legacy course surfaces.

This means the product does not yet have one canonical course-creation experience.

### 2. The index page is halfway between a gallery and an admin tool

The current dashboard list supports search, sort, presets, selection, and pagination, which is good. But the page still has one foot in browse-first presentation and one foot in management-first operations.

This creates a mismatch:

- Managers need density, bulk actions, saved views, and predictable status indicators.
- The UI still spends too much space on decorative presentation and per-card interaction.

### 3. The workspace is better organized, but not fully coherent

The new workspace shell, overview page, review page, and capability model are the right direction. However, the actual edit sections still behave differently enough that users cannot carry a stable mental model from one stage to the next.

### 4. The visual system is inconsistent at the exact points where users need confidence

The most operational screens still rely on hardcoded color decisions rather than semantic tokens:

- access toggle cards
- contributor selection states
- curriculum activity badges and action buttons
- certificate preview themes
- conflict and warning states
- some workspace summary panels using inverted foreground/background blocks

This is why parts of the product still feel improvised.

---

## Critical Problems

## 1. Course Creation Is Still Split Across Old And New UX

### Problem

The product currently has both a wizard-based creation flow and an older modal-based creation flow.

### Evidence

- `apps/web/app/orgs/[orgslug]/dash/courses/new/page.tsx`
- `apps/web/components/Dashboard/Courses/CourseCreationWizard.tsx`
- `apps/web/components/Objects/Modals/Course/Create/CreateCourse.tsx`
- `apps/web/components/Landings/CreateCourseTrigger.tsx`

### Why this matters

- Users do not learn one creation workflow.
- The modal is too shallow for a high-value creation task.
- Different entry points can produce different expectations around templates, visibility, and post-create navigation.

### Improvement

1. Make the wizard the only canonical creation flow.
2. Replace modal-based creation triggers with navigation to `/dash/courses/new`.
3. Keep only one lightweight quick-create variant if it is explicitly scoped to a different context, otherwise remove it.
4. Use shadcn `Card`, `Button`, `RadioGroup`, `Select`, `Tabs` or step navigation primitives consistently inside the wizard.

---

## 2. The Course Index Still Looks Like A Browse Screen More Than A Management Console

### Problem

The current index already has operational features, but the interaction model is still not optimized for repeated management work.

### Evidence

- `apps/web/app/orgs/[orgslug]/dash/courses/page.tsx`
- `apps/web/app/orgs/[orgslug]/dash/courses/client.tsx`
- `apps/web/components/Objects/Thumbnails/CourseThumbnail.tsx`

### Symptoms

- Key course states are visible, but not organized as an operational summary.
- Bulk actions exist, but the surrounding layout is still visually closer to content browsing.
- Important maintenance presets such as draft, private, needs attention, and recently updated do not yet feel like first-class management modes.

### Improvement

1. Make table view the default management mode.
2. Keep card view as an optional browse mode, not the primary layout.
3. Build the page around shadcn `DataTable`, `Tabs`, `DropdownMenu`, `Input`, `Badge`, `Pagination`, and bulk-action `AlertDialog` patterns.
4. Promote presets into a first-row control model: `All`, `Drafts`, `Published`, `Private`, `Recent`, `Needs attention`.
5. Standardize row metadata into semantic badges only, not decorative colored labels.
6. Add a fixed page summary row that answers: total courses, drafts, public, attention needed.

---

## 3. The Workspace Shell Has Improved, But Still Overuses Custom Panels And Inverted Blocks

### Problem

The workspace shell is structurally better than the old tabbed editor, but several summary areas still rely on strong inverted panels like `bg-foreground text-background` or other custom visual blocks.

### Evidence

- `apps/web/components/Dashboard/Courses/CourseWorkspacePageShell.tsx`
- `apps/web/components/Dashboard/Courses/CourseWorkspaceOverview.tsx`
- `apps/web/components/Dashboard/Courses/CourseReviewPublish.tsx`
- `apps/web/components/Dashboard/Courses/CourseCreationWizard.tsx`

### Why this is a problem

- It creates visual competition instead of hierarchy.
- It pushes the UI away from the rest of the app's design system.
- It often looks acceptable in one theme and heavy-handed in another.

### Improvement

1. Rebuild summary panels on top of standard shadcn `Card` compositions.
2. Reserve strong emphasis for one primary action zone per screen, not multiple dark or inverted blocks.
3. Use semantic tokens only: `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `ring-ring`, `accent`, `primary`, `destructive`.
4. Keep navigation and status density high, but tone visual styling down so hierarchy comes from layout, spacing, and typography rather than color blocks.

---

## 4. Save And Interaction Models Still Change From Section To Section

### Problem

The workspace still mixes immediate-save and deferred-save behavior inside the same overall editing flow.

### Evidence

- `EditCourseGeneral.tsx` defers form fields but `ThumbnailUpdate.tsx` saves immediately.
- `EditCourseAccess.tsx` defers visibility changes while linked user-group actions are immediate.
- `EditCourseContributors.tsx` defers openness settings while contributor mutations are immediate.
- `EditCourseCertification.tsx` mixes immediate lifecycle actions with deferred configuration.
- `EditCourseStructure.tsx` remains immediate and optimistic.

### UX impact

- Users cannot predict what is already saved.
- Toasts carry too much of the state communication.
- The workspace feels procedural instead of intentional.

### Improvement

1. Define one save contract per section.
2. Show one consistent section status row using shadcn `Badge`, `Button`, `Separator`, and `Alert` patterns.
3. Keep curriculum immediate, but add clearer inline saving states and conflict treatment.
4. For General, Access, Contributors, and Certificate, keep explicit Save and Discard actions and avoid immediate side effects inside the same card group.
5. If thumbnails or certification lifecycle actions must remain immediate, separate them into clearly isolated sub-panels labeled as immediate actions.

---

## 5. Access And Contributors Screens Depend On Slate-Heavy, Hardcoded Selection Styling

### Problem

These screens currently use explicit `slate-*` classes and custom selected/unselected cards for core choice controls.

### Evidence

- `apps/web/components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors.tsx`

### Why this is a problem

- Hardcoded slate does not adapt cleanly to theme changes.
- It creates a disconnected palette from the rest of the system.
- It makes selection states depend on arbitrary color rather than reusable component states.

### Improvement

1. Replace custom choice cards with theme-aware shadcn patterns:
   - `RadioGroup` for public/private and contributor openness.
   - `Card` with `data-state` styling using semantic tokens.
   - `Switch` only where binary toggles are truly low-risk and immediate.
2. Replace `slate-*` classes with semantic tokens and component variants.
3. Rework selected states to use border, ring, background-muted, and icon opacity rather than dark hardcoded fill.
4. Use shadcn `Table`, `Command`, `Popover`, `Badge`, and `Avatar` consistently for contributor management.

---

## 6. Curriculum Editing Uses Hardcoded Type Colors That Feel Decorative Rather Than Systemic

### Problem

Activity types and some actions are styled with explicit purple, blue, orange, pink, amber, and cyan classes.

### Evidence

- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ActivityElement.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ChapterElement.tsx`
- `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure.tsx`

### Why this is a problem

- The colors feel authored per-component instead of derived from a design system.
- Multiple bright hues on one screen make the curriculum editor look less professional.
- The same hues are not guaranteed to maintain contrast or consistency in dark mode.

### Improvement

1. Reduce activity-type differentiation to subdued badge variants.
2. Use shadcn `Badge` with tokenized variants or a small internal mapping built on semantic utility classes only.
3. Reserve strong color for status, risk, or primary action, not content taxonomy.
4. Replace custom cyan call-to-action blocks with normal `Button` variants.
5. Let typography, iconography, spacing, and drag affordances carry more of the hierarchy.

---

## 8. Warning, Conflict, And Status UI Need A Shared System

### Problem

Conflict, attention, and status states are currently rendered with local styling decisions rather than one reusable status language.

### Evidence

- `apps/web/components/Dashboard/Pages/Course/CourseConflictDialog.tsx`
- `apps/web/components/Dashboard/Courses/CourseReviewPublish.tsx`
- `apps/web/components/Dashboard/Courses/CourseWorkspaceOverview.tsx`

### Improvement

1. Standardize all status messaging on shadcn `Alert`, `AlertDialog`, `Badge`, `Progress`, and `Skeleton` patterns.
2. Introduce shared variants for `info`, `success`, `warning`, and `destructive` based on semantic tokens.
3. Remove page-specific amber, cyan, and slate styling overrides where possible.
4. Make readiness and blockers readable through content structure first, color second.

---

## Design-System Rules For The Rewrite

These rules should be treated as hard constraints for course management.

### 1. Use shadcn/ui as the primary component language

Base all new course-management UI on:

- `Card`
- `Button`
- `Input`
- `Textarea`
- `Select`
- `RadioGroup`
- `Switch`
- `Tabs`
- `Badge`
- `Alert`
- `AlertDialog`
- `Dialog`
- `DropdownMenu`
- `Popover`
- `Command`
- `Table` or `DataTable`
- `Separator`
- `ScrollArea`
- `Skeleton`
- `Progress`
- `Tooltip`
- `Breadcrumb`

### 2. Use semantic tokens, not palette names

Allowed direction:

- `bg-background`
- `bg-card`
- `bg-muted`
- `bg-accent`
- `text-foreground`
- `text-muted-foreground`
- `border-border`
- `ring-ring`
- standard variant tokens like `primary`, `secondary`, `outline`, `destructive`

Avoid in course management UI:

- `slate-*`
- `zinc-*`
- `stone-*`
- `gray-*` for component styling unless already wrapped by a tokenized variant
- hardcoded hue classes like `bg-cyan-800`, `text-purple-700`, `border-amber-300`
- inline hex colors for presentation UI

### 3. No gradients in course management surfaces

Remove:

- decorative background gradients
- gradient text
- inline radial or linear gradient patterns used as decoration
- hue-pack certificate themes based on gradients

If visual emphasis is needed, use:

- stronger typography
- card grouping
- border emphasis
- muted background sections
- iconography
- spacing
- progress and badge variants

### 4. Dark theme must be first-class

Every core course-management screen should remain legible and visually stable in dark mode without page-specific overrides.

This means:

- no dependence on light-only slate shades
- no foreground/background inversions that assume one theme
- no custom hue maps without contrast verification

---

## Target UX Direction

## 1. Course Index

### Target state

- Management-first page header with actions, counts, filters, and saved views.
- Table-first layout with optional card mode.
- Bulk actions always visible when selection exists.
- Clear operational badges for state, visibility, readiness, and recent activity.

### shadcn composition

- `Card` for summary metrics
- `Tabs` for presets
- `Input` plus `Select` for search and sort
- `DataTable` for default list mode
- `DropdownMenu` for row actions
- `Pagination` pattern for navigation

## 2. Course Creation

### Target state

- One canonical wizard
- three clear steps: basics, template, launch
- no modal fallback for the main dashboard path
- consistent summary panel built with cards, badges, and descriptive text only

### shadcn composition

- `Card` per step
- `RadioGroup` for template and launch choices
- `Input` and `Textarea` for basics
- `Alert` for warnings and requirements
- `Breadcrumb` or simple stepper pattern

## 3. Course Workspace

### Target state

- left rail stays, but visual hierarchy becomes quieter and more systematic
- top header shows identity, save state, readiness, and key actions without competing hero blocks
- each section starts with the same pattern: summary, editable surface, status row, save/discard actions when relevant

### shadcn composition

- `Sidebar` for rail
- `Card` for all summary panels
- `Badge` for state chips
- `Alert` for blockers or conflicts
- `Progress` for readiness
- `Separator` for section boundaries

## 4. Edit Sections

### General

- standard form card
- media actions separated into their own card
- one explicit draft state model

### Curriculum

- cleaner drag-and-drop rows
- subdued type badges
- inline action menus via `DropdownMenu`
- consistent optimistic-save indicators

### Access

- `RadioGroup` for visibility
- linked user groups in a standard table/list card
- immediate actions clearly labeled when they are immediate

### Collaboration

- contributor openness uses same pattern as access
- contributor table and search use `Command`, `Popover`, `Avatar`, `Badge`, `Table`
- bulk contributor actions move into standard toolbar controls

### Certificate

- form and preview split into stable cards
- preview templates reduced and normalized
- remove decorative gradient themes entirely

### Review

- one publish readiness screen with blockers, recommendations, and launch state
- warnings and blockers rendered through shared `Alert` and `Badge` variants

---

## Implementation Plan (One shot)

1. Add a course-management design rule doc section or local lint guideline: no gradients, no `slate-*`, no hardcoded hue classes in course-management UI.
2. Define shared status and badge variants for course workflows.
3. Audit existing components for token violations and create a tracked cleanup list.

4. Remove dashboard reliance on modal-based course creation.
5. Route all course creation to the wizard.
6. Simplify the course index header and action layout around one primary create path.

7. Make table view the default.
8. Normalize badges and filters.
9. Improve bulk-action affordances.
10. Reduce decorative card treatment in management mode.

11. Replace inverted summary blocks with tokenized cards.
12. Standardize readiness, dirty, and conflict language.
13. Make section headers and action rows structurally identical.

14. General: separate media actions from deferred draft fields.
15. Access: replace custom cards with radio-group-based selection.
16. Contributors: same selection model as access; standardize search and table styling.
17. Curriculum: reduce decorative type colors and custom CTA styling.
18. Certificate: remove gradient themes and convert preview to structured variants.

19. Delete or retire old modal creation paths where redundant.
20. Remove duplicated styling rules that conflict with shadcn semantics.
21. Re-audit dark theme behavior across all course-management screens.

---

## Acceptance Criteria

The rewrite should be considered successful only if all of the following are true:

1. Course creation has one canonical workflow.
2. The course index works as a management console first, not a gallery first.
3. Every major section uses a predictable save model.
4. Course-management screens use shadcn/ui components and semantic tokens consistently.
5. Gradients are removed from course-management surfaces.
6. `slate-*` and hardcoded hue classes are removed from course-management UI except where wrapped behind a shared tokenized variant.
7. Dark theme remains legible and visually coherent without section-specific hacks.
8. Readiness, conflict, warning, and unsaved states share one reusable status system.

---
