/**
 * AI Service with Streaming Support
 *
 * Enhanced version with Server-Sent Events (SSE) for real-time AI responses
 */

import { useState } from 'react';
import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';

interface AIResponse {
  success: boolean;
  data: any;
  status: number;
  HTTPmessage: string;
  duration?: number;
}

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

/**
 * Legacy function - kept for backward compatibility
 * Consider migrating to startActivityAIChatSessionStream for better UX
 */
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

    return {
      success: false,
      data: { error: 'Network error' },
      status: 0,
      HTTPmessage: 'Network Error',
    };
  }
}

/**
 * New streaming version - provides real-time AI responses
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
): Promise<void> {
  try {
    const data = { message, activity_uuid };
    const response = await fetch(
      `${getAPIUrl()}ai/start/activity_chat_session_stream`,
      RequestBodyWithAuthHeader('POST', data, null, access_token),
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
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
              case 'status':
                onStatus?.(chunk);
                break;
              case 'chunk':
                onChunk?.(chunk);
                break;
              case 'final':
                onComplete?.(chunk);
                break;
              case 'error':
                onError?.(chunk);
                break;
            }
          } catch (e) {
            console.error('Failed to parse SSE chunk:', e);
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
 * Legacy function - kept for backward compatibility
 */
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

    return {
      success: false,
      data: { error: 'Network error' },
      status: 0,
      HTTPmessage: 'Network Error',
    };
  }
}

/**
 * New streaming version for sending messages
 */
export async function sendActivityAIChatMessageStream(
  message: string,
  aichat_uuid: string,
  activity_uuid: string,
  access_token: string,
  onChunk?: (chunk: AIStreamChunk) => void,
  onStatus?: (status: AIStreamChunk) => void,
  onComplete?: (final: AIStreamChunk) => void,
  onError?: (error: AIStreamChunk) => void,
): Promise<void> {
  try {
    const data = { aichat_uuid, message, activity_uuid };
    const response = await fetch(
      `${getAPIUrl()}ai/send/activity_chat_message_stream`,
      RequestBodyWithAuthHeader('POST', data, null, access_token),
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (!response.body) {
      throw new Error('Response body is null');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
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
              case 'status':
                onStatus?.(chunk);
                break;
              case 'chunk':
                onChunk?.(chunk);
                break;
              case 'final':
                onComplete?.(chunk);
                break;
              case 'error':
                onError?.(chunk);
                break;
            }
          } catch (e) {
            console.error('Failed to parse SSE chunk:', e);
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
export function useAIStream() {
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentText, setCurrentText] = useState('');
  const [error, setError] = useState<string | null>(null);

  const streamResponse = async (
    message: string,
    activity_uuid: string,
    access_token: string,
    aichat_uuid?: string,
  ) => {
    setIsStreaming(true);
    setCurrentText('');
    setError(null);

    if (aichat_uuid) {
      await sendActivityAIChatMessageStream(
        message,
        aichat_uuid,
        activity_uuid,
        access_token,
        // onChunk
        (chunk) => {
          setCurrentText((prev) => prev + chunk.content);
        },
        // onStatus
        (status) => {
          console.log('Status:', status.message);
        },
        // onComplete
        (final) => {
          setCurrentText(final.content || '');
          setIsStreaming(false);
        },
        // onError
        (err) => {
          setError(err.error || 'Unknown error');
          setIsStreaming(false);
        },
      );
    } else {
      await startActivityAIChatSessionStream(
        message,
        activity_uuid,
        access_token,
        // onChunk
        (chunk) => {
          setCurrentText((prev) => prev + chunk.content);
        },
        // onStatus
        (status) => {
          console.log('Status:', status.message);
        },
        // onComplete
        (final) => {
          setCurrentText(final.content || '');
          setIsStreaming(false);
        },
        // onError
        (err) => {
          setError(err.error || 'Unknown error');
          setIsStreaming(false);
        },
      );
    }
  };

  return {
    streamResponse,
    isStreaming,
    currentText,
    error,
  };
}
