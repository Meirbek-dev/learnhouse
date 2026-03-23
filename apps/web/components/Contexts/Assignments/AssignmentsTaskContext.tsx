'use client';

import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { getAssignmentTask } from '@services/courses/assignments';
import { createContext, use, useEffect, useRef } from 'react';
import { getAPIUrl } from '@services/config/config';
import { createStore } from 'zustand/vanilla';
import type { ReactNode } from 'react';
import { useStore } from 'zustand';
import { mutate } from 'swr';

import { useAssignments } from './AssignmentContext';

// ── Store shape ───────────────────────────────────────────────────────────────

interface AssignmentsTaskState {
  selectedAssignmentTaskUUID: string | null;
  assignmentTask: Record<string, any>;
  reloadTrigger: number;
}

interface AssignmentsTaskActions {
  setSelectedTaskUUID: (uuid: string | null) => void;
  setAssignmentTask: (task: Record<string, any>) => void;
  reload: () => void;
}

export type AssignmentsTaskStore = AssignmentsTaskState & AssignmentsTaskActions;

function makeAssignmentsTaskStore() {
  return createStore<AssignmentsTaskStore>((set) => ({
    selectedAssignmentTaskUUID: null,
    assignmentTask: {},
    reloadTrigger: 0,
    setSelectedTaskUUID: (uuid) => set({ selectedAssignmentTaskUUID: uuid }),
    setAssignmentTask: (task) => set({ assignmentTask: task }),
    reload: () => set((s) => ({ reloadTrigger: s.reloadTrigger + 1 })),
  }));
}

// ── Context ───────────────────────────────────────────────────────────────────

type StoreInstance = ReturnType<typeof makeAssignmentsTaskStore>;

const AssignmentsTaskStoreContext = createContext<StoreInstance | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function AssignmentsTaskProvider({ children }: { children: ReactNode }) {
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const assignment = useAssignments();

  const storeRef = useRef<StoreInstance>(null);
  if (!storeRef.current) storeRef.current = makeAssignmentsTaskStore();
  const store = storeRef.current;

  const selectedUUID = useStore(store, (s) => s.selectedAssignmentTaskUUID);
  const reloadTrigger = useStore(store, (s) => s.reloadTrigger);

  useEffect(() => {
    if (!selectedUUID) return;

    const assignmentUUID = assignment.assignment_object?.assignment_uuid;
    void (async () => {
      const res = await getAssignmentTask(selectedUUID, access_token);
      if (res.success) {
        store.getState().setAssignmentTask(res.data);
        void mutate(`${getAPIUrl()}assignments/${assignmentUUID}/tasks`);
      }
    })();
  }, [selectedUUID, reloadTrigger, assignment.assignment_object?.assignment_uuid, access_token, store]);

  return <AssignmentsTaskStoreContext.Provider value={store}>{children}</AssignmentsTaskStoreContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useAssignmentsTaskStore<T>(selector: (s: AssignmentsTaskStore) => T): T {
  const store = use(AssignmentsTaskStoreContext);
  if (!store) throw new Error('useAssignmentsTaskStore must be used within an AssignmentsTaskProvider');
  return useStore(store, selector);
}
