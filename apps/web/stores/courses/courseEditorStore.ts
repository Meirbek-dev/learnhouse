'use client';

import { create } from 'zustand';

export type CourseDraftSection = 'general' | 'access' | 'contributors' | 'certification' | 'activity';
export type CourseDirtySection = 'general' | 'access' | 'contributors' | 'certification' | 'content';
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ConflictState {
  isOpen: boolean;
  serverVersion: any | null;
  draftSection: CourseDraftSection | null;
  message: string;
  pendingSave: (() => Promise<unknown>) | null;
}

interface CourseEditorState {
  activeCourseUuid: string | null;
  drafts: Partial<Record<CourseDraftSection, unknown>>;
  dirtySections: Partial<Record<CourseDirtySection, boolean>>;
  lastKnownUpdateDate: string | null;
  conflict: ConflictState;
  activitySaveStatus: SaveStatus;
  lastActivitySavedAt: number | null;
}

interface CourseEditorActions {
  openEditor: (courseUuid: string, lastKnownUpdateDate?: string | null) => void;
  syncLastKnownUpdateDate: (lastKnownUpdateDate?: string | null) => void;
  setDraft: <T>(section: CourseDraftSection, data: T) => void;
  clearDraft: (section: CourseDraftSection) => void;
  discardAllDrafts: () => void;
  setSectionDirty: (section: CourseDirtySection, dirty: boolean) => void;
  clearDirtySections: () => void;
  setConflict: (input: {
    serverVersion?: any | null;
    section?: CourseDraftSection | null;
    message?: string;
    pendingSave?: (() => Promise<unknown>) | null;
  }) => void;
  dismissConflict: () => void;
  resolveConflict: (resolution: 'use-mine' | 'use-theirs') => Promise<void>;
  setActivitySaveStatus: (status: SaveStatus) => void;
}

const createInitialConflictState = (): ConflictState => ({
  isOpen: false,
  serverVersion: null,
  draftSection: null,
  message: '',
  pendingSave: null,
});

const initialState: CourseEditorState = {
  activeCourseUuid: null,
  drafts: {},
  dirtySections: {},
  lastKnownUpdateDate: null,
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

  syncLastKnownUpdateDate: (lastKnownUpdateDate) =>
    set({
      lastKnownUpdateDate: lastKnownUpdateDate ?? null,
    }),

  setDraft: (section, data) =>
    set((state) => ({
      drafts: {
        ...state.drafts,
        [section]: data,
      },
    })),

  clearDraft: (section) =>
    set((state) => {
      const nextDrafts = { ...state.drafts };
      delete nextDrafts[section];
      return { drafts: nextDrafts };
    }),

  discardAllDrafts: () =>
    set({
      drafts: {},
      activitySaveStatus: 'idle',
    }),

  setSectionDirty: (section, dirty) =>
    set((state) => ({
      dirtySections: {
        ...state.dirtySections,
        [section]: dirty,
      },
    })),

  clearDirtySections: () => set({ dirtySections: {} }),

  setConflict: ({ serverVersion = null, section = null, message = '', pendingSave = null }) =>
    set({
      conflict: {
        isOpen: true,
        serverVersion,
        draftSection: section,
        message: message.trim(),
        pendingSave,
      },
    }),

  dismissConflict: () =>
    set({
      conflict: createInitialConflictState(),
    }),

  resolveConflict: async (resolution) => {
    const { conflict } = get();

    if (!conflict.isOpen) {
      return;
    }

    if (resolution === 'use-theirs') {
      set((state) => {
        const nextDrafts = { ...state.drafts };
        if (conflict.draftSection) {
          delete nextDrafts[conflict.draftSection];
        }

        const nextDirtySections = { ...state.dirtySections };
        if (conflict.draftSection && conflict.draftSection !== 'activity') {
          delete nextDirtySections[conflict.draftSection];
        }

        return {
          drafts: nextDrafts,
          dirtySections: nextDirtySections,
          lastKnownUpdateDate: conflict.serverVersion?.update_date ?? state.lastKnownUpdateDate,
          conflict: createInitialConflictState(),
          activitySaveStatus: conflict.draftSection === 'activity' ? 'idle' : state.activitySaveStatus,
        };
      });
      return;
    }

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
export const selectHasDrafts = (state: CourseEditorState) => Object.keys(state.drafts).length > 0;
