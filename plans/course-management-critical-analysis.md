# Course Management — Critical Analysis & Improvement Plan

> Current branch: `feat/analytics-dashboard` | Analysis date: 2026-03-12

---

## Table of Contents

1. [Bugs](#1-bugs)
2. [UX Problems](#2-ux-problems)
3. [Visual / Design Problems](#3-visual--design-problems)
4. [Architecture & Code Quality Issues](#4-architecture--code-quality-issues)
5. [Improvement Roadmap](#5-improvement-roadmap)

---

## 1. Bugs

### 1.1 Preview URL in `CourseReviewPublish` uses a relative path

**File:** `apps/web/components/Dashboard/Courses/CourseReviewPublish.tsx` (line ~106)

```tsx
// Bug: relative href will break on custom-domain orgs
render={<a href={`/orgs/${orgslug}/course/${courseuuid}`} />}
```

The workspace shell's own Preview button correctly uses `getUriWithOrg(orgslug, ...)`. The Review page Preview button does not. On custom-domain deployments the link lands on the wrong host.

**Fix:** Use `getUriWithOrg(orgslug,`/course/${courseuuid}`)` — exactly as done in `CourseWorkspaceChrome`.

---

### 1.2 `CourseCreationWizard` clears URL params sequentially causing redundant navigations

**File:** `apps/web/components/Dashboard/Courses/CourseCreationWizard.tsx` (line ~175)

After successful creation, 7 sequential `await setX('')` calls are chained. Each `nuqs` setter fires a separate `router.push`, creating 7 navigation entries in the browser history stack. The wizard URL persists in history — hitting Back after creation returns users to ghost wizard state.

**Fix:** Use `nuqs`'s `useQueryStates` batch hook to clear all params in a single history entry, or use `router.replace()` instead of `router.push()` for the final navigation so the wizard is not in history.

---

### 1.3 Assignment UUID SWR fetch fires for every assignment activity on mount

**File:** `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ActivityElement.tsx` (line ~153)

```tsx
const { data: assignmentUUID } = useSWR(
  activity.activity_type === 'TYPE_ASSIGNMENT' && access_token
    ? [`assignment-${activity.activity_uuid}`, access_token]
    : null,
  ...
);
```

Every `ActivityElement` in the curriculum tree mounts simultaneously. For a course with 20 assignment activities, this fires 20 parallel API calls on page load, regardless of whether the "Edit assignment" button is ever used.

**Fix:** Fetch the assignment UUID lazily — only on first interaction with the activity row (click/hover on the edit button), or move the fetch to `ChapterElement` where it can batch lookups per chapter.

---

### 1.4 `ChapterElement` delete has no warning about contained activities

**File:** `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ChapterElement.tsx` (line ~278)

The delete dialog says `{t('deleteChapterConfirmation')}` but never mentions how many activities will be cascade-deleted. Users routinely delete chapters expecting to recover activities, but the backend deletes them permanently.

**Fix:** Render the activity count in the dialog: `t('deleteChapterConfirmationWithCount', { count: activities.length })`. Example: "This will permanently delete the chapter and its 5 activities."

---

### 1.5 `handleTogglePublish` does not dismiss the loading toast on a 409 conflict

**File:** `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ActivityElement.tsx` (line ~215)

```tsx
} catch (error: any) {
  if (error?.status === 409) {
    courseContext.showConflict(error?.detail || error?.message);
    return;  // ← toast.dismiss(toastId) is never reached
  }
```

When a 409 occurs, the function returns early before the `finally` block that calls `toast.dismiss(toastId)`. The loading spinner toast stays visible forever alongside the conflict dialog.

**Fix:** Move `toast.dismiss(toastId)` above the 409 early-return, or restructure the catch block to avoid an early `return` — use a flag variable instead.

---

### 1.6 `EditCourseGeneral` `about` field has no placeholder

**File:** `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral.tsx` (line ~297)

```tsx
<Textarea
  {...field}
  className="min-h-[120px]"
/>
```

`name`, `description`, and `tags` all have placeholders. The `about` textarea does not, leaving users with a blank box and no hint of expected input.

**Fix:** Add `placeholder={t('about.placeholder')}` (plus the corresponding translation key).

---

### 1.7 Three hardcoded English strings in `EditCourseGeneral` thumbnail section

**File:** `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral.tsx` (lines ~320–330)

Not internationalised:

- `<p>`: `"Media updates are intentionally isolated from the draft fields above."`
- `<AlertTitle>`: `"Media actions apply immediately"`
- `<AlertDescription>`: `"Thumbnail uploads update the live course record right away…"`

**Fix:** Move to the `CourseEdit.General` i18n namespace.

---

### 1.8 `ChapterElement` chapter header div is over-indented (cosmetic)

**File:** `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ChapterElement.tsx` (line ~198)

```tsx
          {/* Chapter Header */}
            <div className="flex items-center justify-between gap-3 border-b px-4 py-4 sm:px-6">
```

The div is indented 12 spaces instead of 10. Every diff tool flags this as a structural change. Fix the indentation to match sibling elements.

---

### 1.9 `CourseWorkspaceChrome` "Review" button navigates even when already on Review page

**File:** `apps/web/components/Dashboard/Courses/CourseWorkspacePageShell.tsx` (line ~142)

The Review shortcut button in the header always renders and always navigates. Clicking it while on `/review` pushes a duplicate history entry and triggers a full server-component re-render.

**Fix:** Conditionally hide or disable the button when `activeStage === 'review'`.

---

### 1.10 `allVisibleSelected` checkbox state misleads on mixed-permission pages

**File:** `apps/web/app/orgs/[orgslug]/dash/courses/client.tsx` (line ~160)

```tsx
const allVisibleSelected =
  selectableVisibleCourses.length > 0 &&
  selectableVisibleCourses.every(...)
```

`allVisibleSelected` becomes `true` even when some visible rows have disabled checkboxes (courses the user cannot manage). The column header shows "checked = all", which is visually false.

**Fix:** Use an indeterminate state when `selectedCount > 0 && selectedCount < totalVisible`. shadcn Checkbox supports `checked="indeterminate"`.

---

### 1.11 `EditCourseContributors` outer wrapper has extra padding not present in any other section

**File:** `apps/web/components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors.tsx` (line ~375)

```tsx
<div className="mx-auto space-y-6 p-6">
```

All other edit sections use `className="space-y-6"` at root. The extra `mx-auto p-6` double-pads content inside the workspace `<main>` which already applies `px-4 py-6 lg:px-6`.

**Fix:** Change to `className="space-y-6"`.

---

## 2. UX Problems

### 2.1 Courses dashboard header block swallows the viewport before showing any courses

**File:** `apps/web/app/orgs/[orgslug]/dash/courses/client.tsx` (line ~440)

Stack order before the first course row: BreadCrumbs → large card (label + h1 + description + 4 summary counters) → preset filter row → search/sort bar → results summary. On a 768px laptop, users often see zero courses on first load without scrolling.

**Suggestion:**

- Compress into a single toolbar row: `h1` left, `+ New Course` right, search inline.
- Move summary stat cards to a collapsible "Insights" sidebar panel or a secondary zone that doesn't block the list.
- Place preset filter tabs directly above the list, not separated by the search bar.

---

### 2.2 Workspace header uses two sticky rows consuming 96px of prime viewport

**File:** `apps/web/components/Dashboard/Courses/CourseWorkspacePageShell.tsx` (line ~103)

`h-14` title row + `h-10` tab row = 96px permanent sticky header. On a 13" laptop the visible content area shrinks to ~500px. The curriculum page becomes nearly unusable without scrolling.

**Suggestion:**

- Combine into one `h-14` header: breadcrumb and status badges left, tabs right (overflow-x-auto already works).
- OR reduce heights: `h-12` title + `h-9` tab row.

---

### 2.3 Overview page repeats the same data in three places

**File:** `apps/web/components/Dashboard/Courses/CourseWorkspaceOverview.tsx`

"Workspace Pulse" shows `chapters`, `activities`, `contributors`. "Curriculum Snapshot" below immediately re-shows the exact same chapter and activity counts. Both sections also link to the same `/curriculum` page.

**Suggestion:**

- Merge "Curriculum Snapshot" into "Workspace Pulse".
- Use the freed column for genuinely new information: last-modified timestamp, enrolled learner count, or quick links to unpublished activities.

---

### 2.4 Readiness badge tones are semantically meaningless

**File:** `apps/web/components/Dashboard/Courses/courseWorkflowUi.tsx` (line ~13)

```tsx
success: 'border-border bg-muted text-foreground',    // identical to default
warning: 'border-border bg-accent/50 text-accent-foreground', // barely differs
```

`success` and `default` are visually identical. `warning` is barely distinguishable. In the readiness checklist a user cannot quickly parse "ready" vs "needs review" without reading the text label — defeating the purpose of status badges.

**Suggested replacement (shadcn-compliant, no gradients):**

```tsx
// success / ready
'border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300'

// warning / needs attention
'border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200'

// danger — keep existing destructive variant
```

---

### 2.5 Activity type badges in the curriculum are all identically grey

**File:** `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ActivityElement.tsx` (line ~107)

```tsx
TYPE_VIDEO:    'border-border bg-muted/60 text-foreground',
TYPE_DOCUMENT: 'border-border bg-muted/40 text-foreground',
TYPE_EXAM:     'border-border bg-muted/70 text-muted-foreground',
```

Six activity types, six visually identical grey pills. In a curriculum with 30+ activities the user must read each label to know the type — pre-attentive scanning is impossible.

**Suggested colour mapping (semantic, no gradient, dark-mode-safe):**

| Type           | Classes                                                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Video          | `bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800`                   |
| Document       | `bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800`             |
| Assignment     | `bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800`       |
| Exam           | `bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800`                   |
| Dynamic        | `bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800` |
| Code Challenge | `bg-cyan-50 dark:bg-cyan-950/30 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800`                   |

---

### 2.6 `CourseChoiceCard` has no focus-visible ring for keyboard users

**File:** `apps/web/components/Dashboard/Courses/courseWorkflowUi.tsx` (line ~95)

The visible selection ring only appears when `checked`. A keyboard user tabbing through template or access options sees no focus indicator on unchecked cards — WCAG 2.4.7 failure.

**Fix:**

```tsx
className={cn(
  'flex cursor-pointer flex-col gap-3 rounded-xl border p-5 transition-colors',
  'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-1',
  checked ? 'border-primary bg-accent/40 ...' : 'border-border ...',
)}
```

---

### 2.7 Unsaved changes dialog — "Leave" is the primary-styled action

**File:** `apps/web/components/Dashboard/Courses/CourseWorkspacePageShell.tsx` (line ~96)

```tsx
<AlertDialogCancel onClick={cancelNavigation}>{t('unsavedDialogStay')}</AlertDialogCancel>
<AlertDialogAction onClick={confirmNavigation}>{t('unsavedDialogLeave')}</AlertDialogAction>
```

"Leave and lose changes" is the destructive action but gets the `default` primary-button style. "Stay" is the safe action but gets the secondary cancel style.

**Fix:** Add `variant="destructive"` to the Leave `AlertDialogAction`. "Stay" becomes the visually dominant button.

---

### 2.8 `EditCourseGeneral` — save scope for thumbnail is unclear

**File:** `apps/web/components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral.tsx` (line ~318)

Two `Card` sections share one `<form>`: (1) text fields with staged Save/Discard, and (2) thumbnail which applies immediately. The `SectionHeader` Save button is in card #1, but users visually read the whole page as one form. Pressing Enter anywhere in the form triggers `handleSubmit`, which saves only text fields while silently ignoring the thumbnail card.

**Fix:**

- Extract the thumbnail `Card` to a `<section>` outside the `<form>` element to prevent accidental form submission.
- Add a visual `<Separator>` with a label distinguishing "staged" vs "saved immediately" sections.

---

### 2.9 Curriculum page: the status alert is permanent noise in idle state

**File:** `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure.tsx` (line ~169)

The `Alert` displaying `"curriculumChangesApplyImmediately"` is visible at all times even when no changes have happened. It occupies the top of the page, trains users to ignore alerts, and adds no value at rest.

**Fix:** Only show the alert when `structureStatus !== 'idle'`. Auto-dismiss the `'saved'` state after 3 seconds with a fade-out.

---

### 2.10 `CourseCreationWizard` "Outline from course" template is misleadingly scoped

**File:** `apps/web/components/Dashboard/Courses/CourseCreationWizard.tsx` (line ~119)

`createOutlineFromSource` copies only chapter names and descriptions — no activities. The UI labels this as "Use an existing course as a template", which implies a full structural copy.

**Fix:**

- Rename to "Borrow chapter structure" or "Copy chapter outline only".
- Add an explicit disclaimer below the option: "Only chapter titles are copied. Activities are not included."

---

### 2.11 Card view clamps all cards to `max-w-[320px]`, leaving dead space on wide screens

**File:** `apps/web/app/orgs/[orgslug]/dash/courses/client.tsx` (line ~573)

```tsx
<div className="mx-auto w-full max-w-[320px]">
```

On 1440px monitors, `grid-cols-4` cells with 320px cards have ~200px of dead space per column. The grid looks sparse and orphaned.

**Fix:** Remove `max-w-[320px]`. Let cards expand to fill their grid column — `CourseThumbnail`'s `aspect-video` image provides natural proportioning.

---

### 2.12 Pagination triggers a full route navigation with no loading feedback

**File:** `apps/web/app/orgs/[orgslug]/dash/courses/client.tsx` (line ~639)

Clicking Next/Prev calls `router.push(...)`, which triggers a server-component re-render. During the transition the old page data remains visible — no skeleton, no spinner. The user has no visual confirmation that navigation is happening.

**Fix:** Wrap the page in a `<Suspense>` boundary with a `DataTableSkeleton`, or use `useTransition` around the `router.push` call to show a pending state on the table.

---

## 3. Visual / Design Problems

### 3.1 `LandingClassic` empty-state icon uses a gradient

**File:** `apps/web/components/Landings/LandingClassic.tsx` (line ~53)

```tsx
<div className="from-muted to-muted/50 ... bg-gradient-to-br ...">
```

A `bg-gradient-to-br from-muted to-muted/50` adds a gradient to a neutral icon circle with zero semantic value. It looks out of place against the flat design used everywhere else.

**Fix:** Replace with `bg-muted`.

---

### 3.2 Governance Snapshot nests three bordered panels inside a bordered card

**File:** `apps/web/components/Dashboard/Courses/CourseWorkspaceOverview.tsx`

The pattern: `courseWorkflowCardClass (border + shadow)` containing three `courseWorkflowMutedPanelClass (border + bg-muted)` divs. Three levels of border + rounded radius create a visually cluttered section that does not match the flat, single-layer card pattern used in every other section.

**Fix:** Replace the three nested muted panels in the Governance Snapshot with a `<dl>` definition list and `<Separator>` dividers. Flat, clean, no nesting.

---

### 3.3 Summary stat numbers use `text-3xl` for trivially small values

**File:** `apps/web/components/Dashboard/Courses/CourseWorkspaceOverview.tsx` (line ~80)

Showing `0` or `1` contributor in 30px/600-weight numerals is disproportionate. These numbers rarely exceed single digits in practice.

**Fix:** Use `text-2xl font-semibold` for workspace stats. Reserve `text-3xl+` for high-density analytics contexts (enrolled learner counts, etc.).

---

### 3.4 `courseWorkflowBadgeToneClass` — `success` and `default` tones are identical

See §2.4. This is both a UX and a visual bug. Two badge states that should communicate different meanings look the same.

---

### 3.5 Activity type badges — all grey regardless of type

See §2.5. The curriculum page communicates nothing visually about content type composition. Everything looks like a grey list.

---

### 3.6 Raw `gray-*` Tailwind colours used in dashboard pages outside course management

**Files:**

- `apps/web/components/Dashboard/Pages/Users/OrgUsers/OrgUsers.tsx` (line ~301): `bg-gray-50`, `text-gray-800`, `text-gray-500`
- `apps/web/components/Dashboard/Pages/Users/OrgUserGroups/OrgUserGroups.tsx` (line ~245): same
- `apps/web/components/Dashboard/Pages/Org/OrgEditSocials/OrgEditSocials.tsx` (line ~146): `bg-gray-50/50`

Raw palette colours that do not adapt to dark mode and ignore the design theme.

**Fix:**

| Old             | New                     |
| --------------- | ----------------------- |
| `bg-gray-50`    | `bg-muted`              |
| `text-gray-800` | `text-foreground`       |
| `text-gray-500` | `text-muted-foreground` |
| `bg-gray-50/50` | `bg-muted/50`           |

---

### 3.7 `BreadCrumbs.tsx` uses `text-gray` — an invalid Tailwind class

**File:** `apps/web/components/Dashboard/Misc/BreadCrumbs.tsx` (line ~27)

`text-gray` is not a valid Tailwind utility (Tailwind requires `text-gray-{step}`). This class silently does nothing — breadcrumbs inherit an unexpected or default foreground colour.

**Fix:** Replace all `text-gray` instances with `text-muted-foreground`.

---

### 3.8 `LinkCourseModal.tsx` uses `text-gray-400` (raw, non-themed)

**File:** `apps/web/components/Dashboard/Pages/Payments/SubComponents/LinkCourseModal.tsx` (line ~149)

Same issue as §3.6.

**Fix:** `text-muted-foreground`.

---

### 3.9 `Gamification/hero-section.tsx` uses hard-coded gray badge colours

**File:** `apps/web/components/Dashboard/Gamification/hero-section.tsx` (line ~152)

```tsx
'bg-gray-400/20 text-gray-600 dark:text-gray-300 border-gray-400/50'
```

Rank badge colours for 2nd place are hard-coded raw grays. This breaks in custom themes and will clash if the design tokens are updated.

**Fix:** Map rank levels to a design-token-based variant chain (`bg-muted/50 text-muted-foreground border-border` for silver, or define a semantic `rank-silver` token).

---

## 4. Architecture & Code Quality Issues

### 4.1 `renderCourseWorkspacePage` performs a redundant auth check on split-fetch pages

**File:** `apps/web/components/Dashboard/Courses/renderCourseWorkspacePage.tsx` (line ~18)

Pages that call `requireCourseWorkspaceStageAccess` themselves and pass `capabilities` to `renderCourseWorkspacePage` are fine. Pages that do NOT (Details, Curriculum, Access, Collaboration, Certificate) trigger both the workspace layout guard AND a second implicit guard inside `renderCourseWorkspacePage`. Two auth calls per page load for no extra security benefit.

**Suggestion:** Lift all stage-specific access checks to the route layout, and pass resolved capabilities down via a server action or dedicated slot pattern. Individual pages become pure data-fetching + render — zero auth duplication.

---

### 4.2 `getCourseReadinessSummary` is computed independently in four components on every render

**Files:** `CourseWorkspacePageShell.tsx`, `CourseWorkspaceOverview.tsx`, `CourseReviewPublish.tsx`, `client.tsx`

`getCourseReadinessSummary` traverses the full chapter/activity tree. Called in four components independently, for a large course (50+ activities) this runs the same O(n) traversal four times per render cycle.

**Fix:** Memoize the result in `CourseContext` — compute once on `courseStructure` change, expose as `course.readiness`. All subscribers read the cached value.

---

### 4.3 I18n namespaces are fragmented across six different roots for one feature

| Section                   | Current namespace                      |
| ------------------------- | -------------------------------------- |
| `EditCourseAccess`        | `DashPage.Courses.Access`              |
| `EditCourseContributors`  | `DashPage.EditCourseContributors`      |
| `EditCourseCertification` | `Certificates.EditCourseCertification` |
| `EditCourseGeneral`       | `CourseEdit.General`                   |
| `EditCourseStructure`     | `CourseEdit.Structure`                 |
| `CourseReviewPublish`     | `DashPage.CourseManagement.Review`     |

Six namespace roots for one feature. Translation lookup is disorganised and adding translations requires knowing which root each section uses.

**Suggestion:** Consolidate under `CourseEdit.*` — `CourseEdit.Access`, `CourseEdit.Contributors`, `CourseEdit.Certification`, `CourseEdit.Review`, etc.

---

### 4.4 `EditCourseContributors` bulk-add button has no double-click guard

**File:** `apps/web/components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors.tsx` (line ~260)

`handleAddContributors` has no loading gate. Double-clicking "Add Contributors" fires two parallel `bulkAddContributors` calls. The second will often fail with an already-exists error, producing a confusing toast pair (success + error) for a single user action.

**Fix:** Add `const [isAdding, setIsAdding] = useState(false)` and gate the function body with `if (isAdding) return`.

---

### 4.5 Course dashboard summary counts are derived from the paginated page slice, not the full dataset

**File:** `apps/web/app/orgs/[orgslug]/dash/courses/page.tsx` (line ~77) and `client.tsx` (line ~110)

`summaryCounts` is computed client-side from the current page's `courses` array. For an org with 100 courses (5 pages), the "Ready: 3" counter only reflects the 24 courses on the current page — not the total 100.

**Fix:** Return `summary` as an aggregate from the server query (`getEditableOrgCourses` already returns a `summary` field — verify it reflects the full filtered set, not just the page slice).

---

---

## 5. Improvement Roadmap

### Priority 1 — Fix immediately (bugs affecting correctness/navigation)

| #    | Issue                                                | Effort |
| ---- | ---------------------------------------------------- | ------ |
| 1.1  | Preview URL uses wrong host on custom-domain orgs    | XS     |
| 1.5  | Loading toast leaks on 409 in ActivityElement        | XS     |
| 1.7  | Three hardcoded English strings in thumbnail section | S      |
| 1.8  | ChapterElement indentation                           | XS     |
| 1.9  | Review button navigates when already on review       | XS     |
| 1.11 | Contributors outer wrapper double-padding            | XS     |
| 3.7  | `text-gray` invalid class in BreadCrumbs             | XS     |

### Priority 2 — Fix soon (UX correctness)

| #    | Issue                                                    | Effort |
| ---- | -------------------------------------------------------- | ------ |
| 1.2  | Wizard clears params via 7 sequential history entries    | S      |
| 1.3  | Assignment UUID fetched eagerly for every activity       | M      |
| 1.4  | Chapter delete doesn't warn about activity cascade count | S      |
| 1.6  | `about` field missing placeholder                        | XS     |
| 1.10 | Select-all checkbox misleads on mixed-permission pages   | S      |
| 2.7  | Unsaved changes dialog action order is inverted          | XS     |
| 4.4  | Contributor add not guarded against double-click         | S      |
| 4.5  | Dashboard summary counts from page slice, not full set   | M      |

### Priority 3 — Improve UX quality

| #    | Issue                                                  | Effort |
| ---- | ------------------------------------------------------ | ------ |
| 2.1  | Dashboard header too tall before showing courses       | M      |
| 2.2  | Workspace header 2-row layout, 96px fixed height       | M      |
| 2.3  | Overview page repeats the same curriculum stats        | S      |
| 2.4  | Readiness badge `success` = `default` visually         | S      |
| 2.5  | Activity type badges all grey, no type differentiation | S      |
| 2.6  | `CourseChoiceCard` no focus-visible ring               | S      |
| 2.8  | General form/thumbnail save scope ambiguity            | M      |
| 2.9  | Curriculum always-on status alert                      | S      |
| 2.11 | Card view 320px constraint on wide screens             | XS     |
| 2.12 | Pagination no loading feedback                         | M      |

### Priority 4 — Visual / design consistency

| #   | Issue                                                           | Effort |
| --- | --------------------------------------------------------------- | ------ |
| 3.1 | LandingClassic empty-state gradient icon                        | XS     |
| 3.2 | Governance Snapshot triple-nested panels                        | S      |
| 3.3 | Oversized `text-3xl` stats for trivially small values           | S      |
| 3.6 | Raw `gray-*` colours in OrgUsers, OrgUserGroups, OrgEditSocials | S      |
| 3.8 | `text-gray-400` in PaymentsLinkCourseModal                      | XS     |
| 3.9 | Hard-coded gray colours in Gamification hero                    | S      |

### Priority 5 — Architecture

| #    | Issue                                                  | Effort |
| ---- | ------------------------------------------------------ | ------ |
| 4.1  | Redundant auth check in workspace section pages        | M      |
| 4.2  | `getCourseReadinessSummary` recomputed 4× per render   | M      |
| 4.3  | I18n namespaces fragmented across 6 roots              | L      |
| 2.10 | Misleading "outline from source" wizard template label | S      |

---

## Appendix: shadcn Design System Rules

Apply consistently across all course management code.

### Semantic colour tokens only — never raw Tailwind palette classes

```
bg-background | bg-card | bg-muted | bg-popover
text-foreground | text-muted-foreground | text-card-foreground
border-border | border-input
ring-ring | ring-offset-background
text-destructive | bg-destructive | border-destructive
text-primary | bg-primary | text-primary-foreground
text-accent | bg-accent | text-accent-foreground
```

### Status colours (semantic, no gradients, dark-mode-safe)

| State                     | Background                             | Border                                       | Text                                     |
| ------------------------- | -------------------------------------- | -------------------------------------------- | ---------------------------------------- |
| Ready / Success           | `bg-emerald-50 dark:bg-emerald-950/30` | `border-emerald-200 dark:border-emerald-800` | `text-emerald-700 dark:text-emerald-300` |
| Warning / Needs attention | `bg-amber-50 dark:bg-amber-950/30`     | `border-amber-200 dark:border-amber-800`     | `text-amber-800 dark:text-amber-200`     |
| Error / Destructive       | shadcn `variant="destructive"` pattern |                                              |                                          |
| Info / Neutral            | `bg-muted`                             | `border-border`                              | `text-muted-foreground`                  |

### Component composition rules

- Cards: `rounded-xl border bg-card shadow-sm` — never nest a bordered panel inside a bordered card unless there is a genuine visual reason
- Inputs: shadcn `Input` defaults — do not override radius or padding
- Badges: `rounded-md` for type/status pills, `rounded-full` for count indicators — never mix
- Dialogs: always `AlertDialog` for destructive actions, always `Dialog` for non-destructive forms
- Destructive `AlertDialogAction` must always use `variant="destructive"` — never default primary styling
- Focus rings: always via `focus-within:ring-2 focus-within:ring-ring` on interactive composite components

### Spacing

- Page content area: `px-4 py-6 lg:px-6` — do not add extra padding inside subsections
- Cards: `p-5` (compact) or `p-6` (standard) — pick one per section and don't mix
- Section headers: follow `SectionHeader` component — do not inline the title/action bar pattern again

### Typography scale

| Use                           | Class                                                                  |
| ----------------------------- | ---------------------------------------------------------------------- |
| Page section title            | `text-2xl font-bold tracking-tight`                                    |
| Card heading                  | `CardTitle` default or `text-base font-semibold`                       |
| Meta / label pill             | `text-xs font-semibold uppercase tracking-wider text-muted-foreground` |
| Stat numbers (workspace)      | `text-2xl font-semibold`                                               |
| Stat numbers (home dashboard) | `text-2xl font-semibold` (not `text-3xl` or `text-4xl`)                |
