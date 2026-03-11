# Course Management System — Critical Analysis & Rewrite Plan

**Branch:** `feat/course-management-v2` **Base:** `csmooc` **Date:** 2026-03-11 **Scope:** Course
list · Course creation wizard · Course workspace (all 7 stages) **Out of scope:** Learner view
(`/learn/`), activity editors, backend API contracts

---

## 1. Critical Analysis

### 1.1 Functional Bugs

| #   | Bug                                                                                      | Location                        | Impact                                                          |
| --- | ---------------------------------------------------------------------------------------- | ------------------------------- | --------------------------------------------------------------- |
| B1  | `useCallback` return value discarded — stale selected UUIDs never cleared on page change | `client.tsx:116–118`            | Bulk actions apply to courses from previous pages               |
| B2  | `courseNeedsAttention()` defined twice with identical bodies                             | `page.tsx:74`, `client.tsx:52`  | Subtle divergence risk; dead surface area                       |
| B3  | `URL.createObjectURL()` called on every render when `thumbnailPreview` is null           | `CreateCourse.tsx:263`          | Blob URL leak per render                                        |
| B4  | `isUploading` state initialised but `setIsUploading` never called                        | `CreateCourse.tsx:43`           | `animate-pulse` and `disabled` branches permanently dead        |
| B5  | `updateCourse()` alias passes no `options` → coarse-grained cache invalidation           | `courses.ts`                    | Any future caller gets wrong tag scope                          |
| B6  | `fetchCourse` / `fetchCourseById` tag only `tags.courses` (global)                       | `course-management-server.ts`   | Per-course update revalidations (`courseTag.detail`) are missed |
| B7  | Summary stat cards count from the current 24-item page, not the full dataset             | `client.tsx`                    | "Published: 3" when there are 47 published courses total        |
| B8  | `thumbnail_type` FormField registered twice under the same name                          | `EditCourseGeneral.tsx:450,477` | Two form controls share one slot; unpredictable value binding   |

### 1.2 Architecture Problems

| #   | Problem                                                                                                                                                            | Severity |
| --- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------- |
| A1  | Two parallel routing trees for the same feature (`/courses/[uuid]` new vs `/courses/course/[uuid]/[subpage]` legacy)                                               | High     |
| A2  | Filter presets applied client-side on already-paginated 24-item array → wrong counts                                                                               | High     |
| A3  | `renderCourseWorkspacePage` is an async server factory function inside a `*.tsx` component file instead of being a Server Component                                | High     |
| A4  | Capabilities fetched redundantly on every request for 5 of 7 stage pages (only `overview` and `review` pass pre-fetched capabilities)                              | Medium   |
| A5  | Dual `useUnsavedChangesGuard` invocations (section level + shell level) active simultaneously                                                                      | Medium   |
| A6  | Optimistic context dispatch + immediate `refreshCourseMeta()` SWR revalidation produces a double `setCourseStructure` dispatch with potentially different payloads | Medium   |
| A7  | SWR data synced into `useReducer` via `useEffect` creates a one-render lag                                                                                         | Low      |
| A8  | `CoursesHome` uses manual `URLSearchParams` + `router.push()` while `CourseCreationWizard` uses nuqs — two URL state patterns in the same feature                  | Medium   |
| A9  | `getInitialValues` logic duplicated: defined once as a function and repeated inside a `useEffect` body                                                             | Medium   |
| A10 | `formSchema` defined inside `EditCourseCertification` component body — unstable across renders, forces the `hasHydrated` workaround                                | Medium   |

### 1.3 Code Quality Problems

