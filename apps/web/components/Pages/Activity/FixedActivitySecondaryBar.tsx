'use client'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { getUriWithOrg } from '@services/config/config'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState, useRef } from 'react'
import ActivityChapterDropdown from './ActivityChapterDropdown'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { useOrg } from '@components/Contexts/OrgContext'
import { useTranslations } from 'next-intl'

interface FixedActivitySecondaryBarProps {
  course: any
  currentActivityId: string
  orgslug: string
  activity: any
}

export default function FixedActivitySecondaryBar(
  props: FixedActivitySecondaryBarProps
): React.ReactNode {
  const t = useTranslations('FixedActivitySecondaryBar')
  const router = useRouter()
  const [isScrolled, setIsScrolled] = useState(false)
  const [shouldShow, setShouldShow] = useState(false)
  const mainActivityInfoRef = useRef<HTMLDivElement | null>(null)
  const org = useOrg() as any

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

  // Handle scroll and intersection observer
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 0)
    }

    // Set up intersection observer for the main activity info
    const observer = new IntersectionObserver(
      ([entry]) => {
        // Show the fixed bar when the main info is not visible
        setShouldShow(!entry.isIntersecting)
      },
      {
        threshold: [0, 0.1, 1],
        rootMargin: '-80px 0px 0px 0px', // Increased margin to account for the header
      }
    )

    // Start observing the main activity info section with a slight delay to ensure DOM is ready
    setTimeout(() => {
      const mainActivityInfo = document.querySelector('.activity-info-section')
      if (mainActivityInfo) {
        mainActivityInfoRef.current = mainActivityInfo as HTMLDivElement
        observer.observe(mainActivityInfo)
      }
    }, 100)

    window.addEventListener('scroll', handleScroll)

    return () => {
      window.removeEventListener('scroll', handleScroll)
      if (mainActivityInfoRef.current) {
        observer.unobserve(mainActivityInfoRef.current)
      }
    }
  }, [])

  return (
    <>
      {shouldShow && (
        <div
          className={`animate-in fade-in slide-in-from-top fixed top-[60px] right-0 left-0 z-40 bg-white/90 backdrop-blur-xl transition-all duration-300 ${
            isScrolled ? 'nice-shadow' : ''
          }`}
        >
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between py-2">
              {/* Left Section - Course Info and Navigation */}
              <div className="flex min-w-0 flex-shrink items-center space-x-2 sm:space-x-4">
                <img
                  className="h-[20px] w-[35px] flex-shrink-0 rounded-md object-cover sm:h-[26px] sm:w-[45px]"
                  src={`${getCourseThumbnailMediaDirectory(
                    org?.org_uuid,
                    props.course.course_uuid,
                    props.course.thumbnail_image
                  )}`}
                  alt=""
                />
                <ActivityChapterDropdown
                  course={props.course}
                  currentActivityId={props.currentActivityId}
                  orgslug={props.orgslug}
                />
                <div className="flex hidden min-w-0 flex-col -space-y-0.5 sm:block">
                  <p className="text-sm font-medium text-gray-500">
                    {t('course')}
                  </p>
                  <h1 className="truncate text-base font-semibold text-gray-900">
                    {props.course.name}
                  </h1>
                </div>
              </div>

              {/* Right Section - Navigation Controls */}
              <div className="flex flex-shrink-0 items-center">
                <div className="flex items-center space-x-2 sm:space-x-3">
                  <button
                    onClick={() => navigateToActivity(prevActivity)}
                    className={`flex items-center space-x-1 rounded-md px-1.5 py-1.5 transition-all duration-200 sm:space-x-2 sm:px-2 ${
                      prevActivity
                        ? 'text-gray-700 hover:bg-gray-100'
                        : 'cursor-not-allowed text-gray-300'
                    }`}
                    disabled={!prevActivity}
                    title={
                      prevActivity
                        ? t('prevActivityTitle', { name: prevActivity.name })
                        : t('noPrevActivity')
                    }
                  >
                    <ChevronLeft size={16} className="shrink-0 sm:h-5 sm:w-5" />
                    <div className="flex hidden flex-col items-start sm:flex">
                      <span className="text-xs text-gray-500">
                        {t('previous')}
                      </span>
                      <span className="max-w-[100px] truncate text-left text-sm font-medium sm:max-w-[150px]">
                        {prevActivity ? prevActivity.name : t('noPrevActivity')}
                      </span>
                    </div>
                  </button>

                  <span className="px-1 text-sm font-medium text-gray-500 sm:px-2">
                    {t('activityCounter', {
                      current: currentIndex + 1,
                      total: allActivities.length,
                    })}
                  </span>

                  <button
                    onClick={() => navigateToActivity(nextActivity)}
                    className={`flex items-center space-x-1 rounded-md px-1.5 py-1.5 transition-all duration-200 sm:space-x-2 sm:px-2 ${
                      nextActivity
                        ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        : 'cursor-not-allowed text-gray-300'
                    }`}
                    disabled={!nextActivity}
                    title={
                      nextActivity
                        ? t('nextActivityTitle', { name: nextActivity.name })
                        : t('noNextActivity')
                    }
                  >
                    <div className="flex hidden flex-col items-end sm:flex">
                      <span
                        className={`text-xs ${nextActivity ? 'text-gray-500' : 'text-gray-500'}`}
                      >
                        {t('next')}
                      </span>
                      <span className="max-w-[100px] truncate text-right text-sm font-medium sm:max-w-[150px]">
                        {nextActivity ? nextActivity.name : t('noNextActivity')}
                      </span>
                    </div>
                    <ChevronRight
                      size={16}
                      className="shrink-0 sm:h-5 sm:w-5"
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
