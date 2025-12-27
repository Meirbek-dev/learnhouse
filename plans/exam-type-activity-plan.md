# Exam Activity — Implementation Plan

## Status: ✅ IMPLEMENTED (Dec 27, 2025)

All planned features have been implemented. See [exam-implementation-notes.md](exam-implementation-notes.md) for details.

## Overview

Add a secure, configurable exam/test activity type to the LMS. This feature allows teachers to
create question banks, configure exam parameters, control student access, and review results.
Students take exams under optional anti-cheating measures and can review results if permitted.

## Implementation Status

### ✅ Completed Features

- Exam CRUD operations (create, read, update, delete)
- Question bank management with all 4 question types (SINGLE_CHOICE, MULTIPLE_CHOICE, TRUE_FALSE, MATCHING)
- CSV import/export for questions
- Attempt lifecycle (start, submit, auto-submit on time/violations)
- Violation recording with structured logging
- Access control (NO_ACCESS, WHITELIST, ALL_ENROLLED)
- Anti-cheat enforcement (copy-paste, tab-switch, DevTools, right-click, fullscreen)
- Teacher results dashboard with statistics
- Student results review (when allowed by settings)
- RBAC checks for all operations
- **Shuffle answers always enforced** (non-configurable, server-validated)
- **Right-click/context menu enforcement** (granular control)
- **Fullscreen enforcement and detection** (with browser compatibility handling)
- **Localization** (EN, KK, RU) for all new messages

### 📝 Test Coverage

- Test scaffold created in `apps/api/src/tests/test_exams.py`
- Recommended tests documented in implementation notes

---

## Technical implementation details

- Prefer doing stuff on the server (for better security and robustness)\
- Use shadcn-ui components
- Prefer early returns and notify if something goes wrong
- Fully localize using next-intl

---

## Phase 1: Exam Entity & Configuration Module

### 1.1 Exam Creation Flow

- Teacher navigates to course → Activities → Add Activity → Select "Exam"
- Exam has a **title**, **description**, settings and **associated question bank**
- Exam exists in **draft** state until explicitly published

### 1.2 Exam Settings (Teacher Configurable)

Create a settings panel with the following toggleable/configurable options:

### Time & Attempts

- **Time Limit**: Optional. If enabled, teacher sets duration in minutes. Null means unlimited.
- **Attempt Limit**: Optional. If enabled, teacher sets max attempts (1, 2, 3, unlimited). Default:
  1 attempt.

### Question Behavior

- **Shuffle Questions**: Toggle (default ON). When ON, question order is randomized per student per
  attempt.
