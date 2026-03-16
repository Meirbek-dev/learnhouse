# Single-Org Simplification Plan

## Status

Implemented on 2026-03-16.

Final decisions applied:

- keep `/orgs/[orgslug]` as an internal Next.js implementation detail behind rewrites
- remove dead backend hosting flags and auth org callback parameters
- centralize the platform org slug in backend and frontend shared constants
- keep public URLs path-based, without orgslug query parameters or org-aware URL helpers

## Goal

Simplify the platform for the actual deployment model:

- one server
- one organization
- no tenant selection at runtime
- no configuration switches that imply optional multi-tenant behavior when the code already assumes a single default org

This plan is intentionally split into safe phases so dead configuration can be removed now without breaking routing, auth, or organization-scoped APIs.

## What Was Removed Safely Now

These settings were removed from backend config parsing and checked-in templates because they are no longer used at runtime:

- `PLATFORM_USE_DEFAULT_ORG`
- `PLATFORM_SELF_HOSTED`

Why this is safe:

- the only live references were in backend settings parsing in `apps/api/config/config.py`
- the only test references were in `apps/api/src/tests/config/test_config_settings.py`
- no runtime backend service or router behavior depends on either field
- leaving these variables in existing untracked runtime `.env` files does not break startup because backend settings already use `extra="ignore"`

## Current Reality Of The System

The system is already operating in single-org mode, but it is not yet structurally simplified.

Current behavior:

- the frontend rewrites most requests to `/orgs/openu/...` in `apps/web/proxy.ts`
- auth pages already hardcode `openu` in `apps/web/app/auth/layout.tsx`
- user creation and Google sign-in automatically attach users to the default `openu` org in backend services
- many frontend pages still carry an `orgslug` route param even though only one org is expected in production
- several backend APIs still expose org-by-slug patterns even when the slug is effectively constant

That means multi-tenancy is mostly gone in practice, but the shape of the codebase still reflects it.

## Safe Next Phase

These changes should be low risk and can be done next without changing the URL structure yet.

### 1. Centralize the single org identity

Create one shared source of truth for the default org slug instead of repeating `"openu"`.

Current hardcoded points include:

- `apps/web/services/config/config.ts`
- `apps/web/proxy.ts`
- `apps/web/app/auth/layout.tsx`
- `apps/api/src/services/users/users.py`
- `apps/api/src/services/auth/utils.py`
- `apps/api/cli.py`

Recommendation:

- introduce one backend constant for the default org slug
- introduce one frontend constant for the default org slug
- replace string literals first, before changing routes or APIs

### 2. Rename backend helpers to match real behavior

The backend still talks about a "default organization" as if it were optional.

Examples:

- `_get_default_organization()` in `apps/api/src/services/users/users.py`
- `ensure_user_in_default_org()` in `apps/api/src/services/users/users.py`

Recommendation:

- rename these toward `get_platform_org()` or `ensure_user_in_platform_org()`
- keep behavior identical
- update comments that still mention optional membership logic

### 3. Remove dead auth callback parameters

Some auth flows still pass `org_id` and `org_slug` around even though they are ignored or redundant.

Examples:

- login and signup callback URLs use `/redirect_from_auth?org_id=...&org_slug=...`
- Google sign-in keeps an unused `org_id` parameter in `signWithGoogle()`

Recommendation:

- stop emitting org query parameters in auth callbacks
- keep redirect target behavior unchanged
- remove ignored backend parameters only after frontend callers are updated

## Medium-Risk Structural Phase

These changes simplify the code more, but they affect app shape and should be done as a deliberate refactor with regression testing.

### 4. Collapse org-aware frontend utilities that no longer vary by org

Some helpers already ignore the org slug but still pretend to support it.

Examples:

- `getUriWithOrg(_orgslug, path)` in `apps/web/services/config/config.ts`
- `getAbsoluteUrl(pathOrOrgslug, path?)` still accepts an org argument shape it no longer uses

Recommendation:

- reduce these helpers to path-only APIs
- update call sites in one refactor pass
- keep backward-compatible wrappers briefly if needed

### 5. Simplify org context loading on auth routes

`apps/web/app/auth/layout.tsx` always loads `OrgProvider` with `openu`.

That works, but it means auth pages still behave as if the org were chosen dynamically.

Recommendation:

- create a platform-org provider path that does not depend on URL or cookie selection
- remove `current_orgslug` cookie dependence from auth-only flows when no longer needed

### 6. Review whether `/orgs/[orgslug]` should stay public API or become internal-only

Right now the entire Next.js app is structured around rewriting to `/orgs/[orgslug]`.

This is the biggest simplification opportunity, but also the highest regression risk.

Two valid options exist:

- keep `/orgs/[orgslug]` internally and accept that single-org mode is implemented through rewrites
- fully flatten routes so public pages live directly at non-org paths

Recommendation:

- do not flatten routes until the smaller cleanup above is complete
- if route flattening is chosen, treat it as a dedicated migration, not a quick cleanup

## Code Areas That Still Reflect Former Multi-Tenant Design

### Frontend routing and context

- `apps/web/proxy.ts`
- `apps/web/app/orgs/[orgslug]/...`
- `apps/web/components/Contexts/OrgContext.tsx`
- `apps/web/services/organizations/orgs.ts`

### Backend organization membership assumptions

- `apps/api/src/services/users/users.py`
- `apps/api/src/services/auth/utils.py`
- `apps/api/cli.py`

### Backend and frontend API surfaces using org slug

- `apps/api/src/routers/courses/courses.py`
- `apps/api/src/services/courses/courses.py`
- multiple web pages under `apps/web/app/orgs/[orgslug]/...`

These are not unused. They are the remaining implementation of single-org-via-orgslug, so they should not be removed blindly.

## What Not To Remove Yet

Do not remove the following until a dedicated refactor updates all call sites:

- `/orgs/[orgslug]` route segments
- `current_orgslug` cookie writes in middleware
- `OrgProvider` and org fetches by slug
- backend routes that resolve data by org slug
- `openu` bootstrap assumptions in install flows

Removing those pieces now would break page resolution, auth redirects, or organization-scoped queries.

## Recommended Order

1. Remove dead env/config flags.
2. Centralize the platform org slug constant.
3. Rename default-org helpers to platform-org helpers.
4. Remove unused auth org query parameters.
5. Simplify frontend URL helpers that no longer use org data.
6. Decide whether `/orgs/[orgslug]` remains an internal implementation detail or gets flattened.

## Verification Checklist For Each Follow-Up Refactor

- backend config still loads with current deployment env files
- login works
- signup works
- Google sign-in works
- `/redirect_from_auth` lands on the expected page
- public landing page renders
- dashboard pages render
- org-scoped course pages still resolve
- sitemap generation still works
- a newly created user is added to the platform org

## Summary

`PLATFORM_USE_DEFAULT_ORG` and `PLATFORM_SELF_HOSTED` were dead configuration and safe to remove now.

The single-org refactor is now applied. The app still uses `/orgs/[orgslug]` internally, but public navigation, auth redirects, platform-org selection, and backend membership logic no longer rely on multi-tenant env flags, auth org parameters, or public orgslug-based URL generation.