| #   | Problem                                                                                                                  | Location                         |
| --- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------- |
| Q1  | `course as any` casts all context values, silencing all type errors                                                      | `EditCourseCertification.tsx:53` |
| Q2  | `usePlatformSession() as any`, `useOrg() as any` repeated across every edit component                                    | All `EditCourse*` files          |
| Q3  | `course_uuid?: string` prop declared on all 4 edit components but never read (context used instead)                      | All `EditCourse*` props          |
| Q4  | `_props.orgslug` — underscore naming signals "unused" but prop is actively read                                          | All `EditCourse*` files          |
| Q5  | `_props` pattern conflicts with ESLint `no-unused-vars` conventions                                                      | All `EditCourse*` files          |
| Q6  | Mixed form validation: valibot resolver (cert), manual `setError` (general), no form library (access, contributors)      | 4 edit components                |
| Q7  | Raw `<button>` elements with hardcoded `bg-green-700`/`bg-rose-700` Tailwind classes instead of `Button` component       | `EditCourseAccess.tsx`           |
| Q8  | Certificate pattern `theme.icon.replace('text-', 'bg-')` — dynamically constructed class names purged by Tailwind JIT    | `CertificatePreview.tsx`         |
| Q9  | Hardcoded `"Ashyq Bilim"` string instead of `org?.name`                                                                  | `CertificatePreview.tsx:723`     |
| Q10 | `winReady` state in a `'use client'` component — `window` is always defined, state is always `true`, setter never called | `EditCourseStructure.tsx:38`     |
| Q11 | `openNewActivityModal` accepts `_chapterId` param it ignores (available via `props.chapterId`)                           | `NewActivityButton.tsx:31`       |
| Q12 | `submitExternalVideo` accepts `_chapterId` param it ignores                                                              | `NewActivityButton.tsx:80`       |
| Q13 | `const router = useRouter()` instantiated but never used                                                                 | `ChapterElement.tsx:22`          |
| Q14 | `console.error` in mutation catch blocks with no user-visible feedback                                                   | `ChapterElement.tsx:103,119,130` |
| Q15 | `CertificatePreview` is 680 lines with 10 near-identical pattern renderer blocks — no abstraction                        | `CertificatePreview.tsx`         |
| Q16 | "Unsaved changes", "Discard", "Save changes" labels hardcoded English in 4 components                                    | All `EditCourse*` headers        |
| Q17 | Sequential `for...of await` chapter creation in wizard                                                                   | `CourseCreationWizard.tsx`       |
| Q18 | Chapter creation has no rollback if one chapter in the sequence fails mid-way                                            | `CourseCreationWizard.tsx`       |

### 1.4 Dead Code to Delete

| Item                                                                        | File(s)                                           |
| --------------------------------------------------------------------------- | ------------------------------------------------- |
| Legacy `course/[courseuuid]/[subpage]/` routing tree                        | `app/orgs/.../dash/courses/course/` (entire dir)  |
| `mapLegacyCourseStage()`                                                    | `lib/course-management.ts`                        |
| `CourseOverviewTop` component                                               | `components/Dashboard/Misc/CourseOverviewTop.tsx` |
| `updateCourse()` alias export                                               | `services/courses/courses.ts`                     |
| `course_uuid?: string` in all `EditCourse*` props                           | 4 files                                           |
| Stale `useCallback` return (lines 116–118)                                  | `client.tsx`                                      |
| `isUploading` state + dead branches                                         | `CreateCourse.tsx`                                |
| `winReady` state                                                            | `EditCourseStructure.tsx`                         |
| `const router = useRouter()`                                                | `ChapterElement.tsx`                              |
| `_chapterId` parameters in `openNewActivityModal` and `submitExternalVideo` | `NewActivityButton.tsx`                           |

### 1.5 Custom / Legacy UI Components to Replace

| Current                                 | Used In                                                        | Replacement                                           |
| --------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------- |
| Custom `Modal` (dialogTrigger prop API) | `EditCourseStructure`, `NewActivityButton`, `EditCourseAccess` | `Dialog` / `AlertDialog` from shadcn                  |
| Custom `ToolTip` wrapper                | Multiple                                                       | `Tooltip` from shadcn (`@/components/ui/tooltip.tsx`) |
| `AccessOptionCard` div radios           | `EditCourseAccess`                                             | `RadioGroup` + styled label                           |
| Custom debounced input + results list   | `EditCourseContributors`                                       | `Command` inside `Popover`                            |
| Certificate pattern `div onClick` grid  | `CertificatePreview`                                           | `RadioGroup` + styled label                           |

---

## 2. Rewrite Plan

### Phase 0 — Foundation Fixes (no UI changes, unblock everything else)

These fixes are stand-alone and should be done first to avoid merge conflicts mid-rewrite.

**0.1 Fix stale selection bug**

Convert the orphaned `useCallback` into a `useEffect`:

```ts
// client.tsx — replace useCallback with useEffect
useEffect(() => {
  setSelectedCourseUuids((current) => current.filter((uuid) => visibleCourseUuids.includes(uuid)));
}, [visibleCourseUuids]);
```

**0.2 Export properly typed context hooks**

Add explicit return types to `useOrg()`, `usePlatformSession()`, `useCourse()`,
`useCourseDispatch()` so all `as any` casts can be removed. No logic changes — types only.

