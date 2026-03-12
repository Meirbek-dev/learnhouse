# Course Management — Critical Analysis & Improvement Plan

> **Scope:** All files under `apps/web/app/orgs/[orgslug]/dash/courses/`,
> `apps/web/components/Dashboard/Courses/`, and
> `apps/web/components/Dashboard/Pages/Course/`.
>
> Organized by severity. Each section includes the exact file, root cause, and a concrete fix.

---

## 1. Confirmed Bugs

### 1.1 Inverted toast after toggling course visibility

**File:** `components/Dashboard/Courses/CourseReviewPublish.tsx` — `toggleVisibility()`

```ts
// AFTER refreshCourseMeta() the structure already has the NEW value.
// If we just published (public → true), course.courseStructure.public === true
// → toast shows t('toasts.movedPrivate')  ← WRONG
await course.refreshCourseMeta();
toast.success(course.courseStructure.public ? t('toasts.movedPrivate') : t('toasts.published'));
```

The condition reads the **post-refresh** value, so the message is always the opposite of what happened.

**Fix:** Capture the intent before the API call.

```ts
const wasPublic = course.courseStructure.public;
// ... await updateCourseAccess(...)
await course.refreshCourseMeta();
toast.success(wasPublic ? t('toasts.movedPrivate') : t('toasts.published'));
```

---

### 1.2 Certificate readiness check is always `true`

**File:** `lib/course-management.ts` — `getCourseReadinessChecklist()`

```ts
// Array.isArray([]) === true — an empty certifications array passes this check
{ id: 'certificate', complete: Array.isArray(certifications), href: 'certificate' }
```

Every new course is considered to have a certificate configured even when none exists. The Readiness tab badge count and Overview checklist are both wrong.

**Fix:**

```ts
{ id: 'certificate', complete: certifications.length > 0, href: 'certificate' }
```

---

### 1.3 `<a>` nested inside `<button>` in `ActivityElement` (invalid HTML + broken click)

**File:** `components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ActivityElement.tsx`

The preview button and all edit-link buttons render a `<Link>` *inside* a `<Button>`:

```tsx
<Button size="sm" variant="outline">
  <Link href={...} target="_blank">   {/* renders <a> inside <button> — invalid HTML */}
    <Eye className="h-4 w-4" />
  </Link>
</Button>
```

Browsers coerce this into broken DOM. Click area is inconsistent and screen readers see two interactive elements.

Same pattern appears in `ActivityEditButton` for dynamic pages, assignments, and code challenges.

**Fix:** Use the `render` / `nativeButton={false}` prop pattern already used elsewhere:

```tsx
<Button
  size="sm"
  variant="outline"
  nativeButton={false}
  render={<a href={previewUrl} target="_blank" rel="noopener noreferrer" />}
>
  <Eye className="size-4" />
</Button>
```

---

### 1.4 `AlertDialogTrigger` wrapping `Button` creates nested interactive elements

**File:** `components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ChapterElement.tsx`

```tsx
<AlertDialogTrigger>         {/* renders its own <button> */}
  <Button variant="destructive" size="sm">   {/* second <button> inside */}
    <Trash2 />
  </Button>
</AlertDialogTrigger>
```

This is invalid HTML (nested `<button>` elements). The shadcn `AlertDialogTrigger` supports `asChild` or the same `render` pattern — use it.

**Fix:**

```tsx
<AlertDialogTrigger render={<Button variant="destructive" size="sm" />}>
  <Trash2 className="size-4" />
</AlertDialogTrigger>
```

Same pattern appears in `ActivityElement.tsx` delete trigger.

---

### 1.5 Course description uses single-line `<Input>` with a 1000-character limit

**File:** `components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral.tsx`

```tsx
<FormField name="description" render={({ field }) => (
  <FormItem>
    <FormLabel>…</FormLabel>
    <FormControl>
      <Input {...field} placeholder="…" maxLength={1000} />   {/* ← Input, not Textarea */}
    </FormControl>
  </FormItem>
)} />
```

Users cannot see their paragraph-length descriptions. The validation allows 1000 chars in a single-line input — visually nonsensical.

**Fix:** Replace `<Input>` with `<Textarea className="min-h-[100px] resize-y" />`.

---

### 1.6 Access readiness check passes for private course with no user groups

**File:** `lib/course-management.ts` — `getCourseReadinessChecklist()`

```ts
{ id: 'access', complete: typeof course?.public === 'boolean', href: 'access' }
```