- **Shuffle Answers**: Always ON and non-configurable. All multiple-choice answers are randomized.
- **Question Limit**: Optional. Teacher sets how many questions to pull from the bank (e.g., "Show
  30 of 100 questions"). If null, all questions are shown.

### Access Control

- **Access Mode**: Default is "No Access". Options:
  - No Access (no enrolled student can see or start the exam)
  - Manual Access (teacher selects specific students, by clicking on a switch)
  - All Enrolled (all enrolled students can access)
- Teacher can toggle access on/off at any time

### Result Visibility

- **Allow Result Review**: Toggle (default ON). If ON, students can see their submitted answers vs
  correct answers after completion.
- **Show Correct Answers**: Sub-toggle under result review. If OFF, students see their answers
  marked right/wrong but not the correct answer.

### Anti-Cheating / Violation Detection

Each is an independent toggle (all default OFF):

- **Copy-Paste Protection**: Disable copy/cut/paste inside exam area
- **Tab/Window Switch Detection**: Log and optionally block when student leaves the exam tab
- **DevTools Detection**: Detect if browser DevTools are opened
- **Right-Click Disable**: Prevent context menu
- **Fullscreen Enforcement**: Require fullscreen mode during exam
- **Violation Threshold**: If violation detection is ON, set max allowed violations before
  auto-submit (e.g., 3 tab switches = auto-submit)

---

## Phase 2: Question Bank Module

### 2.1 Question Bank Management

- Each exam has its own **question bank** (1:1 relationship)
- Teacher can add, edit, delete, reorder questions within the bank
- Supported question types (start with these, extensible later):
  - **Single Choice** (radio buttons)
  - **Multiple Choice** (checkboxes, partial scoring optional)
  - **True/False**
  - Matching (like left to right)

### 2.2 Question Structure

Each question contains:

- Question text (supports rich text/markdown)
- Question type
- List of answer options
- Correct answer(s) marked
- Points value (default 1, teacher can adjust)
- Optional explanation (shown in review if enabled)

### 2.3 Bulk Operations

- Import and export questions in CSV format
- Duplicate question bank from another exam
- Bulk delete selected questions

---

## Phase 3: Student Exam Experience

### 3.1 Pre-Exam Screen

Before starting, student sees an **Exam Information Card** with:

- Exam title and description
- Number of questions they will receive
- Time limit (or "Unlimited" if none)
- Remaining attempts (e.g., "Attempt 1 of 3" or "Unlimited attempts")
- Active protection measures displayed as badges/chips:
  - "Copy-paste disabled"
  - "Tab switching monitored"
  - "DevTools detection active"
  - "Fullscreen required"
- **Start Exam** button (disabled if no access or attempts exhausted)

### 3.2 Active Exam Screen

- **Timer**: Visible countdown if time limit is set. Show "Time Remaining: MM:SS"
- **Progress Indicator**: "Question 5 of 30"
- **Question Display**: One question at a time or all at once (make this a setting for Phase 2)
- **Navigation**: Previous/Next buttons, question number grid for jumping
- **Answer Selection**: Radio for single choice, checkboxes for multiple choice
- **Submit Button**: Final submission with confirmation modal
- **Auto-Submit Triggers**:
  - Timer reaches zero
  - Violation threshold exceeded (if configured)

### 3.3 Violation Handling

- On each violation event, increment violation counter
- Show warning alert-dialog: "Warning: Tab switch detected (2/3)"
- Log violation with timestamp and type (should also be displayed in review)
- If threshold exceeded and auto-submit enabled → force submit with flag

### 3.4 Submission Flow

- On submit: lock all answers, stop timer, record end timestamp
- Show confirmation: "Your exam has been submitted"
- If result review is disabled: "Your results will be available after teacher review"
- If result review is enabled: Show "View Results" button

### 3.5 Result Review Screen (If Allowed)

- Summary card: Score (e.g., "24/30 correct — 80%"), time taken
- List of questions with:
  - Question text
  - Student's selected answer(s) — highlighted
  - Correct/incorrect indicator
  - Correct answer (if "Show Correct Answers" is ON)
  - Explanation (if provided)

---

## Phase 4: Teacher Results Dashboard

### 4.1 Exam Results Overview Page

Accessible from: Course → Exam → View Results

**Summary Statistics Card**:

- Total students with access
- Total submissions
- Average score
- Highest/lowest score
- Average completion time

### 4.2 Results Table

Sortable, filterable, paginated table with columns:

| Column           | Description                                         |
| ---------------- | --------------------------------------------------- |
| Student Name     | Full name, clickable to profile                     |
| Student ID/Email | Secondary identifier                                |
| Attempt #        | Which attempt this row represents                   |
| Started At       | Timestamp when exam was started                     |
| Finished At      | Timestamp when submitted (or "In Progress")         |
| Duration         | Time taken (calculated)                             |
| Score            | Correct answers / Total questions                   |
| Percentage       | Score as percentage                                 |
| Violations       | Count of detected violations (if any)               |
| Status           | Completed, In Progress, Not Started, Auto-Submitted |
| Actions          | "View Details" button                               |

**Table Features**:

- Search by student name/email
- Filter by status (Completed, In Progress, etc.)
- Filter by score range
- Export to CSV
- Bulk actions: Reset attempt for selected students

### 4.3 Individual Attempt Detail Page

Accessed via "View Details" button. Shows:

**Header**:

- Student name and info
- Attempt number
- Start time, end time, duration
- Final score and percentage
- Violation log (expandable)

**Answer Review**: For each question:

- Question text
- All answer options
- Student's selected answer(s) — highlighted
- Correct answer — marked
- Points awarded for this question
- Teacher can add manual feedback/notes (optional feature)

---

## Phase 5: Security Implementation Details

### 5.1 Backend Security

- **Question Delivery**: Only send questions assigned to this attempt. Never send correct answers to
  client during active exam.
- **Answer Validation**: Validate on server. Client only sends answer IDs.
- **Attempt Verification**: Check attempt count, access rights, and time limit on every answer
  submission.
- **Time Enforcement**: Store start timestamp on server. Calculate remaining time server-side. Don't
  trust client timer.
- **Question Randomization**: Generate question order on server when attempt starts. Store the
  seed/order per attempt for consistent experience on page refresh.
- **Answer Shuffling**: Generate answer order on server per question per attempt. Store or
  regenerate deterministically.
- **Rate Limiting**: Prevent rapid-fire answer submissions
- **Session Validation**: Tie exam session to user session. Invalidate on logout.

### 5.2 Frontend Security Measures

Implement as a composable/wrapper for the exam screen (can modify and use useExamGuard.ts hook):

- **Copy/Paste**: `onCopy`, `onPaste`, `onCut` event interceptors
- **Tab Visibility**: `visibilitychange` event listener
- **DevTools Detection**: Detect via debugger timing or window size heuristics (not foolproof, but
  deterrent)
- **Right-Click**: `onContextMenu` prevention
- **Fullscreen**: Fullscreen API with exit detection
- **Keyboard Shortcuts**: Block Ctrl+C, Ctrl+V, F12, Ctrl+Shift+I

### 5.3 Violation Logging

Log each violation event with:

- Attempt ID
- Violation type
- Timestamp

---

## Phase 6: Access Control Implementation

### 6.1 Access States

- **No Access**: Exam exists but no student can see it in their course view
- **Draft**: Teacher is still configuring; invisible to students
- **Published - Restricted**: Visible but only accessible to explicitly granted students
- Published - ?: Visible only to students that completed all previous activities
- **Published - Open**: Accessible to all enrolled students

### 6.2 Access Management UI

Teacher can:

- Toggle between access modes
- In "Restricted" mode: See list of enrolled students with checkboxes
- Grant/revoke access to individual students
- Bulk grant/revoke
- Set access window (optional): Start date/time and end date/time

---

## Phase 7: Edge Cases & Error Handling

### 7.1 Connection Loss During Exam

- Auto-save answers periodically (every 30 seconds or on each answer change)
- On reconnection: Restore exam state from server
- If time expired during disconnect: Show "Exam time expired" message

### 7.2 Browser Close/Refresh

- Warn before leaving page (`beforeunload` event)
- On return: Resume from saved state if time remains
- Track "suspicious" exits in violation log

### 7.3 Concurrent Sessions

- Only allow one active exam session per student per exam
- If second session detected: Block with message "Exam already in progress in another window" and
  auto submit test.

### 7.4 Time Zone Handling

- Store all timestamps in UTC
- Display in Almaty timezone
- Server-side time validation only

---

## Phase 8: Navigation & UI Structure

### 8.1 Teacher Views

```
Course Dashboard
└── Activities Tab
    └── Exam Card (shows title, question count, submission count)
        ├── Edit Exam (settings + question bank)
        ├── Manage Access (student access control)
        └── View Results (results dashboard)

```

### 8.2 Student Views

```
Course Dashboard
└── Activities Tab
    └── Exam Card (shows title, status: Not Started/In Progress/Completed)
        ├── Pre-Exam Info Screen → Start Exam
        ├── Active Exam Screen
        └── Results Screen (if allowed and completed)

```

---

## Implementation Order Recommendation

1. **Core exam entity** — Create exam with basic settings
2. **Question bank** — CRUD for questions
3. **Student exam flow** — Pre-exam screen, take exam, submit
4. **Timer and auto-submit** — Time limit enforcement
5. **Results for students** — Basic result view
6. **Teacher results dashboard** — Table and detail views
7. **Access control** — Granular student access
8. **Anti-cheating measures** — Violation detection and logging
9. **Advanced features** — Attempt limits, question limits, shuffling
10. **Polish** — Notifications, edge cases, export

---

## Testing Checklist

- [ ] Exam creation with all settings combinations
- [ ] Question bank CRUD operations
- [ ] Student cannot access exam without permission
- [ ] Timer counts down correctly and auto-submits
- [ ] Answers are shuffled differently per student
- [ ] Questions are shuffled when enabled
- [ ] Question limit pulls random subset correctly
- [ ] Violations are detected and logged
- [ ] Auto-submit triggers at violation threshold
- [ ] Results hidden when review is disabled
- [ ] Teacher can see all student results
- [ ] Multiple attempts work correctly
- [ ] Page refresh preserves exam state
- [ ] Concurrent session blocking works
- [ ] Time zone handling is correct
