# Frontend RBAC Production Readiness Plan

Date: 2026-02-22
Scope: `apps/web` RBAC-related frontend authorization (client guards, server route guards, navigation gating, permissions typing/usage, and duplicate RBAC UIs)

## 1) Current-State Assessment (Verified)

### What is already good

- There is a centralized RBAC model (`types/permissions.ts`) with typed constants and a canonical `perm()` helper.
- Server-side route protection exists and is widely used (`requireAuth`, `requirePermission`, `requireAnyPermission`).
- Client-side permission checks are centralized via `PermissionProvider` and `PermissionGuard`.
- Session/org stale-permission checks exist in server auth helpers.

### High-risk issues to fix first

1. **Navigation vs route-guard misalignment (user-visible authorization inconsistency)**
   - `useNavigationPermissions` does not mirror server guard matrices in multiple sections.
   - Concrete mismatches:
     - **Courses**: server allows `COURSE:MANAGE:ORG`, nav does not.
     - **Admin**: server allows organization own-level management/update paths, nav may hide admin entry for those users.
     - **Payments**: server allows org-own managers, nav currently only checks `PAYMENT:MANAGE:ORG`.
   - Impact: users can access pages by URL but do not see menu entries (false negatives), causing confusion and support load.

2. **Legacy compatibility mode in `can()` introduces complexity and inconsistency**
   - `can()` currently accepts both `(resource, action, scope)` and `(action, resource, scope)`.
   - This has enabled mixed call styles across the codebase.
   - Impact: harder review/debugging, higher chance of future mistakes, and non-obvious API behavior.

3. **Duplicate RBAC management surfaces (new + legacy) increase drift risk**
   - New admin RBAC pages exist under `app/orgs/[orgslug]/dash/admin/...`.
   - Legacy role/user-role management still exists in `components/Dashboard/Pages/Users/...` and is wired into `dash/users/settings/[subpage]`. REMOVE IT
   - Impact: duplicated business logic, duplicated permission checks, and divergent UX/behavior.

### Medium-risk issues

1. **Inconsistent import paths for security primitives**
   - Mixed barrel imports (`@/components/Security`) and direct file imports (`@components/Security/PermissionGuard`, `@/components/Security/PermissionProvider`).
   - Impact: weakens architectural boundaries and increases accidental coupling.

2. **Permission matrix duplication across UI areas**
   - Similar permission combinations are manually repeated in sidebar, mobile menu, header, and several pages.
   - Impact: drift over time and subtle inconsistencies.

---

## 2) Target End-State

- One canonical permission check call signature.
- One canonical source of feature-level permission matrices.
- Navigation visibility exactly mirrors server route authorization.
- No duplicated role-management surfaces.
- RBAC-critical code is strongly typed (no `any` around permission primitives).
- Automated checks prevent regression.

---

## 3) Phased Execution Plan

## Phase P0 — Stabilize and Guardrail (1-2 days)

### Tasks

- Freeze RBAC behavior changes to one branch/owner during migration.
- Add a short ADR documenting canonical RBAC frontend rules:
  - check order,
  - route guard precedence,
  - backend `can_*` vs frontend `can()` responsibilities,
  - where permission matrices live.

---

## Phase P1 — Permission Matrix Alignment (Critical)

### Tasks

1. Create a single shared matrix module, e.g. `apps/web/lib/rbac/navigation-policy.ts`:
   - `canSeeCourses(sessionPerms)`
   - `canSeeUsers(...)`
   - `canSeeAdmin(...)`
   - `canSeePayments(...)`
   - optional route-level helpers for parity checks.
2. Refactor these to consume shared policy:
   - `hooks/useNavigationPermissions.ts`
   - `components/Dashboard/Menus/DashSidebar.tsx`
   - `components/Dashboard/Menus/DashMobileMenu.tsx`
   - `components/Security/HeaderProfileBox.tsx` (dashboard access signal)
3. Align policy exactly with server guards in:
   - `app/orgs/[orgslug]/dash/*/layout.tsx`
   - `lib/server-auth.ts` usage expectations.

### Acceptance criteria

- No known false-negative nav items for users with valid route access.

---

## Phase P2 — Remove Legacy `can()` Compatibility and Standardize API

### Tasks

1. Pick canonical call style: **`can(action, resource, scope)`** (recommended).
2. Codemod all call sites to canonical style.
3. Simplify `PermissionProvider.can` signature to one strict overload.
4. Add lint rule (custom or restricted-syntax) to block non-canonical ordering.
5. Update docs/examples and `PermissionGuard` internals to canonical ordering.

### Acceptance criteria

- No mixed-order `can()` calls remain.
- `PermissionProvider` no longer has dual-order backward compatibility.
- Lint enforces style permanently.

---

## Phase P3 — Consolidate Duplicate RBAC Management UI

### Tasks

1. Choose one canonical RBAC management surface:
   - keep `dash/admin/roles` + `dash/admin/users` as source of truth.
2. Deprecate/remove duplicate legacy role pages under:
   - `components/Dashboard/Pages/Users/OrgRoles/OrgRoles.tsx`
   - related role modals only used by legacy path, if superseded.
3. Decide whether `dash/users/settings/roles` should:
   - redirect to admin roles page, or
   - render the same canonical component (not a fork).
4. Remove duplicate permission logic and duplicate role CRUD code paths.

### Acceptance criteria

- Single implementation for role CRUD and role assignment remains.
- No parallel legacy RBAC UI paths remain in active routing.

---

## Phase P4 — Type Hardening and Reliability Cleanup (3-5 days, can overlap)

### Tasks

1. Strengthen permission types:
   - ensure all role/permission payloads use shared types from `types/permissions.ts`.
2. Remove direct security-file imports in app code; use barrel exports only.

### Acceptance criteria

- RBAC-critical paths are free of `any` casts.
- Security imports are standardized.

---

## 4) Proposed Task Backlog (Prioritized)

### Immediate backlog (next sprint)

1. Build shared navigation policy module.
2. Align nav checks with server guards (courses/admin/payments first).
3. Add nav↔route parity tests.
4. Standardize `can()` call order via codemod.
5. Remove dual-order `can()` compatibility.

### Follow-up backlog

1. Merge admin/legacy role management into one surface.
2. Route legacy pages to canonical pages.
3. Eliminate RBAC-critical `as any` usage.
4. Add lint guard against non-canonical RBAC imports/order.

---

## 6) Definition of Done (Production Ready)

Frontend RBAC is production-ready when all are true:

- Navigation and route guards are behaviorally aligned.
- `can()` has one strict signature and consistent usage.
- No active duplicate RBAC management implementations.
- RBAC-critical code paths are strongly typed.

---

## 7) Suggested Ownership

- **Auth/RBAC core**: `components/Security/*`, `lib/server-auth.ts`, `types/permissions.ts`
- **Navigation alignment**: `hooks/useNavigationPermissions.ts`, sidebar/mobile/header consumers
- **Admin UX consolidation**: `app/orgs/[orgslug]/dash/admin/*`, `dash/users/settings/*`
- **Quality gates**: lint/typecheck/test configuration in `apps/web`

This plan intentionally prioritizes correctness/alignment first, then simplification, then deeper type hardening to reduce production risk quickly while converging on a maintainable RBAC frontend architecture.