**0.3 Clean dead code**

Delete in one commit: unused `course_uuid` props, `updateCourse` alias, `mapLegacyCourseStage`,
`CourseOverviewTop`, stale `winReady` state, unused `router`, `_chapterId` parameters, `isUploading`
state.

**0.4 Fix Tailwind JIT class purge in `CertificatePreview`**

Before touching any visual changes, make the certificate work in production:

```ts
// Replace dynamic class construction with a static map
const PATTERN_THEMES = {
  blue: { icon: 'text-blue-600', bg: 'bg-blue-600', ring: 'ring-blue-200' },
  emerald: { icon: 'text-emerald-600', bg: 'bg-emerald-600', ring: 'ring-emerald-200' },
  violet: { icon: 'text-violet-600', bg: 'bg-violet-600', ring: 'ring-violet-200' },
  amber: { icon: 'text-amber-600', bg: 'bg-amber-600', ring: 'ring-amber-200' },
  rose: { icon: 'text-rose-600', bg: 'bg-rose-600', ring: 'ring-rose-200' },
  slate: { icon: 'text-slate-600', bg: 'bg-slate-600', ring: 'ring-slate-200' },
  // ... remaining themes
} as const;
```

Fix hardcoded `"Ashyq Bilim"` → `org?.name ?? ''`.

**0.5 Fix capability pre-fetch inconsistency**

In `renderCourseWorkspacePage`, always pre-fetch capabilities once. Remove the conditional — all 7
stage pages pass nothing; the function always resolves capabilities itself. This removes the
inconsistency without any per-page changes.

**0.6 Fix duplicate `thumbnail_type` FormField**

In `EditCourseGeneral`, the second FormField with `name="thumbnail_type"` should use
`form.watch('thumbnail_type')` and render `ThumbnailUpdate` as an uncontrolled display — not a
registered input.

**0.7 Fix blob URL leak in CreateCourse**

```ts
// Replace:
src={thumbnailPreview || URL.createObjectURL(thumbnailValue)}

// With a stable preview managed in state:
const [objectUrl, setObjectUrl] = useState<string | null>(null);
useEffect(() => {
  if (!thumbnailValue) return;
  const url = URL.createObjectURL(thumbnailValue);
  setObjectUrl(url);
  return () => URL.revokeObjectURL(url);
}, [thumbnailValue]);

// Usage:
src={thumbnailPreview ?? objectUrl ?? ''}
```

**0.8 Consolidate `courseNeedsAttention`**

Move to `lib/course-management.ts`, export it, import in both `page.tsx` and `client.tsx`.

**0.9 Fix post-save double dispatch**

On save success in all edit components, stop doing both `dispatchCourse(setCourseStructure)` AND
`refreshCourseMeta()`. Choose one:

- Use `refreshCourseMeta()` (SWR mutate) as the single source of truth. The context `useEffect` will
  pick the fresh data up in one cycle.
- Remove the manual `dispatchCourse` optimistic merge post-save — it was meant to avoid a loading
  flash but causes double-update.

**0.10 Move formSchema outside component body in EditCourseCertification**

```ts
// Move to module level (outside the component), resolving the hasHydrated workaround
const certFormSchema = v.pipe(
  v.object({ enable_certification: v.boolean(), ... }),
  ...
);
// Delete hasHydrated state and the useEffect that initialises it
```

---

### Phase 1 — Course List Page

**1.1 Move all filtering to server**

```ts
// page.tsx — pass all filter params to fetch
const courses = await getEditableOrgCourses(orgslug, {
  search: searchParams.q,
  preset: searchParams.preset, // 'draft' | 'published' | 'private' | 'needs_attention'
  sort: searchParams.sort,
  page: Number(searchParams.page ?? 1),
  limit: 24,
});
```

Remove all `.filter()` calls from `CoursesHome`. Remove client-side `courseNeedsAttention` usage
(now server-filtered). Summary stat counts come from `courses.meta.total_by_preset` fields returned
by the API, not from the page slice.

**1.2 Migrate URL state to nuqs**

`CoursesHome` currently uses manual `URLSearchParams` + `router.push()`. Replace with
`useQueryState` / `useQueryStates` from nuqs (layout already wraps in `NuqsAdapter`):

```ts
const [preset, setPreset] = useQueryState('preset', parseAsString.withDefault('all'));
const [q, setQ]           = useQueryState('q', parseAsString.withDefault(''));
const [page, setPage]     = useQueryState('page', parseAsNumberLiteral([1,2,3,...]).withDefault(1));
```

