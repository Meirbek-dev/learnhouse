'use client'
import { useRouter } from 'next/navigation'
import { useIsMobile } from '@/hooks/useIsMobile'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import React from 'react'
import { useTranslations } from 'next-intl'

interface ActivityNavigationProps {
  course: any
  currentActivityId: string
  orgslug: string
}

export default function ActivityNavigation(
  props: ActivityNavigationProps
): React.ReactNode {
  const t = useTranslations('ActivityPage')
  const router = useRouter()
  const isMobile = useIsMobile()
  const [isBottomNavVisible, setIsBottomNavVisible] = React.useState(true)
  const bottomNavRef = React.useRef<HTMLDivElement>(null)
  const [navWidth, setNavWidth] = React.useState<number | null>(null)

  // Function to find the current activity's position in the course
  const findActivityPosition = () => {
    let allActivities: any[] = []
    let currentIndex = -1

    // Flatten all activities from all chapters
    props.course.chapters.forEach((chapter: any) => {
      chapter.activities.forEach((activity: any) => {
        const cleanActivityUuid = activity.activity_uuid?.replace(
          'activity_',
          ''
        )
        allActivities.push({
          ...activity,
          cleanUuid: cleanActivityUuid,
          chapterName: chapter.name,
        })

        // Check if this is the current activity
        if (
          cleanActivityUuid === props.currentActivityId.replace('activity_', '')
        ) {
          currentIndex = allActivities.length - 1
        }
      })
    })

    return { allActivities, currentIndex }
  }

  const { allActivities, currentIndex } = findActivityPosition()

  // Get previous and next activities
  const prevActivity = currentIndex > 0 ? allActivities[currentIndex - 1] : null
  const nextActivity =
    currentIndex < allActivities.length - 1
      ? allActivities[currentIndex + 1]
      : null

  // Navigate to an activity
  const navigateToActivity = (activity: any) => {
    if (!activity) return

    const cleanCourseUuid = props.course.course_uuid?.replace('course_', '')
    router.push(
      getUriWithOrg(props.orgslug, '') +
        `/course/${cleanCourseUuid}/activity/${activity.cleanUuid}`
    )
  }

  // Set up intersection observer to detect when bottom nav is out of viewport
  // and measure the width of the bottom navigation
  React.useEffect(() => {
    if (!bottomNavRef.current) return

    // Update width when component mounts and on window resize
    const updateWidth = () => {
      if (bottomNavRef.current) {
        setNavWidth(bottomNavRef.current.offsetWidth)
      }
    }

    // Initial width measurement
    updateWidth()

    // Set up resize listener
    window.addEventListener('resize', updateWidth)

    const observer = new IntersectionObserver(
      ([entry]) => {
        setIsBottomNavVisible(entry.isIntersecting)
      },
      { threshold: 0.1 }
    )

    observer.observe(bottomNavRef.current)

    return () => {
      window.removeEventListener('resize', updateWidth)
      if (bottomNavRef.current) {
        observer.unobserve(bottomNavRef.current)
      }
    }
  }, [])

  // Navigation buttons component - reused for both top and bottom
  const NavigationButtons = ({ isFloating = false }) => (
    <div
      className={`${isFloating ? 'flex justify-between' : 'grid grid-cols-3'} w-full items-center`}
    >
      {isFloating ? (
        // Floating navigation - original flex layout
        <>
          <button
            onClick={() => navigateToActivity(prevActivity)}
            className={`flex cursor-pointer items-center space-x-1.5 rounded-md p-2 transition-all duration-200 ${
              prevActivity
                ? 'text-gray-700'
                : 'cursor-not-allowed text-gray-400 opacity-50'
            }`}
            disabled={!prevActivity}
            title={
              prevActivity
                ? t('prevActivityTitle', { name: prevActivity.name })
                : t('noPrevActivity')
            }
          >
            <ChevronLeft size={20} className="shrink-0 text-gray-800" />
            <div className="flex flex-col items-start">
              <span className="text-xs text-gray-500">{t('previous')}</span>
              <span className="text-left text-sm font-semibold capitalize">
                {prevActivity ? prevActivity.name : t('noPrevActivity')}
              </span>
            </div>
          </button>

          <button
            onClick={() => navigateToActivity(nextActivity)}
            className={`flex cursor-pointer items-center space-x-1.5 rounded-md p-2 transition-all duration-200 ${
              nextActivity
                ? 'text-gray-700'
                : 'cursor-not-allowed text-gray-400 opacity-50'
            }`}
            disabled={!nextActivity}
            title={
              nextActivity
                ? t('nextActivityTitle', { name: nextActivity.name })
                : t('noNextActivity')
            }
          >
            <div className="flex flex-col items-end">
              <span className="text-xs text-gray-500">{t('next')}</span>
              <span className="text-right text-sm font-semibold capitalize">
                {nextActivity ? nextActivity.name : t('noNextActivity')}
              </span>
            </div>
            <ChevronRight size={20} className="shrink-0 text-gray-800" />
          </button>
        </>
      ) : (
        // Regular navigation - grid layout with centered counter
        <>
          <div className="justify-self-start">
            <button
              onClick={() => navigateToActivity(prevActivity)}
              className={`flex cursor-pointer items-center space-x-1.5 rounded-md px-3.5 py-2 transition-all duration-200 ${
                prevActivity
                  ? 'nice-shadow bg-white text-gray-700'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
              disabled={!prevActivity}
              title={
                prevActivity
                  ? t('prevActivityTitle', { name: prevActivity.name })
                  : t('noPrevActivity')
              }
            >
              <ChevronLeft size={16} className="shrink-0" />
              <div className="flex flex-col items-start">
                <span className="text-xs text-gray-500">{t('previous')}</span>
                <span className="text-left text-sm font-semibold capitalize">
                  {prevActivity ? prevActivity.name : t('noPrevActivity')}
                </span>
              </div>
            </button>
          </div>

          <div className="justify-self-center text-sm text-gray-500">
            {t('activityCounter', {
              current: currentIndex + 1,
              total: allActivities.length,
            })}
          </div>

          <div className="justify-self-end">
            <button
              onClick={() => navigateToActivity(nextActivity)}
              className={`flex cursor-pointer items-center space-x-1.5 rounded-md px-3.5 py-2 transition-all duration-200 ${
                nextActivity
                  ? 'nice-shadow bg-white text-gray-700'
                  : 'cursor-not-allowed bg-gray-100 text-gray-400'
              }`}
              disabled={!nextActivity}
              title={
                nextActivity
                  ? t('nextActivityTitle', { name: nextActivity.name })
                  : t('noNextActivity')
              }
            >
              <div className="flex flex-col items-end">
                <span className="text-xs text-gray-500">{t('next')}</span>
                <span className="text-right text-sm font-semibold capitalize">
                  {nextActivity ? nextActivity.name : t('noNextActivity')}
                </span>
              </div>
              <ChevronRight size={16} className="shrink-0" />
            </button>
          </div>
        </>
      )}
    </div>
  )

  return (
    <>
      {/* Bottom navigation (in-place) */}
      <div ref={bottomNavRef} className="mt-6 mb-2 w-full">
        <NavigationButtons isFloating={false} />
      </div>

      {/* Floating bottom navigation - shown when bottom nav is not visible */}
      {!isBottomNavVisible && (
        <div className="fixed bottom-8 left-1/2 z-50 w-[85%] max-w-lg -translate-x-1/2 transform transition-all duration-300 ease-in-out sm:w-auto sm:min-w-[350px]">
          <div className="animate-in fade-in slide-in-from-bottom rounded-full bg-white/90 px-2.5 py-1.5 shadow-xs backdrop-blur-xl duration-300">
            <NavigationButtons isFloating={true} />
          </div>
        </div>
      )}
    </>
  )
}
