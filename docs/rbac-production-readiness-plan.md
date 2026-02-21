# RBAC Production Readiness Plan

> Analysis date: 2026-02-21
> Branch: `rbac-rewrite`
> Status: System is architecturally sound. Several targeted fixes and cleanups are required before production.

---

## Executive Summary

The RBAC system has a solid foundation: a single YAML source of truth, auto-generated frontend types, a structured `PermissionChecker` class, proper scope-hierarchy resolution, and privilege-escalation prevention. What remains are **one high-severity bug**, **several dead-code artifacts**, **two type-safety gaps**, and **one session-cache collision** that must all be resolved before production.

---

## Critical Issues (Must Fix)

### 1. Collection ownership check always returns `false`

**File:** `apps/api/src/services/courses/collections.py:98`

```python
# BUG – attribute does not exist, evaluates to False
is_owner = hasattr(collection, "created_by") and collection.created_by == current_user.id

# FIX
is_owner = current_user.id is not None and collection.creator_id == current_user.id
```

The `Collection` model uses `creator_id`, not `created_by`. The `hasattr` guard silently makes `is_owner` always `False`, so owners can never see their own edit/delete controls on the collection detail page.

Also remove the now-redundant `is_creator=is_owner` alias on the same return statement (line 107) – the response model should carry a single canonical field.

---

### 2. Anonymous session cache collision

**File:** `apps/web/auth.ts:66-68`

```typescript
// BUG – every anonymous visitor shares one cache entry
const createCacheKey = (accessToken: string): string => {
  if (!accessToken) return 'user_session_anonymous';
  ...
};
```

All unauthenticated requests hash to the same key. When the cache is warm, user A (anonymous) returning to the site receives user B's stale session data.

**Fix:** Do not cache sessions that have no access token. Return `null` and skip the cache read/write path entirely for anonymous requests.

---

## Dead Code — Remove

### 3. `invite` action is undeclared in YAML but used in permissions

**Files:**

- `shared/permissions.yaml` — `actions` list (lines 7-18): `invite` is **absent**
- `shared/permissions.yaml:73` — org-admin: `"user:invite:org"` references the undeclared action
- `apps/web/types/permissions.ts:23` — `INVITE: 'invite'` present in auto-generated file (implies sync script added it manually or the file diverged)
- Migration `c72beef2c40e` explicitly **drops** the `user:invite` permission from the DB

Two contradictory states exist simultaneously: the YAML uses the action in a role definition but does not declare it as a valid action; the migration has already removed it from the database.

**Fix:**

1. Remove `"user:invite:org"` from the org-admin permissions block in `permissions.yaml`.
2. Remove `INVITE: 'invite'` from `apps/web/types/permissions.ts` (or regenerate after step 1).
3. Do not add `invite` to the actions list — the feature is unimplemented.

---

### 4. `can_publish` field is always `false`

**Files:**

- `apps/api/src/db/courses/enhanced_responses.py:28,54` — `can_publish: bool = PydanticField(default=False)`
- No code in `apps/api/src/` ever calls `checker.check(..., "course:publish", ...)`.
- `publish` is not a declared action in `permissions.yaml`.
- `apps/web/components/Objects/Thumbnails/CourseThumbnail.tsx:78` — field declared as optional on the interface.

**Fix:** Remove `can_publish` from `enhanced_responses.py` and from the frontend `Course` interface. If course publishing is a planned feature, it should be designed and implemented as a new, complete unit — not left as a silent no-op.

---

### 5. `available_actions` string array is unused noise

**Files:**

- `apps/api/src/services/courses/collections.py:108-110` — computed and returned.
- `apps/web/components/Objects/Thumbnails/CollectionThumbnail.tsx:47` and `CourseThumbnail.tsx:389` — read into a local variable that is never used in rendered output.

**Fix:** Remove the `available_actions` field from response models and service return values. The individual `can_update`/`can_delete` booleans already carry the same information in a more explicit, type-safe form.

---

### 6. `is_contributor` field on courses is never consumed

**File:** `apps/web/components/Objects/Thumbnails/CourseThumbnail.tsx:81`

The field is declared on the interface but there is no render path or logic that branches on it.

**Fix:** Remove it from the interface. Remove it from any backend response model that computes and returns it, unless there is an active feature referencing it.

---

## Type Safety Gaps — Fix

### 7. `permissions_org_id` is untyped on the NextAuth session

**File:** `apps/web/components/Security/PermissionProvider.tsx:55`

```typescript
// BAD – bypasses type checking
return (session as any)?.permissions_org_id ?? null;
```