**1.3 Filter bar with `ToggleGroup`**

Replace custom CSS pill row with:

```tsx
<ToggleGroup
  type="single"
  value={preset}
  onValueChange={setPreset}
>
  <ToggleGroupItem value="all">All</ToggleGroupItem>
  <ToggleGroupItem value="draft">Drafts</ToggleGroupItem>
  <ToggleGroupItem value="published">Published</ToggleGroupItem>
  <ToggleGroupItem value="private">Private</ToggleGroupItem>
  <ToggleGroupItem value="needs_attention">Needs attention</ToggleGroupItem>
</ToggleGroup>
```

Combined with search `Input` + `Select` for sort on the same row.

**1.4 Course card redesign**

Replace custom `CourseThumbnail` with shadcn `Card` family:

```
┌────────────────────────────────┐
│  [Thumbnail 16:9]              │
├────────────────────────────────┤
│  Course Title                  │
│  [Badge: Draft] · 3 days ago   │
│                                │
│  [Avatar][Avatar]+2  ·  5 ch.  │
├────────────────────────────────┤
│  [Open Workspace]    [⋯ menu]  │
└────────────────────────────────┘
```

`Badge` variants: `secondary` (draft), `default` (published), `outline` (private).

**1.5 Bulk action toolbar**

Use `AnimatePresence` from `motion/react` (already in the bundle) to slide in a bottom-anchored
toolbar when `selectedUuids.length > 0`:

```
[ 3 selected  ·  Publish  ·  Make Private  ·  Delete ]
```

Fix the stale-selection bug (Phase 0.1) so the count is always accurate.

**1.6 Readiness column in table view**

Add a `Progress` component column showing the completion percentage (title + description +
thumbnail + activities > 0). Replaces the vague "Needs attention" text indicator.

**1.7 Empty states**

Use `Empty` from `@/components/ui/empty.tsx`. CTA: "Create your first course" links to
`/dash/courses/new`. Filtered empty state: "No courses match this filter — clear filters."

---

### Phase 2 — Course Creation Wizard

**2.1 URL-based step state with nuqs**

```ts
const [step, setStep] = useQueryState('step', parseAsInteger.withDefault(0));
```

Use `router.replace` (not push) so back-button exits wizard rather than stepping backward
unexpectedly.

**2.2 Visual step indicator**

Replace "Step 1 of 3" text with:

```
● Basics ──────── ● Template ──────── ○ Launch
```

`Separator` lines between filled/unfilled `Badge` circles. No external stepper library.

**2.3 Template picker with `RadioGroup`**

```tsx
<RadioGroup
  value={template}
  onValueChange={setTemplate}
>
  {TEMPLATES.map((t) => (
    <label
      key={t.id}
      htmlFor={`t-${t.id}`}
      className="cursor-pointer rounded-xl border p-4 has-[[data-state=checked]]:ring-2 has-[[data-state=checked]]:ring-primary"
    >
      <RadioGroupItem
        id={`t-${t.id}`}
        value={t.id}
        className="sr-only"
      />
      <div className="font-medium">{t.label}</div>
      <div className="text-sm text-muted-foreground">{t.description}</div>
    </label>
  ))}
</RadioGroup>
```

Keyboard accessible, no custom click handlers.

**2.4 Mobile-first summary panel**

Current sidebar hidden on mobile. New: `Collapsible` panel above the form on mobile, sticky `aside`
on `lg:` breakpoint.

**2.5 Parallel chapter creation**

```ts
// Before
for (const chapter of chapters) {
  await createChapter(courseUuid, chapter);
}

// After
await Promise.all(chapters.map((ch) => createChapter(courseUuid, ch)));
```

Add cleanup: if course creation succeeds but chapter creation partially fails, delete the orphaned
course and show an actionable error.

**2.6 Create via server action, not client-side API call**

Move the creation logic into a Next.js server action. The wizard client component calls the action
and receives the new `courseUuid` back. Eliminates exposing the access token to the client bundle.

---

### Phase 3 — Course Workspace Shell

**3.1 Already-built `Sidebar` component**

`@/components/ui/sidebar.tsx` exists. `CourseWorkspacePageShell` already uses it. Audit and ensure
nav items are using `SidebarMenuBadge` for readiness indicators rather than custom badges.

Nav grouping:

