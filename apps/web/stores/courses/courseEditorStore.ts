'use client';

import { create } from 'zustand';

export type CourseDirtySection = 'general' | 'access' | 'contributors' | 'certification' | 'content';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ConflictState {
  isOpen: boolean;
  serverVersion: any | null;
  /** Point-in-time snapshot of the user's unsaved values — for display in the conflict dialog only. */
  draftSnapshot: unknown | null;
  draftSection: CourseDirtySection | null;
  message: string;
  pendingSave: (() => Promise<unknown>) | null;
  /** Called when the user chooses "use theirs" to reset the relevant form to server state. */
  resetForm: (() => void) | null;
}

interface CourseEditorState {
  activeCourseUuid: string | null;
  lastKnownUpdateDate: string | null;
  dirtySections: Partial<Record<CourseDirtySection, boolean>>;
  conflict: ConflictState;
  activitySaveStatus: SaveStatus;
  lastActivitySavedAt: number | null;
}

interface CourseEditorActions {
  openEditor: (courseUuid: string, lastKnownUpdateDate?: string | null) => void;
  syncLastKnownUpdateDate: (lastKnownUpdateDate?: string | null) => void;
  setSectionDirty: (section: CourseDirtySection, dirty: boolean) => void;
  clearDirtySections: () => void;
  setConflict: (input: {
    serverVersion?: any | null;
    draftSnapshot?: unknown | null;
    section?: CourseDirtySection | null;
    message?: string;
    pendingSave?: (() => Promise<unknown>) | null;
    resetForm?: (() => void) | null;
  }) => void;
  dismissConflict: () => void;
  resolveConflict: (resolution: 'use-mine' | 'use-theirs', resetForm?: () => void) => Promise<void>;
  setActivitySaveStatus: (status: SaveStatus) => void;
}

const createInitialConflictState = (): ConflictState => ({
  isOpen: false,
  serverVersion: null,
  draftSnapshot: null,
  draftSection: null,
  message: '',
  pendingSave: null,
  resetForm: null,
});

const initialState: CourseEditorState = {
  activeCourseUuid: null,
  lastKnownUpdateDate: null,
  dirtySections: {},
  conflict: createInitialConflictState(),
  activitySaveStatus: 'idle',
  lastActivitySavedAt: null,
};

export const useCourseEditorStore = create<CourseEditorState & CourseEditorActions>((set, get) => ({
  ...initialState,

  openEditor: (courseUuid, lastKnownUpdateDate) =>
    set((state) => {
      if (state.activeCourseUuid === courseUuid) {
        return {
          activeCourseUuid: courseUuid,
          lastKnownUpdateDate: lastKnownUpdateDate ?? state.lastKnownUpdateDate,
        };
      }
      return {
        ...initialState,
        activeCourseUuid: courseUuid,
        lastKnownUpdateDate: lastKnownUpdateDate ?? null,
      };
    }),

  syncLastKnownUpdateDate: (lastKnownUpdateDate) => set({ lastKnownUpdateDate: lastKnownUpdateDate ?? null }),

  setSectionDirty: (section, dirty) =>
    set((state) => ({
      dirtySections: { ...state.dirtySections, [section]: dirty },
    })),

  clearDirtySections: () => set({ dirtySections: {} }),

  setConflict: ({
    serverVersion = null,
    draftSnapshot = null,
    section = null,
    message = '',
    pendingSave = null,
    resetForm = null,
  }) =>
    set({
      conflict: {
        isOpen: true,
        serverVersion,
        draftSnapshot,
        draftSection: section,
        message: message.trim(),
        pendingSave,
        resetForm,
      },
    }),

  dismissConflict: () => set({ conflict: createInitialConflictState() }),

  /**
   * Resolve an optimistic-lock conflict.
   *
   * - 'use-mine'  → keep the user's unsaved changes; retry the save with the
   *                 updated lastKnownUpdateDate from the server version.
   * - 'use-theirs' → discard the user's changes; the caller must pass a
   *                  `resetForm` callback that resets the relevant RHF form
   *                  (or plain state) to the server version.
   */
  resolveConflict: async (resolution, resetForm) => {
    const { conflict } = get();
    if (!conflict.isOpen) return;

    if (resolution === 'use-theirs') {
      const storedReset = conflict.resetForm;
      set((state) => ({
        lastKnownUpdateDate: conflict.serverVersion?.update_date ?? state.lastKnownUpdateDate,
        dirtySections: conflict.draftSection
          ? { ...state.dirtySections, [conflict.draftSection]: false }
          : state.dirtySections,
        conflict: createInitialConflictState(),
        activitySaveStatus: conflict.draftSection === 'content' ? 'idle' : state.activitySaveStatus,
      }));
      storedReset?.();
      resetForm?.();
      return;
    }

    // 'use-mine': update lastKnownUpdateDate so the retry succeeds, then re-run the save.
    set((state) => ({
      lastKnownUpdateDate: conflict.serverVersion?.update_date ?? state.lastKnownUpdateDate,
      conflict: createInitialConflictState(),
    }));

    if (conflict.pendingSave) {
      await conflict.pendingSave();
    }
  },

  setActivitySaveStatus: (status) =>
    set({
      activitySaveStatus: status,
      lastActivitySavedAt: status === 'saved' ? Date.now() : get().lastActivitySavedAt,
    }),
}));

export const selectHasDirtySections = (state: CourseEditorState) => Object.values(state.dirtySections).some(Boolean);
