import { RequestBodyWithAuthHeader } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';

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
    console.error('AI chat session failed after:', error);

    return {
      success: false,
      data: { error: 'Network error' },
      status: 0,
      HTTPmessage: 'Network Error',
    };
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

    return {
      success: false,
      data: { error: 'Network error' },
      status: 0,
      HTTPmessage: 'Network Error',
    };
  }
}
