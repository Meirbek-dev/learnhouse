import { apiFetch } from '@/lib/api-client';

export async function uploadNewImageFile(file: File, activity_uuid: string) {
  const formData = new FormData();
  formData.append('file_object', file);
  formData.append('activity_uuid', activity_uuid);
  return apiFetch('blocks/image', { method: 'POST', body: formData })
    .then((result) => result.json())
    .catch((error: unknown) => {
      console.log('error', error);
    });
}

export async function getImageFile(file_id: string) {
  return apiFetch(`blocks/image?file_id=${file_id}`)
    .then((result) => result.json())
    .catch((error: unknown) => {
      console.log('error', error);
    });
}
