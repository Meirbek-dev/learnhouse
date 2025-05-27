import { getActivityWithAuthHeader } from '@services/courses/activities'
import { getCourseMetadata } from '@services/courses/courses'
import ActivityClient from './activity'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import type { Metadata } from 'next'
import { getServerSession } from 'next-auth/next'
import { nextAuthOptions } from 'app/auth/options'
import { getTranslations } from 'next-intl/server'

type MetadataProps = {
  params: Promise<{ orgslug: string; courseuuid: string; activityid: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

type Session = {
  tokens?: {
    access_token?: string
  }
}

// Add this function at the top level to avoid duplicate fetches
async function fetchCourseMetadata(
  courseuuid: string,
  access_token: string | null | undefined
) {
  return await getCourseMetadata(
    courseuuid,
    { revalidate: 30, tags: ['courses'] },
    access_token || null
  )
}

export async function generateMetadata(
  props: MetadataProps
): Promise<Metadata> {
  const { orgslug, courseuuid, activityid } = await props.params
  const session = (await getServerSession(nextAuthOptions as any)) as Session
  const access_token = session?.tokens?.access_token || null
  const t = await getTranslations('General')

  // Get Org context information
  const _org = await getOrganizationContextInfo(orgslug, {
    revalidate: 1800,
    tags: ['organizations'],
  })
  const course_meta = await fetchCourseMetadata(courseuuid, access_token)
  const activity = await getActivityWithAuthHeader(
    activityid,
    { revalidate: 1800, tags: ['activities'] },
    access_token || null
  )

  // SEO
  return {
    title: `${activity.name} — ${course_meta.name} ${t('course')}`,
    description: course_meta.description,
    keywords: course_meta.learnings,
    robots: {
      index: true,
      follow: true,
      nocache: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
      },
    },
    openGraph: {
      title: `${activity.name} — ${course_meta.name} ${t('course')}`,
      description: course_meta.description,
      publishedTime: course_meta.creation_date,
      tags: course_meta.learnings,
    },
  }
}

const ActivityPage = async (params: any) => {
  // Destructure params directly
  const { orgslug, courseuuid, activityid } = await params.params
  const session = (await getServerSession(nextAuthOptions as any)) as Session
  const access_token = session?.tokens?.access_token || null

  const [course_meta, activity] = await Promise.all([
    fetchCourseMetadata(courseuuid, access_token),
    getActivityWithAuthHeader(
      activityid,
      { revalidate: 60, tags: ['activities'] },
      access_token || null
    ),
  ])

  return (
    <ActivityClient
      activityid={activityid}
      courseuuid={courseuuid}
      orgslug={orgslug}
      activity={activity}
      course={course_meta}
    />
  )
}

export default ActivityPage
