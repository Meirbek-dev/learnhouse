'use client';

import { createContext, use, useCallback, useEffect, useReducer } from 'react';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getAssignmentTask } from '@services/courses/assignments';
import { getAPIUrl } from '@services/config/config';
import type { ReactNode } from 'react';
import { mutate } from 'swr';

import { useAssignments } from './AssignmentContext';

interface State {
  selectedAssignmentTaskUUID: string | null;
  assignmentTask: Record<string, any>;
  reloadTrigger: number;
}

interface Action {
  type: 'setSelectedAssignmentTaskUUID' | 'setAssignmentTask' | 'reload' | 'SET_MULTIPLE_STATES';
  payload?: any;
}

const initialState: State = {
  selectedAssignmentTaskUUID: null,
  assignmentTask: {},
  reloadTrigger: 0,
};

export const AssignmentsTaskContext = createContext<State | undefined>(undefined);
export const AssignmentsTaskDispatchContext = createContext<React.Dispatch<Action> | undefined>(undefined);

export const AssignmentsTaskProvider = ({ children }: { children: ReactNode }) => {
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const assignment = useAssignments();

  const [state, dispatch] = useReducer(assignmentsTaskReducer, initialState);

  const fetchAssignmentTask = useCallback(
    async (assignmentTaskUUID: string) => {
      const res = await getAssignmentTask(assignmentTaskUUID, access_token);

      if (res.success) {
        dispatch({ type: 'setAssignmentTask', payload: res.data });
      }
    },
    [access_token],
  );

  useEffect(() => {
    if (state.selectedAssignmentTaskUUID) {
      fetchAssignmentTask(state.selectedAssignmentTaskUUID);
      mutate(`${getAPIUrl()}assignments/${assignment.assignment_object?.assignment_uuid}/tasks`);
    }
  }, [state.selectedAssignmentTaskUUID, assignment.assignment_object?.assignment_uuid, fetchAssignmentTask]);

  return (
    <AssignmentsTaskContext.Provider value={state}>
      <AssignmentsTaskDispatchContext.Provider value={dispatch}>{children}</AssignmentsTaskDispatchContext.Provider>
    </AssignmentsTaskContext.Provider>
  );
};

export function useAssignmentsTask() {
  const context = use(AssignmentsTaskContext);
  if (context === undefined) {
    throw new Error('useAssignmentsTask must be used within an AssignmentsTaskProvider');
  }
  return context;
}

export function useAssignmentsTaskDispatch() {
  const context = use(AssignmentsTaskDispatchContext);
  if (context === undefined) {
    throw new Error('useAssignmentsTaskDispatch must be used within an AssignmentsTaskProvider');
  }
  return context;
}

function assignmentsTaskReducer(state: State, action: Action): State {
  switch (action.type) {
    case 'setSelectedAssignmentTaskUUID': {
      return { ...state, selectedAssignmentTaskUUID: action.payload };
    }
    case 'setAssignmentTask': {
      return { ...state, assignmentTask: action.payload };
    }
    case 'reload': {
      return { ...state, reloadTrigger: state.reloadTrigger + 1 };
    }
    case 'SET_MULTIPLE_STATES': {
      return {
        ...state,
        ...action.payload,
      };
    }
    default: {
      return state;
    }
  }
}
