import { getOrganizationContextInfoWithId } from '@services/organizations/orgs';
import EditorOptionsProvider from '@components/Contexts/Editor/EditorContext';
import { getActivityWithAuthHeader } from '@services/courses/activities';
import AIEditorProvider from '@components/Contexts/AI/AIEditorContext';
import EditorWrapper from '@components/Objects/Editor/EditorWrapper';
import { getCourseMetadata } from '@services/courses/courses';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';
import { auth } from '@/auth';

interface MetadataProps {
  params: Promise<{ orgslug: string; courseid: string; activityid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  const session = await auth();
  const access_token = session?.tokens?.access_token;
  const t = await getTranslations('DashPage.Editor');

  const course_meta = await getCourseMetadata(
    params.courseid,
    { revalidate: 60, tags: ['courses'] },
    access_token ?? null,
  );

  return {
    title: t('metaTitleEdit', { activityName: course_meta.name }),
    description: course_meta.mini_description,
  };
}

const EditActivity = async (props: { params: Promise<{ courseid: string; activityuuid: string }> }) => {
  const params = await props.params;
  const session = await auth();
  const access_token = session?.tokens?.access_token ?? null;
  const { activityuuid, courseid } = params;

  const [courseInfo, activity] = await Promise.all([
  getCourseMetadata(courseid, { cache: 'no-store', tags: ['courses'] }, access_token),
  getActivityWithAuthHeader(activityuuid, { cache: 'no-store', tags: ['activities'] }, access_token),
  ]);

  const org = await getOrganizationContextInfoWithId(
    courseInfo.org_id,
    {
      revalidate: 180,
      tags: ['organizations'],
    },
    access_token || '',
  );

  return (
    <div className="font-mono">
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
    </div>
  );
};

export default EditActivity;
