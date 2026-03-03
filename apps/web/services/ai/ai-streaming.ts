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
  /** Session UUID returned by the backend on the first status event. */
  aichat_uuid?: string;
  status?: string;
  message?: string;
  content?: string;
  chunk_id?: number;
  total_chunks?: number;
  error?: string;
  error_code?: string;
}

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

