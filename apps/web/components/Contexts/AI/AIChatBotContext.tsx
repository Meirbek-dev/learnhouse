'use client';

import type { AIMessage, AIError } from '@components/Contexts/AI/AIBaseContext';
import { INITIAL_AI_ERROR } from '@components/Contexts/AI/AIBaseContext';
import { createContext, use, useReducer } from 'react';
import type { ReactNode } from 'react';

// Action types for the reducer
type AIChatBotAction =
  | { type: 'setMessages'; payload: AIMessage[] }
  | { type: 'addMessage'; payload: AIMessage }
  | { type: 'setIsModalOpen' }
  | { type: 'setIsModalClose' }
  | { type: 'setAichat_uuid'; payload: string | null }
  | { type: 'setIsWaitingForResponse' }
  | { type: 'setIsNoLongerWaitingForResponse' }
  | { type: 'setChatInputValue'; payload: string }
  | { type: 'setStreamingMessage'; payload: string }
  | { type: 'clearStreamingMessage' }
  | { type: 'setStatusMessage'; payload: string | null }
  | { type: 'setError'; payload: AIError };

// Properly typed contexts
export const AIChatBotContext = createContext<AIChatBotStateTypes | null>(null);
export const AIChatBotDispatchContext = createContext<React.Dispatch<AIChatBotAction> | null>(null);

export interface AIChatBotStateTypes {
  messages: AIMessage[];
  isModalOpen: boolean;
  aichat_uuid: string | null;
  isWaitingForResponse: boolean;
  chatInputValue: string;
  streamingMessage: string;
  statusMessage: string | null;
  error: AIError;
}


interface AIChatBotProviderProps {
  children: ReactNode;
}

const AIChatBotProvider = ({ children }: AIChatBotProviderProps) => {
  const [aiChatBotState, dispatchAIChatBot] = useReducer(aiChatBotReducer, {
    messages: [],
    isModalOpen: false,
    aichat_uuid: null,
    isWaitingForResponse: false,
    chatInputValue: '',
    streamingMessage: '',
    statusMessage: null,
    error: INITIAL_AI_ERROR,
  });

  return (
    <AIChatBotContext.Provider value={aiChatBotState}>
      <AIChatBotDispatchContext.Provider value={dispatchAIChatBot}>{children}</AIChatBotDispatchContext.Provider>
    </AIChatBotContext.Provider>
  );
};

export default AIChatBotProvider;

export function useAIChatBot(): AIChatBotStateTypes {
  const context = use(AIChatBotContext);
  if (!context) {
    throw new Error('useAIChatBot must be used within an AIChatBotProvider');
  }
  return context;
}

export function useAIChatBotDispatch(): React.Dispatch<AIChatBotAction> {
  const context = use(AIChatBotDispatchContext);
  if (!context) {
    throw new Error('useAIChatBotDispatch must be used within an AIChatBotProvider');
  }
  return context;
}

function aiChatBotReducer(state: AIChatBotStateTypes, action: AIChatBotAction): AIChatBotStateTypes {
  switch (action.type) {
    case 'setMessages': {
      return { ...state, messages: action.payload };
    }
    case 'addMessage': {
      return { ...state, messages: [...state.messages, action.payload] };
    }
    case 'setIsModalOpen': {
      return { ...state, isModalOpen: true };
    }
    case 'setIsModalClose': {
      return { ...state, isModalOpen: false };
    }
    case 'setAichat_uuid': {
      return { ...state, aichat_uuid: action.payload };
    }
    case 'setIsWaitingForResponse': {
      return { ...state, isWaitingForResponse: true };
    }
    case 'setIsNoLongerWaitingForResponse': {
      return { ...state, isWaitingForResponse: false };
    }
    case 'setChatInputValue': {
      return { ...state, chatInputValue: action.payload };
    }
    case 'setStreamingMessage': {
      return { ...state, streamingMessage: action.payload };
    }
    case 'clearStreamingMessage': {
      return { ...state, streamingMessage: '' };
    }
    case 'setStatusMessage': {
      return { ...state, statusMessage: action.payload };
    }
    case 'setError': {
      return { ...state, error: action.payload };
    }
    default: {
      throw new Error(`Unhandled action type: ${(action as any).type}`);
    }
  }
}
