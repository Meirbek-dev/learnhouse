'use client';

import { create } from 'zustand';

export interface ChapterOrderSnapshot {
  chapterId: number;
  chapterUuid: string;
  activityIds: { activityId: string | number; activityUuid: string }[];
}

export type CourseSelection =
  | { type: 'course'; uuid: string }
  | { type: 'chapter'; uuid: string }
  | { type: 'activity'; uuid: string }
  | null;

interface DragState {
  originalOrder: ChapterOrderSnapshot[];
  pendingOrder: ChapterOrderSnapshot[];
  status: 'dragging' | 'saving' | 'error';
}

interface CourseStructureState {
  expandedChapterIds: Set<string>;
  selection: CourseSelection;
  dragging: DragState | null;
}

interface CourseStructureActions {
  toggleChapter: (chapterId: string) => void;
  setExpanded: (chapterId: string, expanded: boolean) => void;
  select: (selection: CourseSelection) => void;
  beginDrag: (originalOrder: ChapterOrderSnapshot[]) => void;
  updateDragOrder: (pendingOrder: ChapterOrderSnapshot[]) => void;
  markDragSaving: () => void;
  markDragError: () => void;
  commitDrag: () => void;
  rollbackDrag: () => void;
  reset: () => void;
}

const initialState: CourseStructureState = {
  expandedChapterIds: new Set<string>(),
  selection: null,
  dragging: null,
};

export const useCourseStructureStore = create<CourseStructureState & CourseStructureActions>((set) => ({
  ...initialState,

  toggleChapter: (chapterId) =>
    set((state) => {
      const nextExpanded = new Set(state.expandedChapterIds);
      if (nextExpanded.has(chapterId)) {
        nextExpanded.delete(chapterId);
      } else {
        nextExpanded.add(chapterId);
      }
      return { expandedChapterIds: nextExpanded };
    }),

  setExpanded: (chapterId, expanded) =>
    set((state) => {
      const nextExpanded = new Set(state.expandedChapterIds);
      if (expanded) {
        nextExpanded.add(chapterId);
      } else {
        nextExpanded.delete(chapterId);
      }
      return { expandedChapterIds: nextExpanded };
    }),

  select: (selection) => set({ selection }),

  beginDrag: (originalOrder) =>
    set({
      dragging: {
        originalOrder,
        pendingOrder: originalOrder,
        status: 'dragging',
      },
    }),

  updateDragOrder: (pendingOrder) =>
    set((state) => ({
      dragging: state.dragging
        ? {
            ...state.dragging,
            pendingOrder,
            status: 'dragging',
          }
        : {
            originalOrder: pendingOrder,
            pendingOrder,
            status: 'dragging',
          },
    })),

  markDragSaving: () =>
    set((state) => ({
      dragging: state.dragging
        ? {
            ...state.dragging,
            status: 'saving',
          }
        : null,
    })),

  markDragError: () =>
    set((state) => ({
      dragging: state.dragging
        ? {
            ...state.dragging,
            status: 'error',
          }
        : null,
    })),

  commitDrag: () => set({ dragging: null }),

  rollbackDrag: () =>
    set((state) => ({
      dragging: state.dragging
        ? {
            ...state.dragging,
            pendingOrder: state.dragging.originalOrder,
            status: 'error',
          }
        : null,
    })),

  reset: () => set(initialState),
}));