```
SidebarGroup "Course"
  Overview · Details · Curriculum

SidebarGroup "Management"
  Access · Collaboration · Certificate

SidebarGroup "Publish"
  Review & Publish  [Badge: 2 issues]
```

**3.2 Mobile: `Sheet`-based sidebar**

On narrow viewports, render the nav inside a `Sheet` triggered by a `SidebarTrigger`. Remove the
horizontal-scroll pill row.

**3.3 Inline course title editing**

Header title becomes an `Input` with `variant="ghost"` on focus, `onBlur` auto-saves via server
action. No separate save button for the title. Debounce 500ms.

**3.4 Shared `SectionHeader` component**

The "Unsaved changes · Discard · Save changes" header is copy-pasted across 4 files. Extract to:

```tsx
// components/Dashboard/Courses/SectionHeader.tsx
interface SectionHeaderProps {
  title: string;
  isDirty: boolean;
  isSaving: boolean;
  onSave: () => void;
  onDiscard: () => void;
}
```

Each edit component renders `<SectionHeader ... />`. Centralizes the i18n keys too (currently
hardcoded English in all 4 files).

**3.5 Consolidate save pattern**

Extract `useSaveSection` hook:

```ts
function useSaveSection(saveFn: () => Promise<ApiResponse>) {
  const [isSaving, setIsSaving] = useState(false);
  const { showConflict, refreshCourseMeta } = useCourse();

  const save = useCallback(async () => {
    setIsSaving(true);
    try {
      const response = await saveFn();
      if (response.status === 409) {
        showConflict(response.data);
        return;
      }
      if (!response.ok) {
        toast.error('Failed to save. Try again.');
        return;
      }
      await refreshCourseMeta(); // single source of truth — no optimistic dispatch
      toast.success('Changes saved');
    } finally {
      setIsSaving(false);
    }
  }, [saveFn]);

  return { isSaving, save };
}
```

The 409 → `showConflict` → `CourseConflictDialog` flow is unchanged. All 4 edit components adopt
this hook — the per-component `try/catch/toast.error/showConflict` blocks are deleted.

**3.6 Standardise form validation**

All edit components use `react-hook-form` + `valibotResolver`. `EditCourseGeneral` migrates from
manual `validateValues()`/`form.setError()` to a schema-based resolver. `EditCourseAccess` and
`EditCourseContributors` adopt `useForm` for their single boolean / search state.

**3.7 Rename `_props` parameter**

All `EditCourse*` props parameters renamed from `_props` to `props`. Remove dead
`course_uuid?: string` from all interfaces.

---

### Phase 4 — Stage: Details (`EditCourseGeneral`)

**4.1 Decouple thumbnail from metadata dirty state**

`ThumbnailUpdate` calls its own endpoint (`updateCourseThumbnail`). Remove the `disabled={isDirty}`
constraint and its tooltip. Thumbnail can be uploaded at any time independently.

**4.2 Two-column layout on desktop**

```
lg:grid lg:grid-cols-[1fr_320px] lg:gap-8

Left:  title · description · tags · learning outcomes
Right: Card "Thumbnail & Media"
         ThumbnailUpdate
         thumbnail_type select
```

`Card` from shadcn groups the right panel.

**4.3 Learning outcomes drag-to-reorder**

`LearningItemsList` gains `@hello-pangea/dnd` drag handles (same package, already bundled). Each
item row gets a `GripVertical` handle with `cursor-grab`. Parent `DragDropContext onDragEnd`
reorders the array.

**4.4 Fix `getInitialValues` duplication**

Extract as a module-level function. `useMemo` the result on `courseStructure`. Remove duplicate
inside `useEffect`.

---

### Phase 5 — Stage: Curriculum (`EditCourseStructure`)

**5.1 Remove `winReady` state**

Delete the state and unconditionally render `DragDropContext`. The component is `'use client'` so
`window` is always available.

**5.2 Collapsible chapters**

Wrap chapter activities in `Collapsible` from shadcn:

```tsx
<Collapsible
  open={isExpanded}
  onOpenChange={setIsExpanded}
>
  <CollapsibleTrigger asChild>
    <ChapterHeader /> {/* existing chapter header, add ChevronDown */}
  </CollapsibleTrigger>
  <CollapsibleContent>{/* activity list droppable */}</CollapsibleContent>
</Collapsible>
```

Chapter activity count badge in the header when collapsed.

**5.3 Activity type icons + compressed rows**

Map activity type → Lucide icon:

