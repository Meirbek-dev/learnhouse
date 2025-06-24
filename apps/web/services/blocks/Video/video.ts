import { getAPIUrl } from '@services/config/config';
import { RequestBodyFormWithAuthHeader, RequestBodyWithAuthHeader } from '@services/utils/ts/requests';

export async function uploadNewVideoFile(file: File, activity_uuid: string, access_token: string) {
  // Send file thumbnail as form data
  const formData = new FormData();
  formData.append('file_object', file);
  formData.append('activity_uuid', activity_uuid);
  try {
    const result = await fetch(
      `${getAPIUrl()}blocks/video`,
      RequestBodyFormWithAuthHeader('POST', formData, null, access_token),
    );
    return await result.json();
  } catch (error) {
    console.error('error', error);
    throw error;
  }
}

export async function getVideoFile(file_id: string, access_token: string) {
  try {
    const result = await fetch(
      `${getAPIUrl()}blocks/video?file_id=${file_id}`,
      RequestBodyWithAuthHeader('GET', null, null, access_token),
    );
    return await result.json();
  } catch (error) {
    console.error('error', error);
    throw error;
  }
}
