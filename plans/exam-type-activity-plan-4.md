# Replace the modal/dialog add flow with an inline "Add question" button

- Goal: Replace the modal/dialog add flow with an inline "Add question" button placed at the bottom of the last question card that opens an inline form (no modal). This improves UX by avoiding modal context switching and simplifies editing flow.
- Next step: Extract `QuestionEditor` to a reusable component.

## High-level steps 🔧

1. Design inline add flow (in-progress)
   - Decide UX details: placement (after last question card), open/close animation, autofocus, keyboard accessibility, mobile behavior.
   - Acceptance: focus moves to first field; page scrolls to make editor visible; works on small screens.

2. Extract `QuestionEditor` into reusable component (not-started)
   - New file: `apps/web/components/Activities/ExamActivity/QuestionEditor.tsx`
   - Props: `question`, `examUuid`, `accessToken`, `onSave`, `onCancel`, optional `compact`/`inline` mode.
   - Remove Dialog-specific markup from the editor.

3. Replace dialog trigger with inline add button (not-started)
   - Remove `DialogTrigger` & modal-only add flow.
   - Add a button rendered after the last question (or in empty-state) that inserts the inline `QuestionEditor` with `order_index = questions.length`.
   - Behavior: clicking -> renders inline form; clicking cancel -> removes it.

4. Implement save/cancel & backend integration (not-started)
   - Save posts to `/exams/:examUuid/questions` and sets correct `order_index`.
   - On success, close inline editor and call `onQuestionsChange()`.
   - Show proper toast messages and handle errors.

5. Ensure drag/drop and ordering still work (not-started)
   - Test adding while DnD is enabled; ensure `order_index` updates and no conflicts.

6. Translations & copy (not-started)
   - Add key if needed (e.g., `addNewQuestionInline`) and update locale files.

### Acceptance criteria ✅

- Inline add button appears at bottom of question list (and in empty state).
- Clicking opens an inline form; first input is focused and visible.
- Saving creates the question with correct `order_index` and closes the form; `onQuestionsChange` fires.
- Cancel removes the inline form.
- Drag-and-drop and reordering work with newly added questions.