```ts
const ACTIVITY_TYPE_ICONS = {
  video: Video,
  document: FileText,
  assignment: ClipboardCheck,
  code: Code2,
  dynamic: BookOpen,
  exam: GraduationCap,
} as const;
```

Reduce activity row padding. Show `Badge` with type label next to icon. Row height ~44px (from
current ~72px).

**5.4 New activity as chapter header `DropdownMenu`**

Move `NewActivityButton` from per-chapter bottom position into the chapter header:

```tsx
<DropdownMenu>
  <DropdownMenuTrigger asChild>
    <Button
      variant="ghost"
      size="sm"
    >
      <Plus /> Add
    </Button>
  </DropdownMenuTrigger>
  <DropdownMenuContent>
    <DropdownMenuItem onSelect={() => createActivity('video')}>
      <Video className="mr-2 size-4" /> Video
    </DropdownMenuItem>
    {/* ... other types */}
  </DropdownMenuContent>
</DropdownMenu>
```

**5.5 Inline chapter rename**

Replace pencil icon + separate input with click-to-edit on the chapter title: `Input` that appears
on click, loses focus → `onBlur` auto-saves. No dialog.

**5.6 Empty chapter state**

```tsx
{
  chapter.activities.length === 0 && (
    <div className="m-2 rounded-lg border-2 border-dashed border-muted p-4 text-center text-sm text-muted-foreground">
      Drop activities here or use Add
    </div>
  );
}
```

Replace custom `Modal` for new chapter and new activity with `Dialog` from shadcn.

---

### Phase 6 — Stage: Access (`EditCourseAccess`)

**6.1 `RadioGroup` for visibility**

```tsx
<RadioGroup value={draftPublic ? 'public' : 'private'} onValueChange={v => setDraftPublic(v === 'public')}>
  <label htmlFor="opt-public" className="has-[[data-state=checked]]:ring-2 ...">
    <RadioGroupItem id="opt-public" value="public" className="sr-only" />
    <Globe className="size-5" />
    <span>Public</span>
  </label>
  <label htmlFor="opt-private" ...>
    <RadioGroupItem id="opt-private" value="private" className="sr-only" />
    <Lock className="size-5" />
    <span>Private</span>
  </label>
</RadioGroup>
```

**6.2 Replace custom `Modal` with `Dialog`**

"Link to user group" uses a custom `Modal` (`@components/Objects/Elements/Modal/Modal`). Replace
with `Dialog` / `DialogTrigger` / `DialogContent` from shadcn.

**6.3 Replace raw `<button>` elements**

"Link to user group" and "Delete link" buttons → `Button variant="default"` /
`Button variant="destructive"`.

**6.4 `ScrollArea` on user groups table**

```tsx
<ScrollArea className="max-h-64">
  <Table>...</Table>
</ScrollArea>
```

---

### Phase 7 — Stage: Collaboration (`EditCourseContributors`)

**7.1 Replace custom search with `Command` inside `Popover`**

```tsx
<Popover
  open={open}
  onOpenChange={setOpen}
>
  <PopoverTrigger asChild>
    <Button variant="outline">
      <UserPlus className="mr-2 size-4" />
      Add contributor
    </Button>
  </PopoverTrigger>
  <PopoverContent className="w-80 p-0">
    <Command>
      <CommandInput
        placeholder="Search by name or email..."
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>No members found.</CommandEmpty>
        <CommandGroup>
          {results.map((user) => (
            <CommandItem
              key={user.id}
              onSelect={() => toggleUser(user)}
            >
              <Checkbox
                checked={selected.has(user.id)}
                className="mr-2"
              />
              <UserAvatar
                user={user}
                size="sm"
              />
              <div className="flex flex-col">
                <span>{user.name}</span>
                <span className="text-xs text-muted-foreground">{user.email}</span>
              </div>
            </CommandItem>
          ))}
        </CommandGroup>
      </CommandList>
      {selected.size > 0 && (
        <div className="border-t p-2">
          <Button
            className="w-full"
            onClick={addSelected}
          >
            Add {selected.size} contributor{selected.size > 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </Command>
  </PopoverContent>
</Popover>
```

**7.2 Contributors table with `ScrollArea` and empty state**

```tsx
{
  contributors.length === 0 ? (
    <Empty description="No contributors yet" />
  ) : (
    <ScrollArea className="max-h-96">
      <Table>...</Table>
    </ScrollArea>
  );
}
```

---

### Phase 8 — Stage: Certificate (`EditCourseCertification`)

