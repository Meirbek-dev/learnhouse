# Course / Chapter / Activity Management — Critical Audit

> Generated: 2026-03-28
> Branch: `csmooc`
> Scope: backend (`apps/api/src/{db,routers,services}/courses/`) and frontend (`apps/web/{components,hooks,services,schemas}/`)

---

## Table of Contents

1. [Critical Bugs](#1-critical-bugs)
2. [High-Severity Issues](#2-high-severity-issues)
3. [Medium-Severity Issues](#3-medium-severity-issues)
4. [Low-Severity / Design Weaknesses](#4-low-severity--design-weaknesses)
5. [Remediation Plan](#5-remediation-plan)

---

## 1. Critical Bugs

### 1.1 — `move_activity_to_order`: denormalized `course_id` never synced on cross-chapter moves

**File:** `apps/api/src/services/courses/chapters.py:234-237`

```python
if target_chapter_uuid:
    target_chapter = _get_chapter_by_uuid(target_chapter_uuid, db_session)
    activity.chapter_id = target_chapter.id
    # ← activity.course_id is NOT updated here
```

`Activity.course_id` is a denormalized FK documented as "kept for query performance; synced on create/move." On creation (`activities/activities.py:88`) `course_id` is never set either — only `chapter_id` is. Any code that queries `Activity.course_id` (e.g., search, progress tracking, analytics) will read a stale or `NULL` value after a cross-chapter or initial-creation event.

**Fix:** after setting `activity.chapter_id = target_chapter.id`, also add:
```python
activity.course_id = target_chapter.course_id
```
And in `create_activity`, resolve `chapter.course_id` and write it to the new activity.

---

### 1.2 — `move_activity_to_order`: permission check is ownership-only, enabling cross-course activity hijacking

**File:** `apps/api/src/services/courses/chapters.py:229-232`

```python
checker.require(
    current_user.id, "activity:update", resource_owner_id=activity.creator_id
)
```

This verifies only that the caller owns the activity, not that they have write access to the **target chapter's course**. A user who created an activity in Course A can call `PATCH /chapters/{chapterInCourseB}/activities/{uuid}/order` to move their activity into a chapter of Course B, where they have zero authorship. The target chapter is never permission-checked.

**Fix:** after resolving `target_chapter`, call:
```python
target_course = _get_course_for_chapter(target_chapter, db_session)
require_course_permission("chapter:update", current_user, target_course, checker)
```

---

### 1.3 — `ChapterUpdate` exposes `course_id` as a writable field, enabling chapter hijacking

**File:** `apps/api/src/db/courses/chapters.py:46-51`

```python
class ChapterUpdate(SQLModelStrictBaseModel):
    name: str | None = None
    description: str | None = None
    thumbnail_image: str | None = None
    course_id: int | None = None   # ← dangerous
```

`update_chapter` authorises the request against the **original** course. If `course_id` is included in the request body, the chapter is silently relocated to that course without any permission check on the destination course. An attacker can move any chapter they can edit into another course they do not own.

**Fix:** remove `course_id` from `ChapterUpdate`. Chapter–course assignment is immutable after creation; if it ever needs to change, a dedicated transfer endpoint with dual-side permission checks should be used.

---

### 1.4 — `_accessible_courses_filter`: private courses without a UserGroup restriction are world-readable

**File:** `apps/api/src/services/courses/courses.py:51-71`

```python
.where(
    or_(
        Course.public,
        UserGroupResource.resource_uuid.is_(None),  # ← allows all authenticated users
        UserGroupUser.user_id == current_user.id,
        ResourceAuthor.user_id == current_user.id,
    )
)
```

`UserGroupResource.resource_uuid.is_(None)` is `True` for every course that has **no UserGroup entry**, which includes all freshly-created private courses. Any authenticated user can enumerate and read every private course that was never explicitly added to a UserGroup. The intent of the comment ("not in any UserGroup") describes an insecure design.

**Fix:** replace the `is_(None)` branch with an authorship or creator check:
```python
or_(
    Course.public,
    UserGroupUser.user_id == current_user.id,
    ResourceAuthor.user_id == current_user.id,
    Course.creator_id == current_user.id,
)
```

---

### 1.5 — `reorder_chapters_and_activities`: silently drops unmentioned items, causing order collisions

**File:** `apps/api/src/services/courses/chapters.py:366-398`

If the client payload omits any chapter or activity UUID (stale data, race condition, or malicious request), those rows are silently skipped. Their `order` values remain at their old numbers, while items present in the payload are re-indexed from 1. This produces **duplicate `order` values** for chapters/activities in the same course, corrupting the curriculum layout. No error is raised, no client warning is issued.

**Fix:** validate the payload completeness before writing:
1. Query all chapter IDs for the course and all activity IDs for those chapters.
2. Compare against the payload sets; raise HTTP 422 if any are missing or extra UUIDs appear.
3. Only commit if the sets match exactly.

---

## 2. High-Severity Issues

### 2.1 — Position not clamped to valid range in atomic order endpoints

**File:** `apps/api/src/services/courses/chapters.py:188, 238`

```python
new_order = max(1, position)   # no upper bound
```

Sending `position=999` for a course with three chapters assigns `order=999` to the moved chapter, creating large ordering gaps. The next call to `_next_chapter_order` would return `1000`, compounding the gap. The frontend passes the `destination.index` from the drag library which is always valid, but the endpoint is also callable directly.

**Fix:** after counting siblings, clamp:
```python
new_order = max(1, min(position, len(siblings) + 1))
```

---

### 2.2 — No concurrency protection in `reorder_chapters_and_activities`

**File:** `apps/api/src/services/courses/chapters.py:333-400`

Course metadata updates use `_ensure_course_is_current(course, last_known_update_date)` to detect concurrent edits and return HTTP 409. The bulk reorder endpoint accepts no `last_known_update_date`, so two instructors drag-and-dropping simultaneously will silently overwrite each other. This is especially problematic in multi-author courses.

**Fix:** accept an optional `last_known_update_date` in the `ChapterUpdateOrder` payload (mirroring `CourseMetadataUpdate`) and call `_ensure_course_is_current` before writing. Update `chapter.update_date` values, then refresh `course.update_date` to propagate the version.

---

### 2.3 — `ActivityUpdate` allows type/subtype mismatch

**File:** `apps/api/src/db/courses/activities.py:138-144`
**File:** `apps/api/src/services/courses/activities/activities.py:155-164`

`ActivityCreate` uses a `@model_validator` to enforce that `activity_sub_type` is compatible with `activity_type`. `ActivityUpdate` has no such validation. Patching `{ "activity_type": "TYPE_VIDEO" }` without updating `activity_sub_type` from `SUBTYPE_DOCUMENT_PDF` leaves the activity in an inconsistent state that will fail all downstream type-dispatch logic.

**Fix:** add the same `@model_validator(mode="after")` to `ActivityUpdate`, operating on set fields only:
```python
@model_validator(mode="after")
def subtype_matches_type(self):
    if self.activity_type and self.activity_sub_type:
        allowed = _VALID_SUBTYPES.get(self.activity_type, set())
        if allowed and self.activity_sub_type not in allowed:
            raise ValueError(...)
    return self
```

---

### 2.4 — `get_chapter` uses a structurally broken permission check

**File:** `apps/api/src/services/courses/chapters.py:107-109`

```python
checker.require(current_user.id, "course:read")
```

This checks for a global `course:read` capability, not for access to the specific course this chapter belongs to. For a private course, a user who happens to have `course:read` on *any* other resource would pass. The course is fetched (line 105) solely to verify it exists — its access rules are never applied.

**Fix:** replace with:
```python
require_course_permission("course:read", current_user, course, checker)
```

---

### 2.5 — `list_editable_courses` paginates 10,000 rows in Python

**File:** `apps/api/src/services/courses/courses.py:217-252`

```python
all_courses = await get_editable_courses(
    ..., page=1, limit=10_000, apply_pagination=False
)
# then filters + slices in Python
filtered_courses[offset : offset + limit]
```

The entire accessible course catalogue (up to 10,000 rows) is loaded into memory before preset filtering and pagination. As the platform grows this will become a slow, memory-heavy query on every dashboard load.

**Fix:** push preset filtering and pagination into SQL. `_build_editable_course_insights` already does batch SQL aggregation; add a `preset` filter clause to `get_editable_courses` or perform a pre-filter via a CTE.

---

## 3. Medium-Severity Issues

### 3.1 — `create_activity` and `update_activity` use timezone-naïve `datetime.now()`

**Files:**
- `apps/api/src/services/courses/activities/activities.py:87-88` — `create_activity`
- `apps/api/src/services/courses/activities/activities.py:160` — `update_activity`

```python
activity.creation_date = datetime.now()   # naive — no tz=UTC
activity.update_date = datetime.now()
```

All other datetime writes in the codebase use `datetime.now(tz=UTC)`. Naive datetimes are stored as UTC by the DB driver but without tzinfo, causing `_ensure_course_is_current` comparisons and any frontend ISO parsing to behave inconsistently.

**Fix:** change to `datetime.now(tz=UTC)` in both locations. Add `from datetime import UTC` if not already imported.

---

### 3.2 — Frontend: `Object.assign` mutates SWR cache objects in place

**File:** `apps/web/hooks/mutations/useActivityMutations.ts:37-42`

```typescript
chapters: (current.chapters ?? []).map((chapter: any) =>
  Object.assign(chapter, {          // ← mutates chapter in-place
    activities: ...
  }),
),
```

Also in `useChapterMutations.ts:70`:
```typescript
chapter.chapter_uuid === chapterUuid ? Object.assign(chapter, payload) : chapter,
```

`Object.assign(target, ...)` mutates `target` and returns it. Since `chapter` is a cached SWR object, this mutates shared state outside of React's immutability contract. The chapter's reference identity does not change, which can prevent React from detecting updates, skip re-renders, or introduce stale-state bugs in components holding a reference to the same object.

**Fix:** replace with object spread:
```typescript
chapter.chapter_uuid === chapterUuid ? { ...chapter, ...payload } : chapter
```

---

### 3.3 — `fetchActivityWithAuth` constructs double-prefixed URLs

**File:** `apps/web/services/courses/activities.ts:389`

```typescript
const result = await fetch(`${getAPIUrl()}activities/activity_${activity_uuid}`, ...)
```

If the caller passes the canonical UUID `activity_XYZ`, the URL becomes `activities/activity_activity_XYZ` — a 404. The sibling function `fetchActivity` (line 351) uses `activities/${activity_uuid}` without adding a prefix, showing the inconsistency. Any caller that passes a clean short ID gets a correct URL; any caller that passes the full stored UUID (as returned by the backend) gets a broken URL.

**Fix:** decide on a single convention — strip the prefix at call sites using `cleanActivityUuid`, or remove the manual prefix from this function.

---

### 3.4 — `createChapter` sends `course_id` as internal integer ID, leaking primary keys

**File:** `apps/web/components/Dashboard/Pages/Course/EditCourseStructure/CurriculumEditor.tsx:70`

```typescript
await createChapter({ name, course_id: course.courseStructure.id }, access_token);
```

All other course identifiers in the API (courses, chapters, activities) are UUIDs. `ChapterCreate.course_id` is an internal auto-increment integer. Exposing this enables sequential enumeration of all courses in the database. The UI reads `.id` from the structure response, which means the backend is already leaking internal IDs.

**Fix:**
1. Add a `course_uuid` field to `ChapterCreate` and resolve the `Course` by UUID server-side.
2. Remove the `id` field from `ChapterRead` returned to the client, or at minimum stop using it as an API key.

---

### 3.5 — Unpublished activity filtering happens in Python, not SQL

**File:** `apps/api/src/services/courses/chapters.py:305-307`

```python
for activity in activities_by_chapter.get(chapter.id, []):
    if not with_unpublished_activities and not activity.published:
        continue
```

All activities are fetched from the DB, then the filter is applied in the Python loop. For a course with thousands of unpublished activities (e.g., a large exam bank), all are transferred to the application server and discarded.

**Fix:** add `Activity.published == True` to the SQL query when `with_unpublished_activities` is `False`:
```python
q = select(Activity).where(Activity.chapter_id.in_(chapter_ids)).order_by(Activity.order)
if not with_unpublished_activities:
    q = q.where(Activity.published == True)
activities = db_session.exec(q).all()
```

---

### 3.6 — No error thrown and no client warning when `reorder_chapters_and_activities` payload is incomplete

See Critical §1.5 above. A secondary consequence: the API returns HTTP 200 with `{"detail": "Chapters and activities reordered successfully"}` even when some UUIDs were silently ignored. The frontend treats this as success and its optimistic update shows the correct order, but the server's state is corrupt. The user will only notice on the next page reload.

---

### 3.7 — Dead `/publish` endpoint for activities duplicates generic PATCH

**File:** `apps/api/src/routers/courses/activities/activities.py:65-79`

`PATCH /activities/{uuid}/publish?published=true` calls the same `update_activity` service as `PATCH /activities/{uuid}`. The frontend never calls it. The `published` query parameter is also inconsistent with how all other activity updates pass body JSON. This endpoint should be removed or documented as deprecated.

---

## 4. Low-Severity / Design Weaknesses

### 4.1 — `_next_activity_order` is duplicated in two service files

**Files:**
- `apps/api/src/services/courses/chapters.py:57-63`
- `apps/api/src/services/courses/activities/activities.py:49-55`

Identical function; a divergence in either will silently produce different orderings. Extract to a shared utility module (e.g., `services/courses/_utils.py`).

---

### 4.2 — No maximum depth limits (chapters per course, activities per chapter)

There are no guards preventing a user from creating 10,000 chapters in a single course. The `order` integer column and pagination are the only natural limits. Any O(n) loop over chapters/activities (including the Python filter in §3.5 and the bulk reorder) becomes a DoS vector.

**Suggested limits:** 200 chapters per course, 500 activities per chapter, enforced with HTTP 422.

---

### 4.3 — No rate limiting on course management mutation endpoints

The AI router uses `slowapi`, but `POST /chapters`, `POST /activities`, and the bulk reorder `PATCH` have no rate limits. An authenticated user could script rapid chapter/activity creation or spam the reorder endpoint.

---

### 4.4 — `createChapter` service URL has a trailing slash

**File:** `apps/web/services/courses/chapters.ts:30`

```typescript
await fetch(`${getAPIUrl()}chapters/`, ...)
```

All other endpoints omit the trailing slash. FastAPI will issue a 307 redirect for POST requests to `chapters/` vs `chapters`. While this works in practice, it creates an unnecessary redirect round-trip and an inconsistency that can break in stricter HTTP clients or proxies that do not follow redirects for non-GET methods.

---

### 4.5 — `CourseContext` / `CourseStructure` types use wide `[key: string]: any` escape hatches

**File:** `apps/web/components/Contexts/CourseContext.tsx:15-43`

Both `Activity` and `Chapter` interfaces include `[key: string]: any`, removing TypeScript's ability to catch property typos or refactoring regressions across the entire course-editing UI.

---

### 4.6 — No backend length constraint on `Activity.name` / `Chapter.name`

Frontend schemas enforce `maxLength(200)` for chapter/activity names, but the SQLModel column is a plain `str` with no DB-level constraint. Direct API calls can store arbitrarily long strings, causing rendering issues in the curriculum editor.

---

Fix all the bugs, don't stop until you have fixed everything (fix the roots of the problems, don't just apply patches, fallbacks, etc.)
- Fully remove all legacy, deprecated, unused code, approaches, etc.
- Write migrations using uv run alembic revision
