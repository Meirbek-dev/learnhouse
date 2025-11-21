import {
  RequestBodyWithAuthHeader,
  getResponseMetadata,
} from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { shouldUseChunkedUpload, uploadFileChunked } from '@services/utils/chunked-upload';

export async function createActivity(data: any, chapter_id: number, org_id: number, access_token: string) {
  data.content = {};
  // remove chapter_id from data
  data.chapterId = undefined;

  const result = await fetch(`${getAPIUrl()}activities/`, RequestBodyWithAuthHeader('POST', data, null, access_token));
  const metaData = await getResponseMetadata(result);
  return metaData;
}

export async function createFileActivity(
  file: File,
  type: string,
  data: any,
  chapter_id: number,
  access_token: string,
  onProgress?: (progress: { percentage: number; currentChunk?: number; totalChunks?: number }) => void,
) {
  if (type === 'video' && shouldUseChunkedUpload(file.size)) {
    // For large video files, use chunked upload
    console.log('Using chunked upload for video activity');

    try {
      // Get org and course info from data
      const orgUuid = data.org_uuid;
      const courseUuid = data.course_uuid;

      if (!orgUuid || !courseUuid) {
        throw new Error('Missing org_uuid or course_uuid for chunked upload');
      }

      // Generate a temporary activity UUID for the upload
      const tempActivityUuid = `activity_temp_${Date.now()}`;
      const videoFormat = file.name.split('.').pop() || 'mp4';

      // Upload video file in chunks first
      await uploadFileChunked({
        file,
        directory: `courses/${courseUuid}/activities/${tempActivityUuid}/video`,
        typeOfDir: 'orgs',
        uuid: orgUuid,
        filename: `video.${videoFormat}`,
        accessToken: access_token,
        onProgress: (progress) => {
          if (onProgress) {
            onProgress({
              percentage: progress.percentage,
              currentChunk: progress.currentChunk,
              totalChunks: progress.totalChunks,
            });
          }
        },
      });

      // Now create the activity with the uploaded video reference
      const formData = new FormData();
      formData.append('chapter_id', chapter_id.toString());
      formData.append('name', data.name);

      // Add a marker that video was uploaded separately
      formData.append('video_uploaded_path', `courses/${courseUuid}/activities/${tempActivityUuid}/video/video.${videoFormat}`);

      // Add subtitle files if present
      if (data.details?.subtitles && Array.isArray(data.details.subtitles)) {
        data.details.subtitles.forEach((subtitle: any) => {
          if (subtitle.file) {
            formData.append('subtitle_files', subtitle.file);
          }
        });
      }

      // Add video details
      if (data.details) {
        const detailsToSend: any = {
          startTime: data.details.startTime || 0,
          endTime: data.details.endTime || null,
          autoplay: data.details.autoplay,
          muted: data.details.muted,
        };

        if (data.details.subtitles) {
          detailsToSend.subtitles = data.details.subtitles.map((subtitle: any) => ({
            id: subtitle.id,
            language: subtitle.language,
            label: subtitle.label,
          }));
        }

        formData.append('details', JSON.stringify(detailsToSend));
      }

      const endpoint = `${getAPIUrl()}activities/video`;
      const result = await fetch(endpoint, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${access_token}`,
        },
        body: formData,
      });

      if (!result.ok) {
        throw new Error(`Failed to create activity: ${result.status}`);
      }

      const activity = await result.json();

      // Move the uploaded video to the correct location
      // The backend will handle this based on the video_uploaded_path

      return activity;
    } catch (error) {
      console.error('Chunked video upload error:', error);
      throw error;
    }
  }

  // For smaller files or non-video files, use traditional FormData upload
  const formData = new FormData();
  formData.append('chapter_id', chapter_id.toString());
  let endpoint = '';

  if (type === 'video') {
    formData.append('name', data.name);
    formData.append('video_file', file);

    // Add subtitle files if present
    if (data.details?.subtitles && Array.isArray(data.details.subtitles)) {
      data.details.subtitles.forEach((subtitle: any) => {
        if (subtitle.file) {
          formData.append('subtitle_files', subtitle.file);
        }
      });
    }

    // Add video details
    if (data.details) {
      const detailsToSend: any = {
        startTime: data.details.startTime || 0,
        endTime: data.details.endTime || null,
        autoplay: data.details.autoplay,
        muted: data.details.muted,
      };

      // Include subtitle metadata (without files)
      if (data.details.subtitles) {
        detailsToSend.subtitles = data.details.subtitles.map((subtitle: any) => ({
          id: subtitle.id,
          language: subtitle.language,
          label: subtitle.label,
        }));
      }

      formData.append('details', JSON.stringify(detailsToSend));
    }
    endpoint = `${getAPIUrl()}activities/video`;
  } else if (type === 'documentpdf') {
    formData.append('pdf_file', file);
    formData.append('name', data.name);
    endpoint = `${getAPIUrl()}activities/documentpdf`;
  }

  // Use XMLHttpRequest for progress tracking
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();

    // Track upload progress
    if (onProgress) {
      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          const percentage = Math.round((e.loaded / e.total) * 100);
          onProgress({ percentage });
        }
      });
    }

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const response = JSON.parse(xhr.responseText);
          resolve(response);
        } catch {
          reject(new Error('Invalid JSON response'));
        }
      } else {
        reject(new Error(`Upload failed with status ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new Error('Network error during upload'));
    });

    xhr.addEventListener('abort', () => {
      reject(new Error('Upload cancelled'));
    });

    xhr.open('POST', endpoint);
    xhr.setRequestHeader('Authorization', `Bearer ${access_token}`);
    xhr.send(formData);
  });
}

