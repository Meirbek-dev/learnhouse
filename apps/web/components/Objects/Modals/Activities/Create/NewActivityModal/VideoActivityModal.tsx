import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { constructAcceptValue } from '@/lib/constants';
import { Checkbox } from '@components/ui/checkbox';
import { Button } from '@components/ui/button';
import { Upload, Youtube } from 'lucide-react';
import * as Form from '@radix-ui/react-form';
import { Label } from '@components/ui/label';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import React, { useState } from 'react';

const SUPPORTED_VIDEO_FILES = constructAcceptValue(['mp4', 'mkv', 'webm']);

interface VideoDetails {
  startTime: number;
  endTime: number | null;
  autoplay: boolean;
  muted: boolean;
}

interface ExternalVideoObject {
  name: string;
  type: string;
  uri: string;
  chapter_id: number;
  details: VideoDetails;
}

const VideoSettingsForm = ({
  videoDetails,
  setVideoDetails,
  t,
}: {
  videoDetails: VideoDetails;
  setVideoDetails: (details: VideoDetails) => void;
  t: any;
}) => {
  const convertToSeconds = (minutes: number, seconds: number) => {
    return minutes * 60 + seconds;
  };

  const convertFromSeconds = (totalSeconds: number) => {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return { minutes, seconds };
  };

  const startTimeParts = convertFromSeconds(videoDetails.startTime);
  const endTimeParts = videoDetails.endTime ? convertFromSeconds(videoDetails.endTime) : { minutes: 0, seconds: 0 };

  return (
    <div className="mt-4 space-y-4 rounded-lg bg-gray-50 p-4">
      <h3 className="mb-3 font-medium text-gray-900">{t('videoSettingsHeading')}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>{t('startTimeLabel')}</Label>
          <div className="mt-1 flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                value={startTimeParts.minutes}
                onChange={(e) => {
                  const minutes = Math.max(0, Number.parseInt(e.target.value, 10) || 0);
                  const { seconds } = startTimeParts;
                  setVideoDetails({
                    ...videoDetails,
                    startTime: convertToSeconds(minutes, seconds),
                  });
                }}
                placeholder={t('minutesPlaceholder')}
                className="w-full"
              />
              <span className="mt-1 block text-xs text-gray-500">{t('minutes')}</span>
            </div>
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                max="59"
                value={startTimeParts.seconds}
                onChange={(e) => {
                  const { minutes } = startTimeParts;
                  const seconds = Math.max(0, Math.min(59, Number.parseInt(e.target.value, 10) || 0));
                  setVideoDetails({
                    ...videoDetails,
                    startTime: convertToSeconds(minutes, seconds),
                  });
                }}
                placeholder={t('secondsPlaceholder')}
                className="w-full"
              />
              <span className="mt-1 block text-xs text-gray-500">{t('seconds')}</span>
            </div>
          </div>
        </div>

        <div>
          <Label>{t('endTimeLabel')}</Label>
          <div className="mt-1 flex gap-2">
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                value={endTimeParts.minutes}
                onChange={(e) => {
                  const minutes = Math.max(0, Number.parseInt(e.target.value, 10) || 0);
                  const { seconds } = endTimeParts;
                  const totalSeconds = convertToSeconds(minutes, seconds);
                  if (totalSeconds > videoDetails.startTime) {
                    setVideoDetails({
                      ...videoDetails,
                      endTime: totalSeconds,
                    });
                  }
                }}
                placeholder={t('secondsPlaceholder')}
                className="w-full"
              />
              <span className="mt-1 block text-xs text-gray-500">{t('minutes')}</span>
            </div>
            <div className="flex-1">
              <Input
                type="number"
                min="0"
                max="59"
                value={endTimeParts.seconds}
                onChange={(e) => {
                  const { minutes } = endTimeParts;
                  const seconds = Math.max(0, Math.min(59, Number.parseInt(e.target.value, 10) || 0));
                  const totalSeconds = convertToSeconds(minutes, seconds);
                  if (totalSeconds > videoDetails.startTime) {
                    setVideoDetails({
                      ...videoDetails,
                      endTime: totalSeconds,
                    });
                  }
                }}
                placeholder={t('secondsPlaceholder')}
                className="w-full"
              />
              <span className="mt-1 block text-xs text-gray-500">{t('seconds')}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center space-x-6">
        <Label className="flex items-center space-x-2">
          <Checkbox
            checked={videoDetails.autoplay}
            onCheckedChange={(checked) => {
              setVideoDetails({
                ...videoDetails,
                autoplay: Boolean(checked),
              });
            }}
          />
          <span className="text-sm text-gray-700">{t('autoplay')}</span>
        </Label>

        <Label className="flex items-center space-x-2">
          <Checkbox
            checked={videoDetails.muted}
            onCheckedChange={(checked) => {
              setVideoDetails({
                ...videoDetails,
                muted: Boolean(checked),
              });
            }}
          />
          <span className="text-sm text-gray-700">{t('startMuted')}</span>
        </Label>
      </div>
    </div>
  );
};

