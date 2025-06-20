import { getCourseMetadata } from '@services/courses/courses'
import type { Metadata } from 'next'
import { getActivityWithAuthHeader } from '@services/courses/activities'
import { getOrganizationContextInfoWithId } from '@services/organizations/orgs'
import EditorOptionsProvider from '@components/Contexts/Editor/EditorContext'
import AIEditorProvider from '@components/Contexts/AI/AIEditorContext'
import { nextAuthOptions } from 'app/auth/options'
import { getServerSession } from 'next-auth/next'
import EditorWrapper from '@components/Objects/Editor/EditorWrapper'
import { getTranslations } from 'next-intl/server'

type MetadataProps = {
  params: Promise<{ orgslug: string; courseid: string; activityid: string }>
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>
}

export async function generateMetadata(
  props: MetadataProps
): Promise<Metadata> {
  const params = await props.params
  const session = await getServerSession(nextAuthOptions)
  const access_token = session?.tokens?.access_token
  const t = await getTranslations('DashPage.Editor')

  const course_meta = await getCourseMetadata(
    params.courseid,
    { revalidate: 60, tags: ['courses'] },
    access_token ?? null
  )

  return {
    title: t('metaTitleEdit', { activityName: course_meta.name }),
    description: course_meta.mini_description,
  }
}

const EditActivity = async (props: {
  params: Promise<{ courseid: string; activityuuid: string }>
}) => {
  const params = await props.params
  const session = await getServerSession(nextAuthOptions)
  const access_token = session?.tokens?.access_token
  const { activityuuid, courseid } = params

  // This Promise.all() is correct as it handles two promises
  const [courseInfo, activity] = await Promise.all([
    getCourseMetadata(
      courseid,
      { revalidate: 0, tags: ['courses'] },
      access_token ?? null
    ),
    getActivityWithAuthHeader(
      activityuuid,
      { revalidate: 0, tags: ['activities'] },
      access_token ?? null
    ),
  ])

  const org = await getOrganizationContextInfoWithId(
    courseInfo.org_id,
    {
      revalidate: 180,
      tags: ['organizations'],
    },
    access_token
  )

  return (
    <EditorOptionsProvider options={{ isEditable: true }}>
      <AIEditorProvider>
        <EditorWrapper
          org={org}
          course={courseInfo}
          activity={activity}
          content={activity.content}
        />
      </AIEditorProvider>
    </EditorOptionsProvider>
  )
}

export default EditActivity
