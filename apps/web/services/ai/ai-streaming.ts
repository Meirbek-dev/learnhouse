/**
 * AI Service — Streaming + Non-Streaming
 *
 * Single source of truth for all AI network calls. The non-streaming helpers
 * are kept here for completeness; streaming variants should be preferred for
 * all interactive chat flows.
 */

import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { useCallback, useRef, useState } from 'react';

interface AIStreamChunk {
  type: 'status' | 'chunk' | 'final' | 'error';
  status?: string;
  message?: string;
  content?: string;
  chunk_id?: number;
  total_chunks?: number;
  error?: string;
  error_code?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Non-streaming helpers (legacy fallback — prefer streaming variants above)
// ─────────────────────────────────────────────────────────────────────────────

interface AIResponse {
  success: boolean;
  data: any;
  status: number;
  HTTPmessage: string;
  duration?: number;
}

export async function startActivityAIChatSession(
  message: string,
  access_token: string,
  activity_uuid?: string,
): Promise<AIResponse> {
  try {
    const data = { message, activity_uuid };
    const result = await fetch(
      `${getAPIUrl()}ai/start/activity_chat_session`,
      RequestBodyWithAuthHeader('POST', data, null, access_token),
    );
    const responseData = await result.json();
    return {
      success: result.status === 200,
      data: responseData,
      status: result.status,
      HTTPmessage: result.statusText,
    };
  } catch (error) {
    console.error('AI chat session failed:', error);
    return { success: false, data: { error: 'Network error' }, status: 0, HTTPmessage: 'Network Error' };
  }
}

export async function sendActivityAIChatMessage(
  message: string,
  aichat_uuid: string,
  activity_uuid: string,
  access_token: string,
): Promise<AIResponse> {
  try {
    const data = { aichat_uuid, message, activity_uuid };
    const result = await fetch(
      `${getAPIUrl()}ai/send/activity_chat_message`,
      RequestBodyWithAuthHeader('POST', data, null, access_token),
    );
    const responseData = await result.json();
    return {
      success: result.status === 200,
      data: responseData,
      status: result.status,
      HTTPmessage: result.statusText,
    };
  } catch (error) {
    console.error('AI message failed:', error);
    return { success: false, data: { error: 'Network error' }, status: 0, HTTPmessage: 'Network Error' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Streaming helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Provides real-time AI responses
 *
 * @param message - User's message
 * @param activity_uuid - Activity UUID
 * @param access_token - Authentication token
 * @param onChunk - Callback for each response chunk
 * @param onStatus - Callback for status updates
 * @param onComplete - Callback when response is complete
 * @param onError - Callback for errors
 *
 * @example
 * ```typescript
 * await startActivityAIChatSessionStream(
 *   "What is this course about?",
 *   "activity_123",
 *   token,
 *   (chunk) => setDisplayText(prev => prev + chunk.content),
 *   (status) => setStatus(status.message),
 *   (final) => {
 *     setDisplayText(final.content);
 *     setLoading(false);
 *   },
 *   (error) => showError(error.error)
 * );
 * ```
 */
export async function startActivityAIChatSessionStream(
  message: string,
  activity_uuid: string,
  access_token: string,
  onChunk?: (chunk: AIStreamChunk) => void,
  onStatus?: (status: AIStreamChunk) => void,
  onComplete?: (final: AIStreamChunk) => void,
  onError?: (error: AIStreamChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const data = { message, activity_uuid };
    const requestInit = RequestBodyWithAuthHeader('POST', data, null, access_token);
    // Attach abort signal if provided
    if (signal) requestInit.signal = signal;
    const response = await fetch(`${getAPIUrl()}ai/start/activity_chat_session_stream`, requestInit);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // Accumulate chunk content locally so we can finalize the
    // response even if server doesn't send an explicit 'final' event.
    let accumulatedContent = '';
    let completed = false;

    while (true) {
      // Stop if aborted
      if (signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        // If stream ended without a 'final' event, finalize with
        // whatever we have accumulated so the UI doesn't stay stuck.
        if (!completed) {
          onComplete?.({ type: 'final', content: accumulatedContent });
          completed = true;
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      // Keep incomplete line in buffer
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const chunk: AIStreamChunk = JSON.parse(line.slice(6));

            switch (chunk.type) {
              case 'status': {
                onStatus?.(chunk);
                break;
              }
              case 'chunk': {
                if (chunk.content) accumulatedContent += chunk.content;
                onChunk?.(chunk);
                break;
              }
              case 'final': {
                completed = true;
                onComplete?.(chunk);
                break;
              }
              case 'error': {
                completed = true;
                onError?.(chunk);
                break;
              }
            }
          } catch (error) {
            console.error('Failed to parse SSE chunk:', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('AI streaming failed:', error);
    onError?.({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      error_code: 'STREAM_ERROR',
    });
  }
}

export async function sendActivityAIChatMessageStream(
  message: string,
  aichat_uuid: string,
  activity_uuid: string,
  access_token: string,
  onChunk?: (chunk: AIStreamChunk) => void,
  onStatus?: (status: AIStreamChunk) => void,
  onComplete?: (final: AIStreamChunk) => void,
  onError?: (error: AIStreamChunk) => void,
  signal?: AbortSignal,
): Promise<void> {
  try {
    const data = { aichat_uuid, message, activity_uuid };
    const requestInit = RequestBodyWithAuthHeader('POST', data, null, access_token);
    if (signal) requestInit.signal = signal;
    const response = await fetch(`${getAPIUrl()}ai/send/activity_chat_message_stream`, requestInit);

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    // Accumulate chunk content locally so we can finalize the
    // response even if server doesn't send an explicit 'final' event.
    let accumulatedContent = '';
    let completed = false;

    while (true) {
      if (signal?.aborted) {
        reader.cancel();
        break;
      }

      const { done, value } = await reader.read();

      if (done) {
        if (!completed) {
          onComplete?.({ type: 'final', content: accumulatedContent });
          completed = true;
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');

      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          try {
            const chunk: AIStreamChunk = JSON.parse(line.slice(6));

            switch (chunk.type) {
              case 'status': {
                onStatus?.(chunk);
                break;
              }
              case 'chunk': {
                if (chunk.content) accumulatedContent += chunk.content;
                onChunk?.(chunk);
                break;
              }
              case 'final': {
                completed = true;
                onComplete?.(chunk);
                break;
              }
              case 'error': {
                completed = true;
                onError?.(chunk);
                break;
              }
            }
          } catch (error) {
            console.error('Failed to parse SSE chunk:', error);
          }
        }
      }
    }
  } catch (error) {
    console.error('AI streaming failed:', error);
    onError?.({
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error',
      error_code: 'STREAM_ERROR',
    });
  }
}

/**
 * React hook for AI streaming
 *
 * @example
 * ```typescript
 * function MyComponent() {
 *   const { streamResponse, isStreaming, currentText } = useAIStream();
 *
 *   const handleAsk = async () => {
 *     await streamResponse("What is this?", "activity_123", token);
 *   };
 *
 *   return (
 *     <div>
 *       {isStreaming ? <Spinner /> : null}
 *       <p>{currentText}</p>
 *       <button onClick={handleAsk}>Ask AI</button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useAIStream(dispatch?: React.Dispatch<{ type: string; payload?: any }>) {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const currentControllerRef = useRef<AbortController | null>(null);

  const streamResponse = useCallback(
    async (message: string, activity_uuid: string, access_token: string, aichat_uuid?: string) => {
      // Cancel any previous running stream
      if (currentControllerRef.current) {
        currentControllerRef.current.abort();
      }

      const controller = new AbortController();
      currentControllerRef.current = controller;
      setIsStreaming(true);
      setCurrentText('');
      setError(null);

      dispatch?.({ type: 'setIsWaitingForResponse' });

      const onChunk = (chunk: AIStreamChunk) => {
        setCurrentText((prev) => prev + (chunk.content ?? ''));
        dispatch?.({ type: 'setStreamingMessage', payload: (currentText + (chunk.content ?? '')) });
      };

      const onStatus = (status: AIStreamChunk) => {
        dispatch?.({ type: 'setStatusMessage', payload: status.message ?? null });
      };

      const onComplete = (final: AIStreamChunk) => {
        const finalText = final.content || currentText;
        setCurrentText(finalText);
        setIsStreaming(false);
        dispatch?.({ type: 'setIsNoLongerWaitingForResponse' });
        dispatch?.({ type: 'clearStreamingMessage' });
        if (final.content) {
          dispatch?.({ type: 'addMessage', payload: { sender: 'ai', message: finalText, type: 'ai' } });
        }
      };

      const onError = (err: AIStreamChunk) => {
        setError(err.error || 'Unknown error');
        setIsStreaming(false);
        dispatch?.({ type: 'setIsNoLongerWaitingForResponse' });
        dispatch?.({ type: 'setError', payload: { isError: true, status: 500, error_message: err.error || 'Unknown error' } });
      };

      if (aichat_uuid) {
        await sendActivityAIChatMessageStream(
          message, aichat_uuid, activity_uuid, access_token,
          onChunk, onStatus, onComplete, onError, controller.signal,
        );
      } else {
        await startActivityAIChatSessionStream(
          message, activity_uuid, access_token,
          onChunk, onStatus, onComplete, onError, controller.signal,
        );
      }

      currentControllerRef.current = null;
    },
    [dispatch, currentText],
  );

  const cancelStream = useCallback(() => {
    if (currentControllerRef.current) {
      currentControllerRef.current.abort();
      currentControllerRef.current = null;
      setIsStreaming(false);
      dispatch?.({ type: 'setIsNoLongerWaitingForResponse' });
    }
  }, [dispatch]);

  return {
    streamResponse,
    isStreaming,
    currentText,
    error,
    cancelStream,
  };
}
