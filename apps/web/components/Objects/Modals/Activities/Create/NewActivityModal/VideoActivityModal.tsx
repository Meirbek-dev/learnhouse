import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { Label } from '@components/ui/label'
import React, { useState } from 'react'
import * as Form from '@radix-ui/react-form'
import BarLoader from 'react-spinners/BarLoader'
import { Youtube, Upload } from 'lucide-react'
import { constructAcceptValue } from '@/lib/constants'
import { useTranslations } from 'next-intl'

const SUPPORTED_VIDEO_FILES = constructAcceptValue(['mp4', 'mkv', 'webm'])

interface VideoDetails {
  startTime: number
  endTime: number | null
  autoplay: boolean
  muted: boolean
}

interface ExternalVideoObject {
  name: string
  type: string
  uri: string
  chapter_id: string
  details: VideoDetails
}

function VideoModal({
  submitFileActivity,
  submitExternalVideo,
  chapterId,
  course,
}: any) {
  const t = useTranslations('Components.VideoModal')
  const [video, setVideo] = React.useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = React.useState('')
  const [youtubeUrl, setYoutubeUrl] = React.useState('')
  const [selectedView, setSelectedView] = React.useState<'file' | 'youtube'>(
    'file'
  )
  const [videoDetails, setVideoDetails] = React.useState<VideoDetails>({
    startTime: 0,
    endTime: null,
    autoplay: false,
    muted: false,
  })
  const [accordionOpen, setAccordionOpen] = useState<string | undefined>(
    'additional-settings'
  )

  const handleVideoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files?.[0]) {
      setVideo(event.target.files[0])
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    try {
      if (selectedView === 'file' && video) {
        await submitFileActivity(
          video,
          'video',
          {
            name: name,
            chapter_id: chapterId,
            activity_type: 'TYPE_VIDEO',
            activity_sub_type: 'SUBTYPE_VIDEO_HOSTED',
            published_version: 1,
            version: 1,
            course_id: course.id,
            details: videoDetails,
          },
          chapterId
        )
      }

      if (selectedView === 'youtube') {
        const external_video_object: ExternalVideoObject = {
          name,
          type: 'youtube',
          uri: youtubeUrl,
          chapter_id: chapterId,
          details: videoDetails,
        }

        await submitExternalVideo(external_video_object, 'activity', chapterId)
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  const VideoSettingsForm = () => {
    const convertToSeconds = (minutes: number, seconds: number) => {
      return minutes * 60 + seconds
    }

    const convertFromSeconds = (totalSeconds: number) => {
      const minutes = Math.floor(totalSeconds / 60)
      const seconds = totalSeconds % 60
      return { minutes, seconds }
    }

    const startTimeParts = convertFromSeconds(videoDetails.startTime)
    const endTimeParts = videoDetails.endTime
      ? convertFromSeconds(videoDetails.endTime)
      : { minutes: 0, seconds: 0 }

    return (
      <div className="mt-4 space-y-4 rounded-lg bg-gray-50 p-4">
        <h3 className="mb-3 font-medium text-gray-900">
          {t('videoSettingsHeading')}
        </h3>
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
                    const minutes = Math.max(0, parseInt(e.target.value) || 0)
                    const seconds = startTimeParts.seconds
                    setVideoDetails({
                      ...videoDetails,
                      startTime: convertToSeconds(minutes, seconds),
                    })
                  }}
                  placeholder={t('minutesPlaceholder')}
                  className="w-full"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Minutes
                </span>
              </div>
              <div className="flex-1">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={startTimeParts.seconds}
                  onChange={(e) => {
                    const minutes = startTimeParts.minutes
                    const seconds = Math.max(
                      0,
                      Math.min(59, parseInt(e.target.value) || 0)
                    )
                    setVideoDetails({
                      ...videoDetails,
                      startTime: convertToSeconds(minutes, seconds),
                    })
                  }}
                  placeholder={t('secondsPlaceholder')}
                  className="w-full"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Seconds
                </span>
              </div>
            </div>
          </div>

          <div>
            <Label>{t('endTimeLabel')} (optional)</Label>
            <div className="mt-1 flex gap-2">
              <div className="flex-1">
                <Input
                  type="number"
                  min="0"
                  value={endTimeParts.minutes}
                  onChange={(e) => {
                    const minutes = Math.max(0, parseInt(e.target.value) || 0)
                    const seconds = endTimeParts.seconds
                    const totalSeconds = convertToSeconds(minutes, seconds)
                    if (totalSeconds > videoDetails.startTime) {
                      setVideoDetails({
                        ...videoDetails,
                        endTime: totalSeconds,
                      })
                    }
                  }}
                  placeholder={t('secondsPlaceholder')}
                  className="w-full"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Minutes
                </span>
              </div>
              <div className="flex-1">
                <Input
                  type="number"
                  min="0"
                  max="59"
                  value={endTimeParts.seconds}
                  onChange={(e) => {
                    const minutes = endTimeParts.minutes
                    const seconds = Math.max(
                      0,
                      Math.min(59, parseInt(e.target.value) || 0)
                    )
                    const totalSeconds = convertToSeconds(minutes, seconds)
                    if (totalSeconds > videoDetails.startTime) {
                      setVideoDetails({
                        ...videoDetails,
                        endTime: totalSeconds,
                      })
                    }
                  }}
                  placeholder={t('secondsPlaceholder')}
                  className="w-full"
                />
                <span className="mt-1 block text-xs text-gray-500">
                  Seconds
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex items-center space-x-6">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={videoDetails.autoplay}
              onChange={(e) =>
                setVideoDetails({
                  ...videoDetails,
                  autoplay: e.target.checked,
                })
              }
              className="rounded border-gray-300 text-black focus:ring-black"
            />
            <span className="text-sm text-gray-700">{t('autoplay')}</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={videoDetails.muted}
              onChange={(e) =>
                setVideoDetails({
                  ...videoDetails,
                  muted: e.target.checked,
                })
              }
              className="rounded border-gray-300 text-black focus:ring-black"
            />
            <span className="text-sm text-gray-700">{t('startMuted')}</span>
          </label>
        </div>
      </div>
    )
  }

  return (
    <Form.Root onSubmit={handleSubmit}>
      <div>
        <Label htmlFor="video-activity-name">{t('activityName')}</Label>
        <Input
          id="video-activity-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          type="text"
          required
          placeholder={t('activityNamePlaceholder')}
        />
      </div>

      <div className="mt-4 rounded-lg border border-gray-200">
        <div className="grid grid-cols-2 gap-0">
          <button
            type="button"
            onClick={() => setSelectedView('file')}
            className={`flex items-center justify-center gap-2 p-4 ${
              selectedView === 'file'
                ? 'border-b-2 border-black bg-gray-100'
                : 'border-b border-gray-200 hover:bg-gray-50'
            }`}
          >
            <Upload size={18} />
            <span>{t('uploadVideo')}</span>
          </button>
          <button
            type="button"
            onClick={() => setSelectedView('youtube')}
            className={`flex items-center justify-center gap-2 p-4 ${
              selectedView === 'youtube'
                ? 'border-b-2 border-black bg-gray-100'
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
                  />
                </div>
                <div className="flex flex-row items-center">
                  <Label
                    htmlFor="video-activity-file"
                    className="inline-block cursor-pointer rounded-full bg-black px-4 py-2 font-semibold text-white hover:bg-gray-800"
                  >
                    {t('chooseVideoFile')}
                  </Label>
                  {video && (
                    <div className="pl-2 text-sm text-green-700">
                      <i>{video.name}</i> {t('fileUploadedSuffix')}
                    </div>
                  )}
                </div>
              </div>
              <VideoSettingsForm />
            </div>
          )}

          {selectedView === 'youtube' && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="youtube-url">{t('youtubeUrl')}</Label>
                <Input
                  id="youtube-url"
                  value={youtubeUrl}
                  onChange={(e) => setYoutubeUrl(e.target.value)}
                  type="text"
                  required
                  placeholder={t('youtubeUrlPlaceholder')}
                />
              </div>
              <VideoSettingsForm />
            </div>
          )}
        </div>
      </div>

      <div className="mt-6 flex justify-end">
        <Button
          type="submit"
          disabled={isSubmitting}
          className="bg-black text-white hover:bg-black/90"
        >
          {isSubmitting ? (
            <BarLoader
              cssOverride={{ borderRadius: 60 }}
              width={60}
              color="#ffffff"
            />
          ) : (
            t('createActivity')
          )}
        </Button>
      </div>
    </Form.Root>
  )
}

export default VideoModal
