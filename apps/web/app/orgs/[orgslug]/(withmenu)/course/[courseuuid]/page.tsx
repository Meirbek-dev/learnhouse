import CourseClient from './course'
import { getCourseMetadata } from '@services/courses/courses'
import { getOrganizationContextInfo } from '@services/organizations/orgs'
import type { Metadata } from 'next'
import { getCourseThumbnailMediaDirectory } from '@services/media/media'
import { nextAuthOptions } from 'app/auth/options'
import { getServerSession } from 'next-auth/next'
import { getTranslations } from 'next-intl/server'

type MetadataProps = {
  params: Promise<{ orgslug: string; courseuuid: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  props: MetadataProps
): Promise<Metadata> {
  const params = await props.params
  const session = await getServerSession(nextAuthOptions)
  const access_token = session?.tokens?.access_token
  const tGeneral = await getTranslations('General')

  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 1800,
    tags: ['organizations'],
  })
  const course_meta = await getCourseMetadata(
    params.courseuuid,
    { revalidate: 1800, tags: ['courses'] },
    access_token ? access_token : null
  )

  // SEO
  return {
    title: `${course_meta.name} — ${tGeneral('course')} — ${org.name}`,
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
      title: `${course_meta.name} — ${org.name}`,
      description: course_meta.description ? course_meta.description : '',
      images: [
        {
          url: getCourseThumbnailMediaDirectory(
            org?.org_uuid,
            course_meta?.course_uuid,
            course_meta?.thumbnail_image
          ),
          width: 800,
          height: 600,
          alt: course_meta.name,
        },
      ],
      type: 'article',
      publishedTime: course_meta.creation_date ? course_meta.creation_date : '',
      tags: course_meta.learnings ? course_meta.learnings : [],
    },
  }
}

const CoursePage = async (params: any) => {
  const session = await getServerSession(nextAuthOptions)
  const access_token = session?.tokens?.access_token

  // Fetch course metadata once
  const awaitedParams = await params.params
  const course_meta = await getCourseMetadata(
    awaitedParams.courseuuid,
    { revalidate: 0, tags: ['courses'] },
    access_token ? access_token : null
  )

  return (
    <CourseClient
      courseuuid={awaitedParams.courseuuid}
      orgslug={awaitedParams.orgslug}
      course={course_meta}
      access_token={access_token}
    />
  )
}

export default CoursePage
