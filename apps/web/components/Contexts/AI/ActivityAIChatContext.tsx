'use client';

/**
 * Thin shared context that wraps a single useChat instance for all AI
 * components within an activity page (AIActivityAsk + AICanvaToolkit).
 *
 * Using a context allows AIActivityAsk and AICanvaToolkit — which live in
 * separate React subtrees — to share the same chat session and message list
 * without prop drilling.
 */

import { useChat } from '@tanstack/ai-react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PropsWithChildren,
} from 'react';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { createActivityChatAdapter } from '@services/ai/activity-chat-adapter';
import type { UseChatReturn } from '@tanstack/ai-react';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ActivityAIChatContextValue extends UseChatReturn {
  /** In-flight status hint forwarded from the backend status SSE events. */
  statusMessage: string | null;
  /** Whether the chat panel is visible. */
  isModalOpen: boolean;
  /** Opens the panel, clearing any previous error/messages from useChat. */
  openModal: () => void;
  setIsModalOpen: (open: boolean) => void;
  /** Current text input value. */
  inputValue: string;
  setInputValue: (value: string) => void;
}

// ── Context ───────────────────────────────────────────────────────────────────

const ActivityAIChatContext = createContext<ActivityAIChatContextValue | null>(null);

// ── Provider ──────────────────────────────────────────────────────────────────

export function ActivityAIChatProvider({
  activityUuid,
  children,
}: PropsWithChildren<{ activityUuid: string }>) {
  const session = usePlatformSession();
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [inputValue, setInputValue] = useState('');

  // Keep the session UUID in a ref so it survives React Fast Refresh and
  // Strict-Mode double-mounts without starting a new backend session.
  const sessionUuidRef = useRef<string | null>(null);

  // Store the adapter's abort function so we can cancel in-flight requests.
  const abortRef = useRef<(() => void) | null>(null);

  const adapter = useMemo(
    () =>
      createActivityChatAdapter({
        activityUuid,
        getAccessToken: () => session?.data?.tokens?.access_token,
        getSessionUuid: () => sessionUuidRef.current,
        setSessionUuid: (uuid) => {
          sessionUuidRef.current = uuid;
        },
      }),
    // Recreate adapter only when the activity changes — access token and
    // session UUID changes are handled inside the factory via getter/setter.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [activityUuid],
  );

  // Keep the abort ref in sync whenever the adapter is recreated.
  useEffect(() => {
    abortRef.current = adapter.abort;
    return () => {
      adapter.abort();
    };
  }, [adapter]);

  const chat = useChat({
    connection: adapter.connection,
    onChunk: (chunk) => {
      if (chunk.type === 'CUSTOM' && chunk.name === 'ai_status') {
        setStatusMessage((chunk.value as { message: string }).message ?? null);
      }
    },
    onFinish: () => setStatusMessage(null),
    onError: () => setStatusMessage(null),
  });

  // Opens the panel and clears any stale error / messages from a previous session.
  const openModal = useCallback(() => {
    chat.clear();
    setIsModalOpen(true);
  }, [chat]);

  // Abort stream and clear input when the panel closes.
  useEffect(() => {
    if (!isModalOpen) {
      abortRef.current?.();
      chat.stop();
      setInputValue('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isModalOpen]);

  const value = useMemo(
    () => ({ ...chat, statusMessage, isModalOpen, openModal, setIsModalOpen, inputValue, setInputValue }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chat, statusMessage, isModalOpen, openModal, inputValue],
  );

  return <ActivityAIChatContext.Provider value={value}>{children}</ActivityAIChatContext.Provider>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useActivityAIChat(): ActivityAIChatContextValue {
  const ctx = useContext(ActivityAIChatContext);
  if (!ctx) throw new Error('useActivityAIChat must be used within ActivityAIChatProvider');
  return ctx;
}
