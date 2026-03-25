'use client';

/**
 * AssignmentsTaskContext
 *
 * Zustand store for the teacher assignment task editor.
 *
 * Tracks the currently selected task and provides a `reload()` action that
 * increments `reloadKey` — any component that lists tasks should watch
 * `reloadKey` (via `useEffect`) and call its SWR `mutate()` when it changes.
 *
 * `AssignmentsTaskProvider` is a pass-through component kept for API
 * compatibility with callers (AssignmentEditorSubPage, NewTaskModal) that
 * wrap their subtrees with it.
 */

import type { ReactNode } from 'react';
import { create } from 'zustand';

// ---------------------------------------------------------------------------
// Store shape
// ---------------------------------------------------------------------------

export interface AssignmentTaskData {
  assignment_task_uuid?: string;
  assignment_type?: string;
  title?: string;
  description?: string;
  hint?: string | null;
  max_grade_value?: number;
  reference_file?: string | null;
  contents?: {
    questions?: unknown[];
    settings?: unknown;
  };
  [key: string]: unknown;
}

interface AssignmentsTaskStore {
  /** The full task object currently open in the editor (empty object = none). */
  assignmentTask: AssignmentTaskData;

  /** UUID of the task currently selected in the sidebar task list. */
  selectedAssignmentTaskUUID: string | null;

  /**
   * Monotonically-increasing counter.  Increment via `reload()` to signal
   * that the task list should be re-fetched.
   */
  reloadKey: number;

  setAssignmentTask: (task: Record<string, unknown>) => void;
  setSelectedTaskUUID: (uuid: string | null) => void;
  reload: () => void;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAssignmentsTaskStore = create<AssignmentsTaskStore>((set) => ({
  assignmentTask: {},
  selectedAssignmentTaskUUID: null,
  reloadKey: 0,

  setAssignmentTask: (task) => set({ assignmentTask: task }),
  setSelectedTaskUUID: (uuid) => set({ selectedAssignmentTaskUUID: uuid }),
  reload: () => set((s) => ({ reloadKey: s.reloadKey + 1 })),
}));

// ---------------------------------------------------------------------------
// Provider (pass-through — kept for JSX compatibility)
// ---------------------------------------------------------------------------

export const AssignmentsTaskProvider = ({ children }: { children: ReactNode }) => <>{children}</>;