const VideoModal = ({ submitFileActivity, submitExternalVideo, chapterId, course }: any) => {
  const t = useTranslations('Components.VideoModal');
  const [video, setVideo] = React.useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [name, setName] = React.useState('');
  const [youtubeUrl, setYoutubeUrl] = React.useState('');
  const [selectedView, setSelectedView] = React.useState<'file' | 'youtube'>('file');
  const [videoDetails, setVideoDetails] = React.useState<VideoDetails>({
    startTime: 0,
    endTime: null,
    autoplay: false,
    muted: false,
  });
  const [accordionOpen, setAccordionOpen] = useState<string | undefined>('additional-settings');

  const handleVideoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      setVideo(event.target.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      if (selectedView === 'file' && video) {
        await submitFileActivity(
          video,
          'video',
          {
            name,
            chapter_id: chapterId,
            activity_type: 'TYPE_VIDEO',
            activity_sub_type: 'SUBTYPE_VIDEO_HOSTED',
            published_version: 1,
            version: 1,
            course_id: course.id,
            details: videoDetails,
          },
          chapterId,
        );
      }

      if (selectedView === 'youtube') {
        const external_video_object: ExternalVideoObject = {
          name,
          type: 'youtube',
          uri: youtubeUrl,
          chapter_id: chapterId,
          details: videoDetails,
        };

        await submitExternalVideo(external_video_object, 'activity', chapterId);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Form.Root onSubmit={handleSubmit}>
      <div>
        <Label htmlFor="video-activity-name">{t('activityName')}</Label>
        <Input
          id="video-activity-name"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
          type="text"
          required
          placeholder={t('activityNamePlaceholder')}
        />
      </div>

      <div className="mt-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-2 gap-0">
          <button
            type="button"
            onClick={() => {
              setSelectedView('file');
            }}
            className={`flex items-center justify-center gap-2 p-4 ${
              selectedView === 'file'
                ? 'border-primary border-b-2 bg-gray-100'
                : 'border-b border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Upload size={18} />
            <span>{t('uploadVideo')}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setSelectedView('youtube');
            }}
            className={`flex items-center justify-center gap-2 p-4 ${
              selectedView === 'youtube'
                ? 'border-primary border-b-2 bg-gray-100'
                : 'border-b border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Youtube size={18} />
            <span>{t('youtubeVideo')}</span>
          </button>
        </div>

        <div className="p-6">
          {selectedView === 'file' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="video-activity-file">{t('videoFile')}</Label>
                <div className="mt-2">
                  <input
                    id="video-activity-file"
                    type="file"
                    accept={SUPPORTED_VIDEO_FILES}
                    onChange={handleVideoChange}
                    className="hidden"
                    aria-label={t('ariaLabel')}
                    title={t('selectFile')}
                  />
                </div>
                <div className="flex flex-row items-center">
                  <Label
                    htmlFor="video-activity-file"
                    className="bg-primary hover:bg-primary/90 inline-block cursor-pointer rounded-full px-4 py-2 font-semibold text-white"
                  >
                    {t('chooseVideoFile')}
                  </Label>
                  {video ? (
                    <div className="pl-2 text-sm text-green-700">
                      <i>{video.name}</i> {t('fileUploadedSuffix')}
                    </div>
                  ) : null}
                </div>
              </div>
              <VideoSettingsForm
                videoDetails={videoDetails}
                setVideoDetails={setVideoDetails}
                t={t}
              />
            </div>
          )}

          {selectedView === 'youtube' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="youtube-url">{t('youtubeUrl')}</Label>
                <Input
                  id="youtube-url"
                  value={youtubeUrl}
                  onChange={(e) => {
                    setYoutubeUrl(e.target.value);
                  }}
                  type="text"
                  required
                  placeholder={t('youtubeUrlPlaceholder')}
                />
              </div>
              <VideoSettingsForm
                videoDetails={videoDetails}
                setVideoDetails={setVideoDetails}
                t={t}
              />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <BarLoader
              cssOverride={{ borderRadius: '60px' }}
              width={60}
              color="#ffffff"
            />
          ) : (
            t('createActivity')
          )}
        </Button>
      </div>
    </Form.Root>
  );
};

export default VideoModal;
