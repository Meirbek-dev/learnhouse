import { useState, useEffect } from 'react'
import YouTube from 'react-youtube'
import {
  getActivityMediaDirectory,
  getVideoSubtitlesDirectory,
} from '@services/media/media'
import { useOrg } from '@components/Contexts/OrgContext'
import ARTPlayer from './Artplayer'
import { useLocale } from 'next-intl'

interface VideoDetails {
  startTime?: number
  endTime?: number | null
  autoplay?: boolean
  muted?: boolean
}

interface SubtitleEntry {
  html: string
  url: string
}

interface VideoActivityProps {
  activity: {
    activity_sub_type: string
    activity_uuid: string
    content: {
      filename?: string
      uri?: string
    }
    details?: VideoDetails
  }
  course: {
    course_uuid: string
  }
}

function VideoActivity({ activity, course }: VideoActivityProps) {
  const org = useOrg() as any
  const [videoId, setVideoId] = useState('')
  const locale = useLocale()

  const subtitleEntries: SubtitleEntry[] = [
    { html: 'Russian', url: '/subtitle.ru.srt' },
    { html: 'English', url: '/subtitle.en.srt' },
    { html: 'Kazakh', url: '/subtitle.kz.srt' },
  ]

  useEffect(() => {
    if (activity?.content?.uri) {
      const getYouTubeID = require('get-youtube-id')
      setVideoId(getYouTubeID(activity.content.uri))
    }
  }, [activity, org])

  const getVideoSrc = () => {
    if (!activity.content?.filename) return ''
    return getActivityMediaDirectory(
      org?.org_uuid,
      course?.course_uuid,
      activity.activity_uuid,
      activity.content.filename,
      'video'
    )
  }
  const getSubtitlesSrc = () => {
    if (!activity.content?.filename) return ''
    const subDir = getVideoSubtitlesDirectory(
      org?.org_uuid,
      course?.course_uuid,
      activity.activity_uuid,
      activity.content.filename
    )
    return subDir
  }

  return (
    <div className="w-full max-w-full px-2 sm:px-4">
      {activity && (
        <div className="my-3 w-full md:my-5">
          <div className="shadow-xs relative aspect-video w-full overflow-hidden rounded-lg ring-1 ring-gray-300/30 sm:shadow-none sm:ring-gray-200/10 dark:ring-gray-600/30 sm:dark:ring-gray-700/20">
            {activity.activity_sub_type === 'SUBTYPE_VIDEO_HOSTED' && (
              <ARTPlayer
                option={{
                  url: getVideoSrc(),
                  muted: activity.details?.muted,
                  autoplay: activity.details?.autoplay,
                  lang: locale,
                }}
                subtitle={{
                  url: `/subtitle.${locale}.srt`,
                  type: 'srt',
                  style: {
                    color: '#ffffff',
                    fontSize: '20px',
                    backgroundColor: 'rgba(0, 0, 0, 0.5)',
                    textAlign: 'center',
                  },
                  encoding: 'utf-8',
                }}
                subtitleEntries={subtitleEntries}
                className="size-full"
              />
            )}
            {activity.activity_sub_type === 'SUBTYPE_VIDEO_YOUTUBE' && (
              <YouTube
                className="h-full w-full"
                opts={{
                  width: '100%',
                  height: '100%',
                  playerVars: {
                    autoplay: activity.details?.autoplay ? 1 : 0,
                    mute: activity.details?.muted ? 1 : 0,
                    start: activity.details?.startTime || 0,
                    end: activity.details?.endTime || undefined,
                  },
                }}
                videoId={videoId}
              />
            )}
          </div>
        </div>
      )}
    </div>
  )
}

export default VideoActivity
