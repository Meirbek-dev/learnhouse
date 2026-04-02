# Initial Contract Inventory

## Scope

Initial inventory of frontend-consumed backend route groups to support phased contract hardening and migration to generated TypeScript types.

## Summary Table

| Domain | Frontend Files | Backend Routers | Contract Quality | Priority | Notes |
| --- | --- | --- | --- | --- | --- |
| Auth and session | `apps/web/services/auth/auth.ts` | `apps/api/src/routers/auth.py`, `apps/api/src/routers/users.py` | Mixed explicit and implicit | High | Login and Google exchange already use DTOs; profile, refresh, and logout needed explicit response contracts. |
| Users | `apps/web/services/users/users.ts` | `apps/api/src/routers/users.py` | Mostly explicit | Medium | CRUD responses already use `UserRead`; some preference and reset flows still need cleanup over time. |
| Platform | `apps/web/services/platform/platform.ts` | `apps/api/src/routers/platform.py` | Mixed | High | Landing and member-management responses need stronger response contracts. |
| Gamification | `apps/web/services/gamification/server.ts` | `apps/api/src/routers/gamification.py` | Mostly explicit | High | Dashboard and leaderboard models exist; this is a good first migration slice. |
| Analytics | `apps/web/services/analytics/teacher.ts` | `apps/api/src/routers/analytics.py` | Mostly explicit | High | Good DTO coverage already exists; suitable for early generated-type adoption. |
| Courses and chapters | `apps/web/services/courses/*.ts` | `apps/api/src/routers/courses/**/*.py` | Mixed | High | High-value domain with larger migration surface and header-based pagination patterns. |
| Activities and grading | `apps/web/services/courses/activities.ts`, `apps/web/services/grading/grading.ts` | `apps/api/src/routers/courses/activities/**/*.py`, grading routers | Mixed | High | Some areas are explicit, but transport types are still largely handwritten in the web app. |
| Code challenges | `apps/web/services/courses/code-challenges.ts` | `apps/api/src/routers/courses/code_challenges.py` | Strong explicit coverage | Medium | Strong DTO coverage makes this a good follow-up slice after the first contract foundation lands. |
| Uploads and blocks | `apps/web/services/utils/chunked-upload.ts`, `apps/web/services/blocks/**/*` | `apps/api/src/routers/uploads/chunked_upload.py`, block routers | Mixed | Medium | Chunked uploads are structured; block upload responses still need named DTOs. |
| Search | `apps/web/services/search/search.ts` | `apps/api/src/routers/search.py` | Mostly explicit | Low | Small domain and lower drift risk. |
| Payments | `apps/web/services/payments/*.ts` | `apps/api/src/routers/ee/payments.py` | Mixed | High | High business risk; should follow once the contract tooling path is stable. |
| AI streaming | `apps/web/services/ai/ai-streaming.ts` | `apps/api/src/routers/ai/ai.py` | Implicit streaming contract | High | SSE message format is not yet represented by generated contracts and needs separate treatment. |

## Immediate Backlog

1. Finish explicit response models for the auth/session and gamification slice.
2. Generate and commit `apps/api/openapi.json`.
3. Generate and commit `apps/web/lib/api/generated/schema.ts`.
4. Migrate initial frontend consumers to import generated transport types instead of handwritten interfaces.
5. Add contract freshness checks to CI.
