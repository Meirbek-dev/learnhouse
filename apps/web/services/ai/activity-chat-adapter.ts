/**
 * Custom TanStack AI connection adapter for the Python/FastAPI backend.
 *
 * The backend emits a proprietary SSE format:
 *   data: {"type":"status","aichat_uuid":"...","message":"..."}
 *   data: {"type":"chunk","content":"token"}
 *   data: {"type":"final","content":"full text","aichat_uuid":"..."}
 *   data: {"type":"error","error":"msg","error_code":"CODE"}
 *
 * This adapter translates those events into the AG-UI protocol (StreamChunk)
 * that TanStack AI's ChatClient expects.
 */

import { normalizeToUIMessage, stream } from '@tanstack/ai-client';
import { getAPIUrl } from '@services/config/config';
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests';
import type { TextPart } from '@tanstack/ai-client';

interface ActivityChatAdapterOptions {
  activityUuid: string;
  getAccessToken: () => string | undefined;
  /**
   * Provides the current session UUID from an external store (e.g. a React
   * ref in ActivityAIChatProvider) so it survives provider remounts.
   */
  getSessionUuid?: () => string | null;
  /** Persists the session UUID after the backend returns it. */
  setSessionUuid?: (uuid: string) => void;
}

/**
 * Creates a stateful connection adapter that bridges the Python backend's
 * SSE events to the AG-UI StreamChunk protocol used by TanStack AI.
 *
 * Session UUID is managed internally — the adapter automatically routes
 * to `/start` on first call and `/send` on subsequent calls.
 */
export function createActivityChatAdapter({ activityUuid, getAccessToken, getSessionUuid, setSessionUuid }: ActivityChatAdapterOptions) {
  // Fallback: keep a local closure variable for callers that don’t provide
  // external getter/setter (e.g. AIEditorToolkit’s standalone useChat).
  let _localSessionUuid: string | null = null;

  const readUuid = (): string | null => getSessionUuid ? getSessionUuid() : _localSessionUuid;
  const writeUuid = (uuid: string) => {
    if (setSessionUuid) {
      setSessionUuid(uuid);
    } else {
      _localSessionUuid = uuid;
    }
  };

  return stream(async function* (messages, _data) {
    const accessToken = getAccessToken();
    if (!accessToken) throw new Error('Not authenticated');

    // Extract the last user message text from the UIMessage parts array.
    const lastUser = [...messages].reverse().find((m) => m.role === 'user');
    const normalizedLastUser = lastUser ? normalizeToUIMessage(lastUser, () => crypto.randomUUID()) : null;
    const text =
      normalizedLastUser?.parts
        .filter((p): p is TextPart => p.type === 'text')
        .map((p) => p.content)
        .join('') ?? '';

    if (!text.trim()) return;

    // Route to the correct endpoint based on whether we have an active session.
    const sessionUuid = readUuid();
    const url = sessionUuid
      ? `${getAPIUrl()}ai/send/activity_chat_message_stream`
      : `${getAPIUrl()}ai/start/activity_chat_session_stream`;
    const body = sessionUuid
      ? { aichat_uuid: sessionUuid, message: text, activity_uuid: activityUuid }
      : { message: text, activity_uuid: activityUuid };

    const req = RequestBodyWithAuthHeader('POST', body, null, accessToken);

    const response = await fetch(url, req);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const runId = crypto.randomUUID();
    const messageId = crypto.randomUUID();
    const now = () => Date.now();

    let messageStarted = false;

    yield { type: 'RUN_STARTED', runId, timestamp: now() };

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() ?? '';

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          let event: Record<string, any>;
          try {
            event = JSON.parse(line.slice(6));
          } catch {
            continue;
          }

          switch (event.type) {
            case 'status': {
              if (event.aichat_uuid) writeUuid(event.aichat_uuid as string);
              // Surface the backend status message as a CUSTOM event so UI
              // components can display it via the onChunk callback.
              if (event.message) {
                yield {
                  type: 'CUSTOM',
                  name: 'ai_status',
                  value: { message: event.message as string },
                  timestamp: now(),
                };
              }
              break;
            }

            case 'chunk': {
              if (!messageStarted) {
                yield { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant', timestamp: now() };
                messageStarted = true;
              }
              if (event.content) {
                yield {
                  type: 'TEXT_MESSAGE_CONTENT',
                  messageId,
                  delta: event.content as string,
                  timestamp: now(),
                };
              }
              break;
            }

            case 'final': {
              if (event.aichat_uuid) writeUuid(event.aichat_uuid as string);
              if (!messageStarted) {
                yield { type: 'TEXT_MESSAGE_START', messageId, role: 'assistant', timestamp: now() };
                messageStarted = true;
              }
              if (event.content) {
                yield {
                  type: 'TEXT_MESSAGE_CONTENT',
                  messageId,
                  delta: event.content as string,
                  timestamp: now(),
                };
              }
              yield { type: 'TEXT_MESSAGE_END', messageId, timestamp: now() };
              yield { type: 'RUN_FINISHED', runId, finishReason: 'stop', timestamp: now() };
              return;
            }

            case 'error': {
              yield {
                type: 'RUN_ERROR',
                runId,
                error: {
                  message: (event.error as string) ?? 'Streaming failed',
                  code: event.error_code as string | undefined,
                },
                timestamp: now(),
              };
              return;
            }

            default:
              break;
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  });
}