**8.1 Move schema outside component** (done in Phase 0.10)

**8.2 Pattern picker with `RadioGroup`**

Same pattern as Access and Wizard template pickers. Remove `div onClick` grid, add keyboard
navigation.

**8.3 Refactor `CertificatePreview`**

Extract the 10 pattern renderers into a typed record:

```tsx
type PatternRenderer = React.FC<{ theme: PatternTheme }>;

const PATTERN_RENDERERS: Record<string, PatternRenderer> = {
  classic: ClassicPattern,
  geometric: GeometricPattern,
  // ...
};

// In the component:
const PatternComponent = PATTERN_RENDERERS[selectedPattern];
return <PatternComponent theme={themeConfig} />;
```

Reduces 680 lines to ~200. Each pattern component is 15–30 lines.

---

### Phase 9 — Stage: Overview (`CourseWorkspaceOverview`)

Redesign as a high-information-density dashboard landing:

```
┌─────────────────────────────────────────────────────┐
│  READINESS                              [Review →]  │
│  ████████░░░░  4/6 checks passed                    │
│  <Progress value={66} />                            │
├────────────────┬──────────────────┬─────────────────┤
│  Curriculum    │  Access          │  Collaboration  │
│  3 chapters    │  Private         │  2 contributors │
│  12 activities │  0 user groups   │                 │
│  [Edit →]      │  [Edit →]        │  [Edit →]       │
├────────────────┴──────────────────┴─────────────────┤
│  CHECKLIST                                          │
│  ✓ Title & description filled                       │
│  ✓ Thumbnail uploaded                               │
│  ✓ Curriculum has activities                        │
│  ⚠ Course is private with no linked groups         │  ← Alert
│  ✗ Certificate not configured                       │
└─────────────────────────────────────────────────────┘
```

- `Progress` for readiness score
- `Card` per stat panel
- `Alert variant="warning"` for the private-no-groups situation
- Checklist items use `CheckCircle2` (green), `XCircle` (red), `AlertCircle` (yellow) Lucide icons

---

### Phase 10 — Stage: Review (`CourseReviewPublish`)

Replace plain `ul` checklist with `Card` per check:

```tsx
{CHECKS.map(check => (
  <Card key={check.id} className={cn('border-l-4', check.passed ? 'border-l-green-500' : 'border-l-red-500')}>
    <CardContent className="flex items-center gap-3 py-3">
      {check.passed
        ? <CheckCircle2 className="size-5 text-green-600" />
        : <XCircle className="size-5 text-red-600" />}
      <div className="flex-1">
        <p className="font-medium">{check.title}</p>
        <p className="text-sm text-muted-foreground">{check.description}</p>
      </div>
      {!check.passed && (
        <Button variant="outline" size="sm" asChild>
          <Link href={check.editHref}>Fix →</Link>
        </Button>
      )}
    </CardContent>
  </Card>
))}
<Separator className="my-4" />
<AlertDialog>
  <AlertDialogTrigger asChild>
    <Button disabled={!allPassed}>Publish course</Button>
  </AlertDialogTrigger>
  <AlertDialogContent>...</AlertDialogContent>
</AlertDialog>
```

---

## 3. Files to Create / Modify / Delete

### New Files

```
apps/web/components/Dashboard/Courses/SectionHeader.tsx
apps/web/hooks/useSaveSection.ts
```

### Modified Files (major)

