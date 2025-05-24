import { useState, useEffect, useRef } from 'react'
import YouTube from 'react-youtube'
import { getActivityMediaDirectory } from '@services/media/media'
import { useOrg } from '@components/Contexts/OrgContext'

interface VideoDetails {
  startTime?: number
  endTime?: number | null
  autoplay?: boolean
  muted?: boolean
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
  const videoRef = useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (activity?.content?.uri) {
      var getYouTubeID = require('get-youtube-id')
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

  // Handle native video time update
  const handleTimeUpdate = () => {
    const video = videoRef.current
    if (video && activity.details?.endTime) {
      if (video.currentTime >= activity.details.endTime) {
        video.pause()
      }
    }
  }

  // Handle native video load
  const handleVideoLoad = () => {
    const video = videoRef.current
    if (video && activity.details) {
      video.currentTime = activity.details.startTime || 0
      video.autoplay = activity.details.autoplay || false
      video.muted = activity.details.muted || false
    }
  }

  return (
    <div className="w-full max-w-full px-2 sm:px-4">
      {activity && (
        <>
          <div className="my-3 w-full md:my-5">
            <div className="relative aspect-video w-full overflow-hidden rounded-lg shadow-xs ring-1 ring-gray-300/30 sm:shadow-none sm:ring-gray-200/10 dark:ring-gray-600/30 sm:dark:ring-gray-700/20">
              {activity.activity_sub_type === 'SUBTYPE_VIDEO_HOSTED' && (
                <video
                  ref={videoRef}
                  className="h-full w-full object-cover"
                  controls
                  src={getVideoSrc()}
                  onLoadedMetadata={handleVideoLoad}
                  onTimeUpdate={handleTimeUpdate}
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
        </>
      )}
    </div>
  )
}

export default VideoActivity
