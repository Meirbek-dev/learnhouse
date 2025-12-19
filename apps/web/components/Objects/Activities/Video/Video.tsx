import ArtPlayer from '@components/Objects/Activities/Video/Artplayer';
import { getActivityMediaDirectory } from '@services/media/media';
import { useOrg } from '@components/Contexts/OrgContext';
import type ArtplayerType from 'artplayer';
import { useLocale } from 'next-intl';
import YouTube from 'react-youtube';


// Function to extract YouTube video ID from various YouTube URL formats
function getYouTubeID(url: string): string | null {
  if (!url) return null;

  const regex = /(?:youtube\.com\/(?:[^/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[&?]v=)|youtu\.be\/)([^\s"&/?]{11})/;
  const match = url.match(regex);

  return match?.[1] || null;
}

interface VideoDetails {
  startTime?: number;
  endTime?: number | null;
  autoplay?: boolean;
  muted?: boolean;
  subtitles?: {
    language: string;
    filename: string;
    label: string;
    url: string;
  }[];
}

interface SubtitleEntry {
  html: string;
  url: string;
}

interface VideoActivityProps {
  activity: {
    activity_sub_type: string;
    activity_uuid: string;
    content: {
      filename?: string;
      uri?: string;
    };
    details?: VideoDetails;
  };
  course: {
    course_uuid: string;
  };
}

const VideoActivity = ({ activity, course }: VideoActivityProps) => {
  const org = useOrg() as any;
  const fullLocale = useLocale();
  const locale = fullLocale.split('-')[0];

  // Extract YouTube ID from activity content
  const videoId = activity?.content?.uri ? getYouTubeID(activity.content.uri) || '' : '';

  // Generate subtitle entries from activity details
  const subtitleEntries: SubtitleEntry[] = (activity?.details?.subtitles || [])
    .map((subtitle) => {
      const url = getActivityMediaDirectory(
        org?.org_uuid,
        course?.course_uuid,
        activity.activity_uuid,
        subtitle.filename,
        'video',
      );
      return url ? { html: subtitle.label, url } : null;
    })
    .filter((entry): entry is SubtitleEntry => entry !== null);

  // Get default subtitle URL for current locale
  const getDefaultSubtitleUrl = () => {
    const subtitles = activity?.details?.subtitles || [];
    const defaultSubtitle = subtitles.find((s) => s.language === locale);
    if (defaultSubtitle) {
      return getActivityMediaDirectory(
        org?.org_uuid,
        course?.course_uuid,
        activity.activity_uuid,
        defaultSubtitle.filename,
        'video',
      );
    }
    return '';
  };

  const getVideoSrc = () => {
    if (!activity.content?.filename) return '';
    return getActivityMediaDirectory(
      org?.org_uuid,
      course?.course_uuid,
      activity.activity_uuid,
      activity.content.filename,
      'video',
    );
  };

  return (
    <div className="w-full max-w-full px-2 sm:px-4">
      {activity ? (
        <div className="my-3 w-full md:my-5">
          <div className="relative aspect-video w-full overflow-hidden rounded-lg shadow-xs ring-1 ring-gray-300/30 sm:shadow-none sm:ring-gray-200/10 dark:ring-gray-600/30 sm:dark:ring-gray-700/20">
            {activity.activity_sub_type === 'SUBTYPE_VIDEO_HOSTED' && (
              <ArtPlayer
                option={{
                  url: getVideoSrc(),
                  muted: activity.details?.muted,
                  autoplay: activity.details?.autoplay,
                  lang: locale,
                  pip: false,
                }}
                subtitle={
                  getDefaultSubtitleUrl()
                    ? {
                        url: getDefaultSubtitleUrl(),
                        type: 'srt',
                        style: {
                          color: '#ffffff',
                          fontSize: '2.5rem',
                          backgroundColor: 'rgba(0, 0, 0, 0.8)',
                          textAlign: 'center',
                        },
                        encoding: 'utf8',
                      }
                    : undefined
                }
                locale={locale}
                subtitleEntries={subtitleEntries}
                className="size-full"
                startTime={activity.details?.startTime}
                endTime={activity.details?.endTime}
                onPlayerReady={(_art: ArtplayerType) => {}}
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
                    controls: 1,
                    modestbranding: 1,
                    rel: 0,
                  },
                }}
                videoId={videoId}
                onReady={(event) => {
                  if (activity.details?.startTime) {
                    event.target.seekTo(activity.details.startTime, true);
                  }
                }}
              />
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default VideoActivity;