`permissions`, `permissions_org_id`, and `roles` are added to the JWT/session in `auth.ts` but there is no `declare module 'next-auth'` augmentation file. Multiple files across the app define local `interface Session` blocks as a workaround.

**Fix:** Add a single `next-auth.d.ts` (or `types/next-auth.d.ts`) with the official module augmentation:

```typescript
import type { Role } from '@/types/permissions';

declare module 'next-auth' {
  interface Session {
    permissions: string[];
    permissions_org_id: number | null;
    roles: Array<{ org: { id: number; slug: string } }>;
    access_token: string;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    permissions: string[];
    permissions_org_id: number | null;
    roles: Array<{ org: { id: number; slug: string } }>;
    access_token: string;
    refresh_token: string;
    expires_at: number;
  }
}
```

Once this exists:

- Remove every local `interface Session` block across individual page/component files.
- Remove the `as any` cast in `PermissionProvider.tsx`.
- The TypeScript compiler will catch mismatches automatically.

---

### 8. `available_actions` is typed as `string[]` instead of `Action[]`

**File:** `apps/web/components/Objects/Thumbnails/CourseThumbnail.tsx:82`

Moot once item 5 above is resolved. If `available_actions` is kept for any reason, the type must be changed to `Action[]`.

---

## Consistency — Align

### 9. `sessionCan()` and `usePermissions().can()` are redundant

**Files:**

- `apps/web/lib/server-auth.ts:32-41` — `sessionCan()` for server components
- `apps/web/components/Security/PermissionProvider.tsx:58-63` — `can()` in context for client components

Both do `permissions.has(perm(resource, action, scope))`. This is intentional (server vs. client path), but `sessionCan` builds a new `Set` on every call when called outside `requirePermission`.

**Fix:** In `server-auth.ts`, have `requirePermission` and `requireAnyPermission` build the `Set` once and pass it to `sessionCan` (this already happens via the optional `permsSet` parameter — verify it is always used from those call sites).

---

### 10. YAML `actions` list and org-admin role must be internally consistent

As noted in item 3, `user:invite:org` uses an undeclared action. After removing that line, audit the full YAML to verify:

- Every permission used in any role's `permissions` list uses only actions from the top-level `actions` array.
- Add a CI check (a small Python or shell script) that parses the YAML and validates this invariant on every push.

---

### 11. Script referenced in `permissions.ts` does not exist

**File:** `apps/web/types/permissions.ts:2`

```
// Run: python scripts/sync-permissions.py
```

No such file exists in the repo (`scripts/sync-permissions.py` returns no results). Either:

- Create the sync script so the comment is truthful, or
- Update the comment to accurately describe the current process.

The auto-generated file comment creates a false sense of automation that doesn't exist.

---


## Implementation Order

1. **Fix `collections.py` ownership bug** — one-line change, high impact.
2. **Fix anonymous session cache collision** — prevents data leakage risk.
3. **Add `next-auth.d.ts` module augmentation** — removes `as any` casts and enables compiler to catch subsequent regressions.
4. **Remove dead RBAC fields** — `can_publish`, `available_actions`, `is_contributor` from both backend response models and frontend interfaces.
5. **Clean up `invite` action** — remove from YAML org-admin block and regenerate/fix `permissions.ts`.
6. **Remove local `interface Session` declarations** in individual page files now that the module augmentation is in place.
7. **Add row-level permission tests** — cover the ownership bug as a regression test.
8. **Add privilege escalation tests** — cover the priority guard.
9. **Create YAML consistency CI check** — validates actions used in role definitions are declared in the `actions` list.
10. **Create or document the sync script** — make the comment in `permissions.ts` accurate.

---

## Non-Issues (Confirmed Correct)

The following were examined and require no changes:

- **Scope hierarchy resolution** (`_resolve()` in `rbac.py`) — correctly checks `all → org → assigned → own` in order.
- **Wildcard expansion** — `*:*:*`, `course:*:org`, `*:read:all` all resolve correctly.
- **Privilege escalation prevention** — logic is present and correct, just untested.
- **Session caching TTL** — 1-minute TTL with LRU eviction at 1000 entries is appropriate.
- **API endpoint protection** — all RBAC and Roles router endpoints verify permissions before executing.
- **`requirePermission` org-scope validation** — correctly detects and rejects stale cross-org sessions.
- **Error response structure** — `PermissionDenied`, `AuthenticationRequired`, `FeatureDisabled`, `ResourceAccessDenied` are distinct, structured, and use correct HTTP status codes.
- **Backend enums** — `StrEnum` usage is idiomatic and consistent throughout.
- **Token refresh logic** — 2-minute pre-expiry refresh buffer with safe fallback is sound.
