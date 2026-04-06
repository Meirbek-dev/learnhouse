import EditorOptionsProvider from '@components/Contexts/Editor/EditorContext';
import { getActivityWithAuthHeader } from '@services/courses/activities';
import EditorWrapper from '@components/Objects/Editor/EditorWrapper';
import { getCourseMetadata } from '@services/courses/courses';
import { getPlatform } from '@/services/platform/platform';
import { getTranslations } from 'next-intl/server';
import { jetBrainsMono } from '@/lib/fonts';
import { connection } from 'next/server';
import type { Metadata } from 'next';
import { getSession } from '@/lib/auth/session';

interface MetadataProps {
  params: Promise<{ courseid: string; activityid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  await connection();
  const params = await props.params;
  const session = await getSession();
  const access_token = session?.accessToken;
  const t = await getTranslations('DashPage.Editor');

  const course_meta = await getCourseMetadata(params.courseid, undefined, access_token ?? null);

  return {
    title: t('metaTitleEdit', { activityName: course_meta.name }),
    description: course_meta.mini_description,
  };
}

const EditActivity = async (props: { params: Promise<{ courseid: string; activityuuid: string }> }) => {
  await connection();
  const params = await props.params;
  const session = await getSession();
  const access_token = session?.accessToken ?? null;
  const { activityuuid, courseid } = params;

  const [courseInfo, activity] = await Promise.all([
    getCourseMetadata(courseid, undefined, access_token),
    getActivityWithAuthHeader(activityuuid, undefined, access_token),
  ]);

  const platform = await getPlatform(access_token || '');

  return (
    <div className={jetBrainsMono.variable}>
      <EditorOptionsProvider options={{ isEditable: true }}>
        <EditorWrapper
          platform={platform}
          course={courseInfo}
          activity={activity}
          content={typeof activity.content === 'string' ? JSON.parse(activity.content) : activity.content}
        />
      </EditorOptionsProvider>
    </div>
  );
};

export default EditActivity;
