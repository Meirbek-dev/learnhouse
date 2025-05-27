import { Button } from '@components/ui/button'
import { Input } from '@components/ui/input'
import { Label } from '@components/ui/label'
import type React from 'react'
import { useState } from 'react'
import * as Form from '@radix-ui/react-form'
import BarLoader from 'react-spinners/BarLoader'
import { Youtube, Upload } from 'lucide-react'
import { constructAcceptValue } from '@/lib/constants'
import { useTranslations } from 'next-intl'

const SUPPORTED_FILES = constructAcceptValue(['mp4', 'mkv', 'webm'])

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

  const [video, setVideo] = useState<File | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [name, setName] = useState('')
  const [youtubeUrl, setYoutubeUrl] = useState('')
  const [selectedView, setSelectedView] = useState<'file' | 'youtube'>('file')
  const [videoDetails, setVideoDetails] = useState<VideoDetails>({
    startTime: 0,
    endTime: null,
    autoplay: false,
    muted: false,
  })

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

  const VideoSettingsForm = () => (
    <div className="mt-4 space-y-4 rounded-lg bg-gray-50 p-4">
      <h3 className="mb-3 font-medium text-gray-900">{t('videoSettings')}</h3>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label htmlFor="start-time">{t('startTime')}</Label>
          <Input
            id="start-time"
            type="number"
            min="0"
            value={videoDetails.startTime}
            onChange={(e) =>
              setVideoDetails({
                ...videoDetails,
                startTime: Math.max(0, Number.parseInt(e.target.value) || 0),
              })
            }
            placeholder={t('startTimePlaceholder')}
          />
        </div>

        <div>
          <Label htmlFor="end-time">{t('endTime')}</Label>
          <Input
            id="end-time"
            type="number"
            min={videoDetails.startTime + 1}
            value={videoDetails.endTime || ''}
            onChange={(e) =>
              setVideoDetails({
                ...videoDetails,
                endTime: e.target.value
                  ? Number.parseInt(e.target.value)
                  : null,
              })
            }
            placeholder={t('endTimePlaceholder')}
          />
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
                    accept={SUPPORTED_FILES}
                    onChange={handleVideoChange}
                    required
                    className="w-full text-sm text-gray-500 file:mr-4 file:rounded-full file:border-0 file:bg-black file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-gray-800"
                  />
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
