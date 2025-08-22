import { ArrowBigUpDash, Image as ImageIcon, UploadCloud, Video } from 'lucide-react';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { updateCourseThumbnail } from '@services/courses/courses';
import { useCourse } from '@components/Contexts/CourseContext';
import { useOrg } from '@components/Contexts/OrgContext';
import UnsplashImagePicker from './UnsplashImagePicker';
import { getAPIUrl } from '@services/config/config';
import { useEffect, useRef, useState } from 'react';
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import type React from 'react';
import { mutate } from 'swr';

const MAX_FILE_SIZE = 8_000_000; // 8MB for images
const MAX_VIDEO_FILE_SIZE = 100_000_000; // 100MB for videos
const VALID_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png'] as const;
const VALID_VIDEO_MIME_TYPES = ['video/mp4', 'video/webm'] as const;

type ValidImageMimeType = (typeof VALID_IMAGE_MIME_TYPES)[number];
type ValidVideoMimeType = (typeof VALID_VIDEO_MIME_TYPES)[number];

interface ThumbnailUpdateProps {
  thumbnailType: 'image' | 'video' | 'both';
}

type TabType = 'image' | 'video';

const ThumbnailUpdate = ({ thumbnailType }: ThumbnailUpdateProps) => {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const course = useCourse() as any;
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const [localThumbnail, setLocalThumbnail] = useState<{ file: File; url: string; type: 'image' | 'video' } | null>(
    null,
  );
  const [isLoading, setIsLoading] = useState(false);
  const [showUnsplashPicker, setShowUnsplashPicker] = useState(false);
  const t = useTranslations('CourseEdit.General.Thumbnail');
  const [activeTab, setActiveTab] = useState<TabType>('image');
  const withUnpublishedActivities = course ? course.withUnpublishedActivities : false;

  // Set initial active tab based on thumbnailType
  useEffect(() => {
    if (thumbnailType === 'video') {
      setActiveTab('video');
    } else {
      setActiveTab('image');
    }
  }, [thumbnailType]);

  // Cleanup blob URLs when component unmounts or when thumbnail changes
  useEffect(() => {
    return () => {
      if (localThumbnail?.url) {
        URL.revokeObjectURL(localThumbnail.url);
      }
    };
  }, [localThumbnail]);

  const showError = (message: string) => {
    toast.error(message, {
      duration: 3000,
      position: 'top-center',
    });
  };

  const validateFile = (file: File, type: 'image' | 'video'): boolean => {
    if (type === 'image') {
      if (!VALID_IMAGE_MIME_TYPES.includes(file.type as ValidImageMimeType)) {
        showError(t('errors.invalidMimeType', { fileType: file.type }));
        return false;
      }

      if (file.size > MAX_FILE_SIZE) {
        showError(
          t('errors.fileTooLarge', {
            fileSize: (file.size / 1024 / 1024).toFixed(2),
          }),
        );
        return false;
      }
    } else {
      if (!VALID_VIDEO_MIME_TYPES.includes(file.type as ValidVideoMimeType)) {
        showError(t('errors.invalidVideoMimeType', { fileType: file.type }));
        return false;
      }

      if (file.size > MAX_VIDEO_FILE_SIZE) {
        showError(
          t('errors.videoFileTooLarge', {
            fileSize: (file.size / 1024 / 1024).toFixed(2),
          }),
        );
        return false;
      }
    }

    return true;
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>, type: 'image' | 'video') => {
    const file = event.target.files?.[0];

    if (!file) {
      showError(t('errors.pleaseSelectAFile'));
      return;
    }

    if (!validateFile(file, type)) {
      event.target.value = '';
      return;
    }

    const blobUrl = URL.createObjectURL(file);
    setLocalThumbnail({ file, url: blobUrl, type });
    await updateThumbnail(file, type);
  };

  const handleUnsplashSelect = async (imageUrl: string) => {
    try {
      setIsLoading(true);
      const response = await fetch(imageUrl);
      const blob = await response.blob();

      if (!VALID_IMAGE_MIME_TYPES.includes(blob.type as ValidImageMimeType)) {
        throw new Error(t('errors.unsplashInvalidFormat'));
      }

      const file = new File([blob], `unsplash_${Date.now()}.jpg`, { type: blob.type });

      if (!validateFile(file, 'image')) {
        return;
      }

      const blobUrl = URL.createObjectURL(file);
      setLocalThumbnail({ file, url: blobUrl, type: 'image' });
      await updateThumbnail(file, 'image');
    } catch {
      showError(t('errors.unsplashProcessFailed'));
      setIsLoading(false);
    }
  };

  const updateThumbnail = async (file: File, type: 'image' | 'video') => {
    setIsLoading(true);
    try {
      const formData = new FormData();
      formData.append('thumbnail', file);
      formData.append('thumbnail_type', type);

      const res = await updateCourseThumbnail(
        course.courseStructure.course_uuid,
        formData,
        session.data?.tokens?.access_token,
      );

      await mutate(
        `${getAPIUrl()}courses/${course.courseStructure.course_uuid}/meta?with_unpublished_activities=${withUnpublishedActivities}`,
      );
      await new Promise((r) => setTimeout(r, 1500));

      if (!res.success) {
        showError(res.HTTPmessage);
      } else {
        setLocalThumbnail(null);
        toast.success(t('thumbnailUpdatedSuccessfully'), {
          duration: 3000,
          position: 'top-center',
        });
      }
    } catch {
      showError(t('errors.updateFailed'));
    } finally {
      setIsLoading(false);
    }
  };

  const getThumbnailUrl = (type: 'image' | 'video') => {
    if (type === 'image') {
      return course.courseStructure.thumbnail_image
        ? getCourseThumbnailMediaDirectory(
            org?.org_uuid,
            course.courseStructure.course_uuid,
            course.courseStructure.thumbnail_image,
          )
        : '/empty_thumbnail.webp';
    }
    return course.courseStructure.thumbnail_video
      ? getCourseThumbnailMediaDirectory(
          org?.org_uuid,
          course.courseStructure.course_uuid,
          course.courseStructure.thumbnail_video,
        )
      : undefined;
  };

  const renderThumbnailPreview = () => {
    if (localThumbnail) {
      if (localThumbnail.type === 'video') {
        return (
          <div className="mx-auto max-w-[480px]">
            <video
              src={localThumbnail.url}
              className={`${isLoading ? 'animate-pulse' : ''} aspect-video w-full rounded-lg border border-gray-200 object-cover`}
              controls
            />
          </div>
        );
      }
      return (
        <div className="mx-auto max-w-[480px]">
          <img
            src={localThumbnail.url}
            alt={t('thumbnailPreviewAlt')}
            className={`${isLoading ? 'animate-pulse' : ''} aspect-video w-full rounded-lg border border-gray-200 object-cover`}
          />
        </div>
      );
    }

    const currentThumbnailUrl = getThumbnailUrl(activeTab);
    if (activeTab === 'video' && currentThumbnailUrl) {
      return (
        <div className="mx-auto max-w-[480px]">
          <video
            src={currentThumbnailUrl}
            className="aspect-video w-full rounded-lg border border-gray-200 object-cover"
            controls
          />
        </div>
      );
    }
    if (currentThumbnailUrl) {
      return (
        <div className="mx-auto max-w-[480px]">
          <img
            src={currentThumbnailUrl}
            alt={t('currentThumbnailAlt')}
            className="aspect-video w-full rounded-lg border border-gray-200 object-cover"
          />
        </div>
      );
    }

    return null;
  };

  const renderTabContent = () => {
    if (isLoading) {
      return (
        <div className="mt-4 flex items-center justify-center">
          <div className="flex items-center rounded-full bg-green-50 px-4 py-2 text-sm font-medium text-green-800">
            <ArrowBigUpDash
              size={16}
              className="mr-2 animate-bounce"
            />
            {t('uploading')}
          </div>
        </div>
      );
    }

    if (activeTab === 'image') {
      return (
        <div className="mt-4 flex justify-center gap-2">
          <input
            ref={imageInputRef}
            type="file"
            className="hidden"
            accept=".jpg,.jpeg,.png"
            onChange={(e) => handleFileChange(e, 'image')}
            aria-label={t('ariaLabelImage')}
            title={t('selectImageFile')}
          />
          <Button
            type="button"
            variant="outline"
            className="flex items-center gap-2 px-4 py-2"
            onClick={() => imageInputRef.current?.click()}
          >
            <UploadCloud size={16} />
            {t('uploadImageButton')}
          </Button>
          <Button
            type="button"
            variant="outline"
            className="flex items-center gap-2 px-4 py-2"
            onClick={() => {
              setShowUnsplashPicker(true);
            }}
          >
            <ImageIcon size={16} />
            {t('gallery')}
          </Button>
        </div>
      );
    }

    return (
      <div className="mt-4 flex justify-center gap-2">
        <input
          ref={videoInputRef}
          type="file"
          className="hidden"
          accept=".mp4,.webm"
          onChange={(e) => handleFileChange(e, 'video')}
          aria-label={t('ariaLabelVideo')}
          title={t('selectVideoFile')}
        />
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none"
          onClick={() => videoInputRef.current?.click()}
        >
          <Video size={16} />
          {t('uploadVideo')}
        </button>
      </div>
    );
  };

  return (
    <div className="w-full justify-center rounded-xl bg-white">
      {/* Tabs Navigation */}
      {thumbnailType === 'both' && (
        <div className="flex justify-center border-b border-gray-100">
          <button
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'image'
                ? 'border-b-2 border-blue-600 bg-blue-50/50 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => {
              setActiveTab('image');
            }}
          >
            <ImageIcon size={16} />
            {t('image')}
          </button>
          <button
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab === 'video'
                ? 'border-b-2 border-blue-600 bg-blue-50/50 text-blue-600'
                : 'text-gray-600 hover:text-gray-900'
            }`}
            onClick={() => {
              setActiveTab('video');
            }}
          >
            <Video size={16} />
            {t('video')}
          </button>
        </div>
      )}

      <div className="pt-2 pb-6">
        <div className="space-y-6">
          {renderThumbnailPreview()}
          {renderTabContent()}

          <p className="text-center text-sm text-gray-500">
            {activeTab === 'image' && t('supportedFormats')}
            {activeTab === 'video' && t('supportedVideoFormats')}
          </p>
        </div>
      </div>

      {showUnsplashPicker ? (
        <UnsplashImagePicker
          onSelect={handleUnsplashSelect}
          onClose={() => {
            setShowUnsplashPicker(false);
          }}
        />
      ) : null}
    </div>
  );
};

export default ThumbnailUpdate;
