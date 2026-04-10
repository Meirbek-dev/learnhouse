# 🧠 TanStack Query Refactor Plan — From Raw Fetches → Production Architecture

You are a staff-level frontend engineer specializing in **TanStack Query v5+**.

The current codebase relies on **ad-hoc `fetch` calls inside components and hooks**, resulting in duplicated logic, poor caching, and inconsistent data flow.

Your task is to **fully migrate the data layer to an idiomatic, production-grade TanStack Query architecture**, enforcing strict patterns and eliminating all anti-patterns.

---

# 🚨 Current Problems (MUST FIX ALL)

You will encounter:

* ❌ `fetch` calls directly inside React components
* ❌ Data fetching inside `useEffect`
* ❌ Manual loading/error state handling
* ❌ No caching or deduplication
* ❌ Repeated API logic across components
* ❌ Inconsistent or missing typing
* ❌ Mutations handled imperatively without cache sync
* ❌ No centralized query key system
* ❌ No separation between API layer and UI
* ❌ Race conditions & stale data issues

---

# 🎯 End State (NON-NEGOTIABLE)

The final codebase MUST:

* Use **TanStack Query exclusively for all async server state**
* Have **zero direct fetches inside components**
* Use **`queryOptions()` / `mutationOptions()` everywhere**
* Have **100% deterministic, structured query keys**
* Follow **feature-based architecture**
* Be **fully type-safe (no `any`)**
* Have **colocated API + query + hook layers**
* Provide **automatic caching, invalidation, and deduplication**
* Eliminate **manual loading/error state logic**

---

# ⚙️ MANDATORY PATTERNS

## 1. Extract ALL API Calls

❌ FORBIDDEN (except really exceptional cases where it's needed):

```ts
useEffect(() => {
  fetch('/api/courses').then(setCourses)
}, [])
```

✅ REQUIRED:

```ts
// features/courses/api/getCourses.ts
export async function getCourses(): Promise<Course[]> {
  const res = await fetch('/api/courses')
  return res.json()
}
```

---

## 2. ALWAYS use `queryOptions()`

❌ FORBIDDEN:

```ts
useQuery({
  queryKey: ['courses'],
  queryFn: getCourses
})
```

✅ REQUIRED:

```ts
// features/courses/queries/getCourses.query.ts
export const getCoursesQuery = () =>
  queryOptions({
    queryKey: queryKeys.courses.all,
    queryFn: getCourses,
  })
```

---

## 3. ALWAYS wrap with custom hooks

```ts
// features/courses/hooks/useCourses.ts
export function useCourses() {
  return useQuery(getCoursesQuery())
}
```

🚫 NEVER call `useQuery` directly in components.

---

## 4. FIX parameter handling (CRITICAL)

Every variable used in `queryFn` MUST be in `queryKey`.

❌ BAD:

```ts
queryFn: () => getCourses(params)
```

✅ GOOD:

```ts
export const getCoursesQuery = (params: CoursesParams) =>
  queryOptions({
    queryKey: queryKeys.courses.list(params),
    queryFn: () => getCourses(params),
  })
```

---

## 5. Introduce Query Key Factory (MANDATORY)

```ts
// lib/react-query/queryKeys.ts
export const queryKeys = {
  courses: {
    all: ['courses'] as const,
    list: (params: CoursesParams) =>
      ['courses', { params }] as const,
    detail: (id: string) =>
      ['courses', { id }] as const,
  },
}
```

🚫 NO raw string keys anywhere in the app.

---

## 6. Mutation Refactor

❌ FORBIDDEN:

```ts
async function handleCreate() {
  await fetch('/api/courses', { method: 'POST' })
}
```

✅ REQUIRED:

```ts
// features/courses/mutations/createCourse.mutation.ts
export const createCourseMutation = () =>
  mutationOptions({
    mutationFn: createCourse,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.courses.all,
      })
    },
  })
```

Hook:

```ts
export function useCreateCourse() {
  return useMutation(createCourseMutation())
}
```

---

## 7. REMOVE ALL `useEffect` DATA FETCHING

🚫 Any `useEffect` used for fetching server data must be deleted.

Replace with React Query.

---

## 8. CENTRALIZE SERVER STATE

All server state must:

* Live in React Query cache
* Not be duplicated in `useState`
* Not be manually synchronized

---

## 9. DEDUPLICATE DATA LOGIC

If multiple components fetch the same data:

→ ONE shared queryOptions definition

---

## 10. CACHE & INVALIDATION STRATEGY

* Use default caching unless necessary
* Always invalidate via **queryKeys**
* Never hardcode keys

---

## 11. TYPE SAFETY

* Types inferred from API layer
* No `any`
* Avoid manual generics unless required

---

## 12. NO INLINE FUNCTIONS IN COMPONENTS

🚫 FORBIDDEN:

```ts
useQuery({
  queryKey: ['courses'],
  queryFn: () => fetch(...)
})
```

Everything must be extracted and reusable.

---

# 🧪 LINTING (MUST PASS)

Enforce:

* `@tanstack/query/prefer-query-options`
* `@tanstack/query/exhaustive-deps`

Result:

* ✅ ZERO warnings
* ✅ ZERO errors

---

# 🔍 EXECUTION STRATEGY

1. Scan entire repo for:

   * `fetch(`
   * `useEffect(`

2. Identify all server state usage

3. Refactor feature-by-feature:

   **Component → API → Query → Hook**

4. Replace component logic with hooks

5. Introduce query key factory

6. Refactor mutations with invalidation

7. Remove all manual state handling

8. Run ESLint and fix ALL issues

---

# 🚀 FINAL DELIVERABLES

* Fully refactored codebase using TanStack Query
* Zero direct fetches in client components
* Zero `useEffect` data fetching
* Zero lint errors
* Clean, scalable architecture
* Idiomatic TanStack Query v5 usage

### Summary must include

* What anti-patterns existed
* What was refactored
* Query key design decisions
* Cache & invalidation strategy
* Improvements in DX and performance

---

# ⚠️ STRICT RULES

* Do NOT leave partial migrations
* Do NOT touch server components
* Do NOT keep legacy fetch patterns
* Do NOT silence lint rules
* Do NOT duplicate query logic
* Do NOT prioritize speed over correctness

---

Your goal is **“best-in-class server state architecture”**, not “it works”.

Refactor until it would pass a **staff-level review at a top-tier company**.
