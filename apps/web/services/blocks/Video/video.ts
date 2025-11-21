import { RequestBodyFormWithAuthHeader, RequestBodyWithAuthHeader } from '@services/utils/ts/requests';
import { shouldUseChunkedUpload, uploadFileChunked } from '@services/utils/chunked-upload';
import { getAPIUrl } from '@services/config/config';

export async function uploadNewVideoFile(
  file: File,
  activity_uuid: string,
  access_token: string,
  onProgress?: (progress: { percentage: number; currentChunk: number; totalChunks: number }) => void,
) {
  // For large files, use chunked upload
  if (shouldUseChunkedUpload(file.size)) {
    console.log('Using chunked upload for large file');
    try {
      const result = await uploadFileChunked({
        file,
        directory: `activities/${activity_uuid}/dynamic/blocks/videoBlock`,
        typeOfDir: 'orgs',
        uuid: '', // This will need to be passed from context
        filename: `block_${Date.now()}.${file.name.split('.').pop()}`,
        accessToken: access_token,
        onProgress: onProgress
          ? (progress) =>
              onProgress({
                percentage: progress.percentage,
                currentChunk: progress.currentChunk,
                totalChunks: progress.totalChunks,
              })
          : undefined,
      });
      return { success: true, filename: result.filename };
    } catch (error) {
      console.error('Chunked upload error:', error);
      throw error;
    }
  }

  // For smaller files, use traditional upload
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
