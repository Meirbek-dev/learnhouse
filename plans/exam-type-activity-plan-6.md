# 🟡 High Priority - Would Significantly Benefit

## 1. **ExamTakingInterface.tsx** (Most Complex State)

**Current State:** 8+ useState hooks managing interdependent state

```typescript
- currentQuestionIndex
- answers
- showConfirmation
- isSubmitting
- violationCount
- violationDialogOpen
- currentViolation
- isFullscreen
- showRecoveryDialog
```

**Issues:**

- State transitions not validated (can show confirmation while submitting)
- Violation handling scattered across callbacks
- Answer state managed separately from UI state (recovery dialog vs answers)
- No single source of truth for "exam taking mode" (normal/submitting/violated/recovering)

**Recommended Reducer:**

```typescript
type TakingState =
  | { mode: 'answering'; currentIndex: number; answers: Record<number, any> }
  | { mode: 'confirming-submit'; currentIndex: number; answers: Record<number, any>; unanswered: number[] }
  | { mode: 'submitting'; answers: Record<number, any> }
  | { mode: 'violation-warning'; violation: Violation; count: number; currentIndex: number }
  | { mode: 'recovery-prompt'; recoveredAnswers: Record<number, any>; currentIndex: number }
  | { mode: 'fullscreen-warning' }
```

**Benefits:**

- Prevents invalid states (can't navigate while submitting)
- Centralized violation handling
- Clear recovery flow
- Type-safe state transitions

---

#### 2. **QuestionManagement.tsx** (Modal/Editor State Machine)

**Current State:** 6 useState hooks for UI modes

```typescript
- isDialogOpen
- editingQuestion
- inlineEditorOpen
- deleteDialogOpen
- pendingDeleteUuid
- isDeleting
```

**Issues:**

- Can have multiple modals conceptually open simultaneously
- Edit state not synced with dialog state
- Deletion flow requires 3 separate state variables

**Recommended Reducer:**

```typescript
type EditorState =
  | { mode: 'idle' }
  | { mode: 'editing-inline'; question: Question }
  | { mode: 'editing-modal'; question: Question }
  | { mode: 'deleting'; questionUuid: string }
  | { mode: 'importing'; file: File }
  | { mode: 'exporting' }
```

**Benefits:**

- One mode at a time (no dialog conflicts)
- Clear question lifecycle (idle → editing → saving → idle)
- Simplified delete confirmation (mode carries context)

---

### 🟢 Medium Priority - Minor Improvements

#### 3. **ExamResultsDashboard.tsx** (Filter/Sort State)

**Current State:** 4 useState hooks for table controls

```typescript
- searchQuery
- statusFilter
- sortBy
- sortOrder
```

**Complexity:** Low (independent state, no interdependencies)

**Verdict:** Current implementation is fine. Reducer would add complexity without significant benefit since filters don't have invalid state combinations.

---

## 🎯 Recommendations

### Immediate Action

Create **ExamTakingReducer** for ExamTakingInterface.tsx:

- Consolidate 8 useState → 1 useReducer
- Prevent invalid state combinations (submitting while showing recovery dialog)
- Improve recovery UX (clear state transitions)
- Simplify violation handling

### Secondary Action

Create **QuestionEditorReducer** for QuestionManagement.tsx:

- Prevent multiple modals open simultaneously
- Simplify add/edit/delete flows
- Better loading state management