A course can be `public: false` (private) with **zero** linked user groups — no learner can ever enroll — and still pass the access readiness check. This makes "Ready to Publish" meaningless.

**Fix:**

```ts
{
  id: 'access',
  complete: course?.public === true
    || (course?.public === false && linkedUserGroups.length > 0),
  href: 'access',
},
```

`linkedUserGroups` is already available from the `editorData` parameter.

---

### 1.7 `EditCourseStructure` Alert uses non-standard `{ default: '...' }` translation fallbacks

**File:** `components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure.tsx`

```ts
t('savingOrder', { default: 'Applying curriculum changes' })
t('curriculumChangesApplyImmediately', { default: '…' })
t('curriculumInlineFeedback', { default: '…' })
t('refreshAfterError', { default: '…' })
```

`next-intl` does not support a `default` option in `t()`. The second argument is an interpolation values object; passing `{ default: '...' }` silently inserts the string `'...'` as a variable named `default`. The displayed text will either be the key name itself or a broken interpolation string.

**Fix:** Add these keys to the `CourseEdit.Structure` namespace in the message files, or inline them as string constants while the translation files are being updated.

---

### 1.8 `SectionHeader` "Discard" button is not translated

**File:** `components/Dashboard/Courses/SectionHeader.tsx`

```tsx
<Button type="button" variant="outline" …>
  {/* i18n:TODO */}Discard   {/* ← hardcoded English */}
</Button>
```

The `i18n:TODO` comment indicates this was left unfinished. Every user sees "Discard" regardless of locale.

**Fix:** Add a `discard` key to the `Common` namespace and use `tCommon('discard')`.

---

## 2. Design System Violations

### 2.1 `bg-white` and `border-neutral-*` hardcoded in `ActivityElement` — dark mode broken

**File:** `ActivityElement.tsx`

```tsx
className={`
  mb-2 flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3
  …
`}
…
className="cursor-grab text-neutral-400 hover:text-neutral-600 active:cursor-grabbing"
…
<p className="… text-neutral-900">
```

`bg-white` and `border-neutral-200` are absolute colour values that make the curriculum editor **completely broken in dark mode** — white backgrounds on a dark surface, invisible borders.

**Fix:** Replace with design-system tokens:

```tsx
// bg-white  → bg-card
// border-neutral-200  → border
// text-neutral-900  → text-foreground
// text-neutral-400  → text-muted-foreground
// text-neutral-600  → text-foreground (hover)
// text-neutral-500  → text-muted-foreground
// text-neutral-300  → text-muted-foreground/50
```

---

### 2.2 `text-neutral-*` and `border-neutral-*` in `ChapterElement` — same dark mode breakage

**File:** `ChapterElement.tsx`

```tsx
className="… border-b border-neutral-100 …"
className="cursor-grab text-neutral-400 hover:text-neutral-600 …"
<h3 className="… text-neutral-900 …">{chapter.name}</h3>
<Pencil className="h-3.5 w-3.5 text-neutral-500" />
<div className="… text-sm text-neutral-400">…   {/* empty state label */}
<div className="… border-t border-neutral-100">  {/* bottom separator */}
  <MoreHorizontal className="h-5 w-5 text-neutral-300" />
```

**Fix:** Same token mapping as 2.1. Remove the decorative `MoreHorizontal` separator entirely (see §3.4).

---

### 2.3 Template literals for dynamic `className` instead of `cn()`

**Files:** `ActivityElement.tsx`, `ChapterElement.tsx`, `EditCourseStructure.tsx`

```tsx
// ActivityElement.tsx
className={`
  mb-2 flex items-center gap-3 rounded-lg border … bg-white p-3
  transition-all duration-200
  ${snapshot.isDragging ? 'scale-[1.02] rotate-1 shadow-xl …' : 'shadow-sm hover:shadow-md'}
`}

// ChapterElement.tsx
className={`
  bg-background mx-2 mb-4 …
  ${snapshot.isDragging ? 'scale-105 rotate-1 shadow-2xl …' : 'hover:shadow-md'}
`}

// EditCourseStructure.tsx
className={`space-y-4 ${snapshot.isDraggingOver ? 'bg-muted/40' : ''}`}
```

Inconsistent with the rest of the codebase which uses `cn()`. Template literals don't de-duplicate class names, are not autocomplete-friendly, and trigger full re-renders by creating new string references on every render.

**Fix:** Use `cn()` everywhere.

---

### 2.4 Exaggerated drag animations violate spatial consistency

**Files:** `ActivityElement.tsx`, `ChapterElement.tsx`

