# Goal: Make the exam activity faster, clearer, more accessible, and safer (anti-cheating UX) for students while improving teacher management & reporting

---

## High-level phases (short & actionable) 🔁

4. **Anti-cheat / fairness UX** ⚖️
   - Friendly violation warnings, clear counts & user guidance, configurable thresholds, debounce to
     avoid false positives (`useTestGuard`).
   - Show consequence and appeal guidance in UI.

5. **Question editing & import/export** 🧾
   - Safer CSV import (preview + validation), bulk edit, inline editing improvements
     (`QuestionEditor`, `QuestionManagement`).
   - Export improvements (CSV with stable columns, teacher export endpoints).

6. **Management & results dashboard** 📊
   - `ExamResultsDashboard`: better filters, sortable columns, per-attempt modals, pagination & CSV
     exports.
   - `WhitelistManagement`: select all, bulk save UX, search/pagination.

7. **Exam settings & teacher tools** 🎛️
   - Re-group settings (safety vs review), inline help/tooltip, preview-as-student toggle
     (`ExamSettings`).

---
