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

function aIEditorReducerImpl(state: AIEditorStateTypes, action: AIEditorAction): AIEditorStateTypes {
  switch (action.type) {
    case 'setMessages':
      return { ...state, messages: action.payload };
    case 'addMessage':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'setIsModalOpen':
      return { ...state, isModalOpen: true };
    case 'setIsModalClose':
      return { ...state, isModalOpen: false };
    case 'setAichat_uuid':
      return { ...state, aichat_uuid: action.payload };
    case 'setIsWaitingForResponse':
      return { ...state, isWaitingForResponse: true };
    case 'setIsNoLongerWaitingForResponse':
      return { ...state, isWaitingForResponse: false };
    case 'setChatInputValue':
      return { ...state, chatInputValue: action.payload };
    case 'setSelectedTool':
      return { ...state, selectedTool: action.payload, messages: [] };
    case 'setIsFeedbackModalOpen':
      return { ...state, isFeedbackModalOpen: true };
    case 'setIsFeedbackModalClose':
      return { ...state, isFeedbackModalOpen: false };
    case 'setIsUserInputEnabled':
      return { ...state, isUserInputEnabled: action.payload };
    case 'setError':
      return { ...state, error: action.payload };
    case 'setCritisizeScope':
      return { ...state, critisizeScope: action.payload };
    default:
      return state;
  }
}

const aIEditorReducer = aIEditorReducerImpl;