```tsx
// Chapter — 5% scale + 1° rotation on drag
snapshot.isDragging ? 'scale-105 rotate-1 shadow-2xl ring-2 ring-ring/30'

// Activity — 2% scale + 1° rotation on drag
snapshot.isDragging ? 'scale-[1.02] rotate-1 shadow-xl ring-2 ring-ring/30'
```

Rotation on a list item is disorienting in a canvas that has no other rotated elements. `scale-105` causes layout shifts that break the visual feedback of where the item will land. The existing `@hello-pangea/dnd` placeholder mechanism already provides correct spatial feedback.

**Fix:**

```tsx
snapshot.isDragging ? 'opacity-90 shadow-lg ring-1 ring-border'
```

---

### 2.5 `bg-accent/60` used for "warning" badge tone — colour is theme-dependent

**File:** `courseWorkflowUi.tsx`

```ts
warning: 'border-border bg-accent/60 text-accent-foreground',
```

`accent` maps to different hues depending on the theme. In the default shadcn theme it's near-white, making the "needs review" badge almost invisible. The `warning` tone should be more explicit.

**Fix:**

```ts
warning: 'border-amber-200/60 bg-amber-50/70 text-amber-900 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300',
```

Or use a `data-[tone=warning]` variant pattern in the Badge component to keep it configurable from the CSS layer.

---

### 2.6 `border-primary bg-primary/5` in certificate pattern picker is not composable

**File:** `EditCourseCertification.tsx`

```tsx
field.value === pattern.value ? 'border-primary bg-primary/5' : 'border-border'
```

The selected-pattern tile uses a fixed inline active colour instead of the `CourseChoiceCard` component that already implements this consistent selected-card pattern. The certificate section invents its own selection UI.

**Fix:** Extract the certificate pattern picker into a component that reuses `CourseChoiceCard` or the same tokens used there (`border-primary bg-accent/40 ring-1 ring-ring/20`).

---

## 3. UX / Workflow Problems

### 3.1 Summary statistics on the courses dashboard count current page, not the total inventory

**File:** `app/orgs/[orgslug]/dash/courses/client.tsx` — `summaryCards`

```ts
const summaryCards = useMemo(() => {
  const ready = courses.filter(…).length;   // 'courses' = current page (max 24)
  const privateCount = courses.filter(…).length;
  const attention = courses.filter(…).length;
  return [
    { label: 'Visible', value: courses.length, … },  // "8 courses" when org has 150
    …
  ];
}, [courses, t]);
```

An org with 150 courses on page 3 shows "Visible: 24, Ready: 7" — these numbers mean almost nothing. The user has no accurate signal of their course health.

**Fix:** Either pass server-computed aggregates via the page's `searchParams`/server component, or clearly label the cards "On this page" and provide totals separately.

---

### 3.2 Duplicate `notReadyDescription` alert in Overview and Review pages

**Files:** `CourseWorkspaceOverview.tsx`, `CourseReviewPublish.tsx`

Both pages render the `notReadyDescription` translation key twice: once in a `<p>` and once inside an `<Alert>` immediately below it.

```tsx
<p className="… text-muted-foreground">{readiness.readyToPublish ? t('readyDescription') : t('notReadyDescription')}</p>

{!readiness.readyToPublish ? (
  <Alert …>
    <AlertDescription>{t('notReadyDescription')}</AlertDescription>  {/* same text */}
  </Alert>
) : null}
```

**Fix:** Remove the standalone `<Alert>` wrapper. The paragraph already communicates the state. If a visual callout is needed, use the Alert *instead* of the paragraph.

---

### 3.3 Publish button is permanently disabled for any imperfect readiness state

**File:** `CourseReviewPublish.tsx`

```tsx
<Button
  onClick={toggleVisibility}
  disabled={isPending || isRefreshing || !readiness.readyToPublish}
>
```

Until **all** checklist items pass, the Publish button is completely disabled with no explanation. There is no "publish anyway" escape hatch and no indication of *which specific item* is blocking.

Also, because bug 1.2 (certificate always complete) is a false green, if it gets fixed the Publish button will be newly disabled for courses that previously published fine.

**Fix:**

- Show the checklist inline above the Publish button.
- Allow publishing with a confirmation dialog when non-critical items are incomplete (e.g., certificate not set up).
- Hard-block only the *structural* requirements (name, description, at least one activity).

---

### 3.4 Decorative `MoreHorizontal` separator at the bottom of every chapter is visual noise

**File:** `ChapterElement.tsx`