| File                                                                                          | What Changes                                                  |
| --------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| `app/orgs/.../dash/courses/client.tsx`                                                        | Server-side filters, nuqs, card redesign, fix useCallback bug |
| `app/orgs/.../dash/courses/page.tsx`                                                          | Pass all filter params to fetch                               |
| `components/Dashboard/Courses/CourseCreationWizard.tsx`                                       | URL state, RadioGroup, parallel creation, server action       |
| `components/Dashboard/Courses/CourseWorkspacePageShell.tsx`                                   | SectionHeader, mobile nav, inline title                       |
| `components/Dashboard/Courses/CourseWorkspaceOverview.tsx`                                    | Dashboard redesign                                            |
| `components/Dashboard/Courses/CourseReviewPublish.tsx`                                        | Card-based checklist                                          |
| `components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral.tsx`                   | Two-col, decouple thumbnail, valibot schema, useSaveSection   |
| `components/Dashboard/Pages/Course/EditCourseGeneral/LearningItemsList.tsx`                   | Drag-to-reorder                                               |
| `components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure.tsx`               | Remove winReady, collapsible                                  |
| `components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ChapterElement.tsx`  | Collapsible, inline rename, DropdownMenu add button           |
| `components/Dashboard/Pages/Course/EditCourseStructure/DraggableElements/ActivityElement.tsx` | Compact row, type icon/badge                                  |
| `components/Dashboard/Pages/Course/EditCourseStructure/Buttons/NewActivityButton.tsx`         | Move into chapter header DropdownMenu                         |
| `components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess.tsx`                     | RadioGroup, Dialog, Button, ScrollArea                        |
| `components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors.tsx`         | Command combobox, ScrollArea, empty state                     |
| `components/Dashboard/Pages/Course/EditCourseCertification/EditCourseCertification.tsx`       | Schema outside component, RadioGroup picker                   |
| `components/Dashboard/Pages/Course/EditCourseCertification/CertificatePreview.tsx`            | PATTERN_RENDERERS record, fix purge, fix org name             |
| `components/Contexts/CourseContext.tsx`                                                       | Typed exports for useCourse / useCourseDispatch               |
| `services/courses/courses.ts`                                                                 | Remove updateCourse alias                                     |
| `lib/course-management.ts`                                                                    | Remove mapLegacyCourseStage, add courseNeedsAttention export  |
| `objects/Modals/Course/Create/CreateCourse.tsx`                                               | Fix blob leak, remove isUploading                             |

### Deleted Files

```
apps/web/app/orgs/[orgslug]/dash/courses/course/   (entire directory)
apps/web/components/Dashboard/Misc/CourseOverviewTop.tsx
```

---

## 4. shadcn/ui Component Mapping

| Location                      | Current                           | Proposed                                       |
| ----------------------------- | --------------------------------- | ---------------------------------------------- |
| Course list filter bar        | Custom CSS pill row               | `ToggleGroup` + `ToggleGroupItem`              |
| Course list cards             | Custom `CourseThumbnail`          | `Card` + `CardContent` + `CardFooter`          |
| Bulk action toolbar           | Custom                            | Animated bottom bar (motion/react)             |
| Readiness column              | Absent                            | `Progress`                                     |
| Wizard template picker        | `div onClick`                     | `RadioGroup` + styled label                    |
| Wizard step indicator         | "Step N of 3" text                | `Separator` + `Badge` circles                  |
| Wizard summary panel (mobile) | Hidden                            | `Collapsible`                                  |
| Workspace mobile nav          | Horizontal scroll pills           | `Sheet` + `SidebarMenu`                        |
| Section save header           | Copy-pasted per component         | `SectionHeader` (new, uses `Button` + `Badge`) |
| Access visibility toggle      | Custom `AccessOptionCard` divs    | `RadioGroup` + styled label                    |
| Access user groups            | Plain table                       | `Table` + `ScrollArea`                         |
| Access user group link modal  | Custom `Modal`                    | `Dialog` / `DialogContent`                     |
| Contributors search           | Custom debounced input + list     | `Command` inside `Popover`                     |
| Contributors table            | Plain table                       | `Table` + `ScrollArea` + `Empty`               |
| Certificate pattern picker    | `div onClick` grid                | `RadioGroup` + styled label                    |
| Curriculum chapter            | Flat `Draggable`                  | `Collapsible` + `Draggable`                    |
| Curriculum new activity       | Per-chapter bottom button         | `DropdownMenu` on chapter header               |
| Activity type indicator       | Absent                            | `Badge` + Lucide icon                          |
| Overview readiness            | Custom stat divs                  | `Card` + `Progress` + `Alert`                  |
| Review checklist              | Plain `ul`                        | `Card` per check + `Separator`                 |
| Publish confirm               | Direct click                      | `AlertDialog`                                  |
| Save feedback                 | None                              | `toast` (Sonner)                               |
| Loading states                | `PageLoading` spinner             | `Skeleton` per section                         |
| All destructive confirms      | Mix of AlertDialog + custom Modal | `AlertDialog` (uniform)                        |

---

## 5. i18n Gaps to Fix

The following strings are hardcoded English and need i18n keys:

- "Unsaved changes" label in all `EditCourse*` section headers
- "Discard" / "Save changes" button labels (same location)
- "Changes saved" / "Failed to save" toast messages
- Empty state descriptions in contributors and user groups
- Review checklist item titles and descriptions

Mark all new strings with `// i18n:TODO` for translator follow-up.

---

## 6. Implementation Order - One shot
