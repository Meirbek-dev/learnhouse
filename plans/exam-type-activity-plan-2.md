# Summary of missing features (✅ implemented vs ⚠️ missing)

- ✅ Exam DB model, migrations, CRUD, questions, attempts, CSV import/export, RBAC checks,
  auto-grading, violation recording.
- ✅ Frontend: Exam settings form, question management UI, whitelist management, pre-screen, taking
  UI, results and teacher dashboard, anti-cheat hook `useTestGuard`.
- ⚠️ Missing / incomplete items (from the plan):
  1. **Fullscreen enforcement** — No request to enter fullscreen and no detection/violation handling
     for fullscreen exit. 🔧
  2. **Right-click (context menu) enforcement** — Setting exists, but not passed to `useTestGuard` /
     not enforced when `right_click_disable` enabled. 🔧
  3. **Shuffle answers must be always ON and non-configurable** — Currently present in model and UI
     as a configurable setting; server doesn't enforce it. ⚠️
  4. **Frontend UX & prompts for fullscreen / blocked fullscreen / anti-cheat limitations** — Needs
     user-friendly prompts and localized strings. 💡
  5. **Consistency of defaults** — Some defaults diverge between model (defaults false) and UI (form
     defaults true); tighten them to avoid surprise behavior. ⚠️

---

## Implementation plan (step-by-step) 🔧✨

Priority order, short tasks, acceptance criteria and file pointers. (I created these as TODOs and
set the top task to in-progress.)

1. Enforce shuffle-answers always ON (priority: high) ✅ (in-progress)
   - Backend: Add a validator in `apps/api/src/db/courses/exams.py::ExamSettingsBase` to force
     `shuffle_answers=True` (ignore incoming false).
   - Frontend: Remove or disable the `shuffle_answers` toggle in:
     - ExamSettings.tsx
     - ExamActivityModal.tsx

2. Add right‑click/context menu enforcement (priority: medium)
   - Update `useTestGuard` hook to accept `preventContextMenu` / `rightClickDisable` and call
     `report('CONTEXTMENU')` when relevant.
   - Pass the setting from `ExamTakingInterface` (`settings.right_click_disable`).
   - Add small UI feedback when a right-click is blocked.
   - Tests: Unit test to ensure contextmenu events are prevented and a violation callback is fired.

3. Implement fullscreen enforcement and detection (priority: high)
   - Client: In `ExamPreScreen` or `ExamTakingInterface`:
     - Prompt user to enter fullscreen if `settings.fullscreen_enforcement` is true, request
       fullscreen on exam container before starting.
     - Listen to `fullscreenchange` events; on exit, call the same violation path used by
       `useTestGuard` (server `record_violation`) and act on threshold (auto-submit).
     - Handle browsers that disallow fullscreen: show friendly prompt and fallback (allow attempt or
       block based on policy).
   - Tests: Unit tests for handlers and an integration test to assert exit triggers
     `record_violation` and auto-submit when threshold reached.

4. Server-side validation & tests for violation auto-submit and access rules (priority: high)
   - Add tests that call `record_violation` repeatedly and assert attempt becomes `AUTO_SUBMITTED`
     when threshold is hit.
   - Add tests for `start_exam_attempt` to validate `access_mode` (NO_ACCESS, WHITELIST,
     ALL_ENROLLED) and attempt limits.

5. Frontend UX & localization (priority: medium)
   - Add translations (EN, KK, RU) for:
     - "Please enter fullscreen to start the exam"
     - "Fullscreen exited — violation recorded"
     - "Right-click is disabled"
     - Clarify DevTools detection limitations
   - Update Pre-Screen and Taking UI to show the messages when relevant.