```tsx
{/* Bottom Separator */}
<div className="flex h-8 items-center justify-center border-t border-neutral-100">
  <MoreHorizontal className="h-5 w-5 text-neutral-300" />
</div>
```

This element exists purely as decoration with no affordance. The three-dot icon (conventionally meaning "more options") renders disabled in the middle of a border, which confuses users into clicking it. It should be removed.

---

### 3.5 Inconsistent page layout padding across workspace sections

Comparing the outer containers of each section:

| Section           | Container                                                                      |
| ----------------- | ------------------------------------------------------------------------------ |
| Overview / Review | `<div className="space-y-6">` (no padding — gets it from shell's `py-6 px-4`)  |
| Details (General) | `<div className="mx-auto space-y-8 p-6">` (double padding)                     |
| Access            | `<div className="mx-auto space-y-6 p-6">` (double padding)                     |
| Curriculum        | no outer wrapper — goes straight to `<Card>`                                   |
| Certification     | `<div className="space-y-6 py-6"><div className="mx-4 sm:mx-10">` (asymmetric) |
| Contributors      | varies                                                                         |

The shell already provides `px-4 py-6 lg:px-6`. Sections that add their own `p-6` get 24px padding stacked on top of the shell's 24px = 48px of whitespace on mobile. Sections without padding look tight against the edge on small screens.

**Fix:** Standardize all sections to simply `<div className="space-y-6">` and rely on the shell for page padding. Apply a max-width via a shared `pageContentClass` constant.

---

### 3.6 Certification section hides the entire form when `enable_certification === false`

**File:** `EditCourseCertification.tsx`

When the toggle is off, the full configuration form disappears and is replaced by a centered button:

```tsx
{!isEnabled && (
  <div className="flex flex-col items-center justify-center py-12 text-center">
    <Award className="h-12 w-12" />
    <Button onClick={() => form.setValue('enable_certification', true)}>
      Enable Certification
    </Button>
  </div>
)}
```

This means a user who wants to *preview* the certificate they previously set up must toggle the switch on, find the preview, then toggle it off again. The preview should remain visible in a read-only state, with the form inputs showing as disabled but visible.

---

### 3.7 "Curriculum Snapshot" card in Overview has static placeholder content

**File:** `CourseWorkspaceOverview.tsx`

```tsx
<div className={courseWorkflowMutedPanelClass}>
  <div className="font-medium text-foreground">{t('nextStep')}</div>
  <div className="mt-1">{t('nextStepDescription')}</div>
</div>
```

This panel always shows the same static "next step" message regardless of actual course state. It provides zero value — it reads like filler text from a design mockup.

**Fix:** Make the next-step panel contextual. If there are no activities, link to Curriculum. If activities exist but course is private with no groups, link to Access. If readiness is complete but course is not live, link to Review.

---

### 3.8 Wizard URL state pollution

**File:** `CourseCreationWizard.tsx`

The wizard persists all form values in URL query params for back-navigation support, but never cleans them up after course creation. After a successful creation and redirect, the browser history stack contains URLs like:

```
/orgs/my-org/dash/courses/new?step=2&name=My+Course&desc=...&vis=private&tpl=blank&dest=curriculum
```

If the user hits back, they re-enter the wizard pre-filled with the previous course's data and could accidentally create a duplicate. The `useQueryState` setters should be cleared before redirecting.

---

### 3.9 Checklist items in Overview are navigable links but look like read-only status rows

**File:** `CourseWorkspaceOverview.tsx`

```tsx
<AppLink href={buildCourseWorkspacePath(…, item.href)} className="flex items-start gap-3 …">
  <CourseStatusBadge status={…} />
  <div>…</div>
</AppLink>
```

Each checklist item is a clickable link to the relevant section, but it has no visual affordance indicating it's interactive (no chevron, no underline, no hover state that looks like a link). Users won't discover this navigability.

**Fix:** Add `<ArrowRight className="size-4 ml-auto shrink-0 text-muted-foreground" />` or use `hover:bg-muted/50` with a right-arrow indicator.

---

## 4. Performance Issues

### 4.1 Per-activity SWR fetch for assignment UUID — N+1 API calls

**File:** `ActivityElement.tsx` — `ActivityEditButton`

```tsx
const { data: assignmentUUID } = useSWR(
  activity.activity_type === 'TYPE_ASSIGNMENT' && access_token
    ? [`assignment-${activity.activity_uuid}`, access_token]
    : null,
  async () => getAssignmentFromActivityUUID(activity.activity_uuid, access_token!),
);
```

This hook runs **inside** the `ActivityEditButton` component, which is rendered for every activity element. A curriculum with 40 assignment activities fires 40 parallel API requests to resolve `assignment_uuid`s.

**Fix:** Pre-resolve `assignment_uuid` when the editor bundle loads (in the `CourseContext` or on the server in `renderCourseWorkspacePage`), so the data is available as a prop. Alternatively, store a `activityUuid → assignmentUuid` map in the `CourseContext` and populate it lazily the first time the curriculum section mounts.

---

### 4.2 `getCourseReadinessSummary` called on every course row for table column rendering

**File:** `apps/web/app/orgs/[orgslug]/dash/courses/client.tsx`

```tsx
// Inside the status column cell — called on every render of the table:
const ready = getCourseReadinessSummary(course, null).readyToPublish;
// And also inside summaryCards memo:
const ready = courses.filter(course => getCourseReadinessSummary(course, null).readyToPublish).length;
```

`getCourseReadinessSummary` calls `getCourseReadinessChecklist` which iterates the chapters array via `getCourseContentStats`. With 24 courses each having 50 activities, this is O(24 × 50) work on every table re-render (e.g., every checkbox click).

**Fix:** Memoize per-row readiness outside `ColumnDef`. Either attach a `_readiness` field to the course object server-side, or memoize the result with `useMemo` keyed on `course.update_date`.

---

## 5. Code Quality Issues

### 5.1 `any` casts throughout — suppressing type errors on critical data paths

```tsx
// CourseWorkspacePageShell.tsx
initialCourse: any;
capabilities: CourseWorkspaceCapabilities;

// ChapterElement.tsx
const course = useCourse() as any;
await updateChapter(chapter.id, { name: trimmedName }, access_token, { courseUuid: course_uuid });

// EditCourseStructure.tsx
const submitChapter = async (chapter: any) => {
```

Using `any` on `courseStructure`, `chapter`, and `session` suppresses IDE feedback and makes it impossible to catch shape mismatches at compile time. The `CourseStructure` and `Activity` interfaces are already defined in `CourseContext.tsx` but not used for these local variables.

---

### 5.2 `ChapterElement` error messages for `handleSaveEdit` and `handleDeleteChapter` use hardcoded English strings

```tsx
if (!access_token) {
  toast.error('Authentication required');   // hardcoded, not translated
  return;
}
```

Compared to `ActivityElement` which uses `t('noAccessToken', { default: 'Authentication required' })`. The translation fallback pattern is inconsistent across the two sibling components.

---

### 5.3 `useSWR` + `useTransition` async handler anti-pattern in `ActivityElement`

```tsx
startTransition(async () => {
  try {
    await updateActivity(…);
    await mutate(courseMetaUrl);
  } catch (error) { … }
});
```

`startTransition` is React's mechanism for non-urgent state updates; it does **not** support Promise-based callbacks as of React 18 (Promise support lands in React 19). The `async () => {}` inside `startTransition` executes, but React cannot track the async work, so the `isPending` flag returns to `false` before the await resolves. The loading indicator disappears early.

**Fix:** In React 18, run the async work outside the transition and only call `startTransition` to apply synchronous state mutations.

---

### 5.4 `DialogTrigger` and `AlertDialogTrigger` render prop usage is inconsistent

Some places use the `render` prop pattern:

```tsx
<DialogTrigger render={<Button size="sm" />}>Content</DialogTrigger>
```

Others use child-wrapping:

```tsx
<AlertDialogTrigger>
  <Button …>Content</Button>
</AlertDialogTrigger>
```

These two patterns have different DOM outcomes (see bug 1.4). Enforce the `render` prop pattern everywhere.

---

### 5.5 `client.tsx` `CoursesHome` component is 680+ lines — beyond maintainable single-component size

The `CoursesHome` component handles: breadcrumbs, summary cards, preset filter bar, search + sort toolbar, bulk action state, bulk confirmation dialogs, results summary, empty state, card view, table view, and pagination. Each concern should live in its own file.

Suggested split:

- `CourseFilterBar` (search + sort + presets)
- `CourseSummaryCards` (stat cards)
- `CourseBulkToolbar` (bulk selection / actions)
- `CourseCardGrid` / `CourseDataTable` (views)
- `CoursePagination`

---

## 6. Must do Improvements Summary (One shot)

| #           | File                                                     | Change                                                    | Priority     |
| ----------- | -------------------------------------------------------- | --------------------------------------------------------- | ------------ |
| Fix 1.1     | `CourseReviewPublish.tsx`                                | Capture pre-toggle state for toast message                | **Critical** |
| Fix 1.2     | `lib/course-management.ts`                               | `certifications.length > 0` in readiness check            | **Critical** |
| Fix 1.3     | `ActivityElement.tsx`                                    | `nativeButton={false} render={<a />}` for link buttons    | **Critical** |
| Fix 1.4     | `ChapterElement.tsx`, `ActivityElement.tsx`              | `AlertDialogTrigger render={<Button />}`                  | **Critical** |
| Fix 1.5     | `EditCourseGeneral.tsx`                                  | Replace description `<Input>` with `<Textarea>`           | **High**     |
| Fix 1.6     | `lib/course-management.ts`                               | Access check includes private + no groups                 | **High**     |
| Fix 1.7     | `EditCourseStructure.tsx`                                | Add missing i18n keys                                     | **High**     |
| Fix 1.8     | `SectionHeader.tsx`                                      | Translate "Discard" button                                | **High**     |
| Fix 2.1–2.2 | `ActivityElement.tsx`, `ChapterElement.tsx`              | Replace all `neutral-*` and `bg-white` with design tokens | **High**     |
| Fix 2.3     | Both draggable elements                                  | `cn()` instead of template literals                       | **Medium**   |
| Fix 2.4     | Both draggable elements                                  | Remove rotation, soften drag shadow                       | **Medium**   |
| Fix 2.5     | `courseWorkflowUi.tsx`                                   | Use explicit amber tokens for warning tone                | **Medium**   |
| Fix 3.1     | `client.tsx`                                             | Server-computed aggregates for summary cards              | **High**     |
| Fix 3.2     | `CourseWorkspaceOverview.tsx`, `CourseReviewPublish.tsx` | Remove duplicate alert                                    | **Medium**   |
| Fix 3.3     | `CourseReviewPublish.tsx`                                | Allow publish with incomplete non-critical checks         | **Medium**   |
| Fix 3.4     | `ChapterElement.tsx`                                     | Remove decorative `MoreHorizontal` separator              | **Low**      |
| Fix 3.5     | All workspace pages                                      | Standardize section container to `space-y-6` only         | **Medium**   |
| Fix 3.8     | `CourseCreationWizard.tsx`                               | Clear URL params after successful creation                | **Medium**   |
| Fix 3.9     | `CourseWorkspaceOverview.tsx`                            | Add visual affordance to checklist links                  | **Low**      |
| Fix 4.1     | `ActivityElement.tsx`                                    | Resolve assignment UUIDs at the context/page level        | **High**     |
| Fix 4.2     | `client.tsx`                                             | Memoize readiness per course row                          | **Medium**   |
| Fix 5.3     | `ActivityElement.tsx`                                    | Fix `async` inside `startTransition` pattern              | **Medium**   |

---

## 7. Component-level fixes for ActivityElement and ChapterElement (consolidated)

Both draggable elements should be refactored as follows for correctness and theme-safety:

**ActivityElement** wrapper:

```tsx
<div
  ref={provided.innerRef}
  {...provided.draggableProps}
  className={cn(
    'mb-2 flex items-center gap-3 rounded-lg border bg-card p-3 transition-shadow',
    snapshot.isDragging ? 'opacity-90 shadow-lg ring-1 ring-ring/30' : 'shadow-sm hover:shadow-md',
  )}
>
```

**ChapterElement** drag handle + name:

```tsx
className="cursor-grab text-muted-foreground hover:text-foreground active:cursor-grabbing"
…
<h3 className="truncate text-sm font-medium text-foreground sm:text-base">
…
<Pencil className="size-3.5 text-muted-foreground" />
…
<div className="flex min-h-[60px] items-center justify-center text-sm text-muted-foreground">
```

Delete the bottom separator entirely:

```diff
- <div className="flex h-8 items-center justify-center border-t border-neutral-100">
-   <MoreHorizontal className="h-5 w-5 text-neutral-300" />
- </div>
```

**ChapterElement** card wrapper:

```tsx
className={cn(
  'mb-4 rounded-xl border bg-card transition-shadow',
  snapshot.isDragging ? 'opacity-90 shadow-xl ring-1 ring-ring/30' : 'shadow-sm hover:shadow-md',
)}
```

Remove the responsive horizontal margin (`mx-2 sm:mx-4 md:mx-6 lg:mx-10`) — the shell already provides horizontal padding, and the extra stacking creates orphan whitespace on large screens.
