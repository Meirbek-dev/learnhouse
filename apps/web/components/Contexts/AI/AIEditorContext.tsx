'use client';

import type { AIMessage } from '@components/Objects/Activities/AI/AIActivityAsk';
import { createContext, useContext, useReducer } from 'react';
import type { ReactNode } from 'react';

export type CritisizeScope = 'selection' | 'lecture';

// Action types for the reducer
type AIEditorAction =
  | { type: 'setMessages'; payload: AIMessage[] }
  | { type: 'addMessage'; payload: AIMessage }
  | { type: 'setIsModalOpen' }
  | { type: 'setIsModalClose' }
  | { type: 'setAichat_uuid'; payload: string | null }
  | { type: 'setIsWaitingForResponse' }
  | { type: 'setIsNoLongerWaitingForResponse' }
  | { type: 'setChatInputValue'; payload: string }
  | {
      type: 'setSelectedTool';
      payload: 'Writer' | 'ContinueWriting' | 'MakeLonger' | 'GenerateQuiz' | 'Translate' | 'Critisize';
    }
  | { type: 'setIsFeedbackModalOpen' }
  | { type: 'setIsFeedbackModalClose' }
  | { type: 'setIsUserInputEnabled'; payload: boolean }
  | { type: 'setError'; payload: AIError }
  | { type: 'setCritisizeScope'; payload: CritisizeScope };

// Properly typed contexts
export const AIEditorContext = createContext<AIEditorStateTypes | null>(null);
export const AIEditorDispatchContext = createContext<React.Dispatch<AIEditorAction> | null>(null);

export interface AIEditorStateTypes {
  messages: AIMessage[];
  isModalOpen: boolean;
  isFeedbackModalOpen: boolean;
  aichat_uuid: string | null;
  isWaitingForResponse: boolean;
  chatInputValue: string;
  selectedTool: 'Writer' | 'ContinueWriting' | 'MakeLonger' | 'GenerateQuiz' | 'Translate' | 'Critisize';
  isUserInputEnabled: boolean;
  critisizeScope: CritisizeScope;
  error: AIError;
}

export interface AIError {
  isError: boolean;
  status: number;
  error_message: string;
}

interface AIEditorProviderProps {
  children: ReactNode;
}

const initialAIEditorState: AIEditorStateTypes = {
  messages: [],
  isModalOpen: false,
  isFeedbackModalOpen: false,
  aichat_uuid: null,
  isWaitingForResponse: false,
  chatInputValue: '',
  selectedTool: 'Writer',
  isUserInputEnabled: true,
  critisizeScope: 'selection',
  error: { isError: false, status: 0, error_message: '' },
};

const AIEditorProvider = ({ children }: AIEditorProviderProps) => {
  const [aIEditorState, dispatchAIEditor] = useReducer(aIEditorReducer, initialAIEditorState);

  return (
    <AIEditorContext.Provider value={aIEditorState}>
      <AIEditorDispatchContext.Provider value={dispatchAIEditor}>{children}</AIEditorDispatchContext.Provider>
    </AIEditorContext.Provider>
  );
};

export default AIEditorProvider;

export function useAIEditor(): AIEditorStateTypes {
  const context = useContext(AIEditorContext);
  if (!context) {
    throw new Error('useAIEditor must be used within an AIEditorProvider');
  }
  return context;
}

export function useAIEditorDispatch(): React.Dispatch<AIEditorAction> {
  const context = useContext(AIEditorDispatchContext);
  if (!context) {
    throw new Error('useAIEditorDispatch must be used within an AIEditorProvider');
  }
  return context;
}

type AIEditorActionHandlers = {
  [Type in AIEditorAction['type']]: (
    state: AIEditorStateTypes,
    action: Extract<AIEditorAction, { type: Type }>,
  ) => AIEditorStateTypes;
};

const AI_EDITOR_ACTION_HANDLERS: AIEditorActionHandlers = {
  setMessages: (state, action) => ({ ...state, messages: action.payload }),
  addMessage: (state, action) => ({ ...state, messages: [...state.messages, action.payload] }),
  setIsModalOpen: (state) => ({ ...state, isModalOpen: true }),
  setIsModalClose: (state) => ({ ...state, isModalOpen: false }),
  setAichat_uuid: (state, action) => ({ ...state, aichat_uuid: action.payload }),
  setIsWaitingForResponse: (state) => ({ ...state, isWaitingForResponse: true }),
  setIsNoLongerWaitingForResponse: (state) => ({ ...state, isWaitingForResponse: false }),
  setChatInputValue: (state, action) => ({ ...state, chatInputValue: action.payload }),
  setSelectedTool: (state, action) => ({ ...state, selectedTool: action.payload, messages: [] }),
  setIsFeedbackModalOpen: (state) => ({ ...state, isFeedbackModalOpen: true }),
  setIsFeedbackModalClose: (state) => ({ ...state, isFeedbackModalOpen: false }),
  setIsUserInputEnabled: (state, action) => ({ ...state, isUserInputEnabled: action.payload }),
  setError: (state, action) => ({ ...state, error: action.payload }),
  setCritisizeScope: (state, action) => ({ ...state, critisizeScope: action.payload }),
};

function aIEditorReducer(state: AIEditorStateTypes, action: AIEditorAction): AIEditorStateTypes {
  const handler = AI_EDITOR_ACTION_HANDLERS[action.type];

  if (!handler) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`Unhandled action type: ${String(action.type)}`);
    }
    return state;
  }

  return handler(state, action as never);
}
