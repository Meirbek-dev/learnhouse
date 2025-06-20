'use client';
import { ArrowBigUpDash, UploadCloud, Image as ImageIcon } from 'lucide-react';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { updateCourseThumbnail } from '@services/courses/courses';
import { useCourse } from '@components/Contexts/CourseContext';
import { useOrg } from '@components/Contexts/OrgContext';
import UnsplashImagePicker from './UnsplashImagePicker';
import { getAPIUrl } from '@services/config/config';
import { useState, useEffect, useRef } from 'react';
import { useTranslations } from 'next-intl';
import type React from 'react';
import { mutate } from 'swr';

const MAX_FILE_SIZE = 8_000_000; // 8MB
const VALID_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const;

type ValidMimeType = (typeof VALID_MIME_TYPES)[number];

function ThumbnailUpdate() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const course = useCourse() as any;
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const [localThumbnail, setLocalThumbnail] = useState<{
    file: File;
    url: string;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [showError, setShowError] = useState(false);
  const [showUnsplashPicker, setShowUnsplashPicker] = useState(false);
  const t = useTranslations('CourseEdit.General.Thumbnail');
  const withUnpublishedActivities = course ? course.withUnpublishedActivities : false;

  // Cleanup blob URLs when component unmounts or when thumbnail changes
  useEffect(() => {
    return () => {
      if (localThumbnail?.url) {
        URL.revokeObjectURL(localThumbnail.url);
      }
    };
  }, [localThumbnail]);

  const validateFile = (file: File): boolean => {
    if (!VALID_MIME_TYPES.includes(file.type as ValidMimeType)) {
      setError(t('errors.invalidMimeType', { fileType: file.type }));
      setShowError(true);
      return false;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError(
        t('errors.fileTooLarge', {
          fileSize: (file.size / 1024 / 1024).toFixed(2),
        }),
      );
      setShowError(true);
      return false;
    }

    setShowError(false);
    return true;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    setError('');
    setShowError(false);
    const file = event.target.files?.[0];

    if (!file) {
      setError(t('errors.pleaseSelectAFile'));
      setShowError(true);
      return;
    }

    if (!validateFile(file)) {
      event.target.value = '';
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    setLocalThumbnail({ file, url: blobUrl });
    await updateThumbnail(file);
  };

  const handleUnsplashSelect = async (imageUrl: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      if (!VALID_MIME_TYPES.includes(blob.type as ValidMimeType)) {
        throw new Error(t('errors.unsplashInvalidFormat'));
      }

      const file = new File([blob], `unsplash_${Date.now()}.jpg`, {
        type: blob.type,
      });

      if (!validateFile(file)) {
        return;
      }

      const blobUrl = URL.createObjectURL(file);
      setLocalThumbnail({ file, url: blobUrl });
      await updateThumbnail(file);
    } catch (_err) {
      setError(t('errors.unsplashProcessFailed'));
      setIsLoading(false);
    }
  };

  const updateThumbnail = async (file: File) => {
    setIsLoading(true);
    try {
      const res = await updateCourseThumbnail(
        course.courseStructure.course_uuid,
        file,
        session.data?.tokens?.access_token,
      );

      await mutate(
        `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
      );
      await new Promise((r) => setTimeout(r, 1500));

      if (res.success === false) {
        setError(res.HTTPmessage);
        setShowError(true);
      } else {
        setError('');
        setShowError(false);
      }
    } catch (err) {
      setError(t('errors.updateFailed'));
      setShowError(true);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="light-shadow relative h-[250px] w-auto rounded-xl border border-gray-200 bg-gray-50 transition-all duration-200">
      {showError && error && (
        <div className="absolute left-0 right-0 top-4 z-50 mx-auto w-[90%] rounded-lg border border-red-200 bg-red-50 p-3 text-red-800 shadow-lg transition-all">
          <div className="text-center text-sm font-medium">{error}</div>
        </div>
      )}
      <div className="flex h-full flex-col items-center justify-center space-y-4 p-6">
        <div className="flex flex-col items-center space-y-4">
          {localThumbnail ? (
            <img
              src={localThumbnail.url}
              className={`${
                isLoading ? 'animate-pulse' : ''
              } h-[140px] w-[280px] rounded-lg border border-gray-200 object-cover shadow-sm`}
              alt={t('imageAltText')}
            />
          ) : (
            <img
              src={`${
                course.courseStructure.thumbnail_image
                  ? getCourseThumbnailMediaDirectory(
                      org?.org_uuid,
                      course.courseStructure.course_uuid,
                      course.courseStructure.thumbnail_image,
                    )
                  : '/empty_thumbnail.png'
              }`}
              className="h-[140px] w-[280px] rounded-lg border border-gray-200 bg-gray-50 object-cover shadow-sm"
              alt={t('imageAltText')}
            />
          )}

          {!isLoading && (
            <div className="flex space-x-2">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".jpg,.jpeg,.png"
                onChange={handleFileChange}
              />
              <button
                type="button"
                className="flex items-center rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-800 transition-colors duration-200 hover:bg-gray-100"
                onClick={() => fileInputRef.current?.click()}
              >
                <UploadCloud
                  size={16}
                  className="mr-2"
                />
                {t('uploadImageButton')}
              </button>
              <button
                className="flex items-center rounded-md border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-800 transition-colors duration-200 hover:bg-gray-100"
                onClick={() => setShowUnsplashPicker(true)}
              >
                <ImageIcon
                  size={16}
                  className="mr-2"
                />
                {t('gallery')}
              </button>
            </div>
          )}
        </div>

        {isLoading && (
          <div className="flex items-center justify-center">
            <div className="flex items-center rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
              <ArrowBigUpDash
                size={16}
                className="mr-2 animate-bounce"
              />
              {t('uploading')}
            </div>
          </div>
        )}

        <p className="text-xs text-gray-500">{t('supportedFormats')}</p>
      </div>

      {showUnsplashPicker && (
        <UnsplashImagePicker
          onSelect={handleUnsplashSelect}
          onClose={() => setShowUnsplashPicker(false)}
        />
      )}
    </div>
  );
}

export default ThumbnailUpdate;