export async function createExternalVideoActivity(data: any, activity: any, chapter_id: number, access_token: string) {
  // add coursechapter_id to data
  data.chapter_id = chapter_id;
  data.activity_id = activity.id;

  // Add video details with null checking
  const defaultDetails = {
    startTime: 0,
    endTime: null,
    autoplay: false,
    muted: false,
  };
  const videoDetails = data.details
    ? {
        startTime: data.details.startTime ?? defaultDetails.startTime,
        endTime: data.details.endTime ?? defaultDetails.endTime,
        autoplay: data.details.autoplay ?? defaultDetails.autoplay,
        muted: data.details.muted ?? defaultDetails.muted,
      }
    : defaultDetails;
  data.details = JSON.stringify(videoDetails);
  const result = await fetch(
    `${getAPIUrl()}activities/external_video`,
    RequestBodyWithAuthHeader('POST', data, null, access_token),
  );
  return result.json();
}

export async function getActivity(activity_uuid: string, next: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}activities/${activity_uuid}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token),
  );
  return result.json();
}

export async function getActivityByID(activity_id: number, next: any, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}activities/id/${activity_id}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token),
  );
  return result.json();
}

export async function deleteActivity(activity_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}activities/${activity_uuid}`,
    RequestBodyWithAuthHeader('DELETE', null, null, access_token),
  );
  return result.json();
}

export async function getActivityWithAuthHeader(
  activity_uuid: string,
  next: any,
  access_token: string | null | undefined,
) {
  const result = await fetch(
    `${getAPIUrl()}activities/activity_${activity_uuid}`,
    RequestBodyWithAuthHeader('GET', null, next, access_token || undefined),
  );
  return result.json();
}

export async function updateActivity(data: any, activity_uuid: string, access_token: string) {
  const result = await fetch(
    `${getAPIUrl()}activities/${activity_uuid}`,
    RequestBodyWithAuthHeader('PUT', data, null, access_token),
  );
  return getResponseMetadata(result);
}

export async function getUrlPreview(url: string) {
  const result = await fetch(
    `${getAPIUrl()}utils/link-preview?url=${url}`,
    RequestBodyWithAuthHeader('GET', null, null),
  );
  return await result.json();
}
