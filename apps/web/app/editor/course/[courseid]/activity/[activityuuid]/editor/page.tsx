import { redirect } from 'next/navigation';

import { auth } from '@/auth';
import CodeChallengeConfigEditor from '@components/features/courses/code-challenges/CodeChallengeConfigEditor';

interface PageProps {
  params: Promise<{
    courseid: string;
    activityuuid: string;
  }>;
}

export default async function CodeChallengeEditorPage({ params }: PageProps) {
  const session = await auth();
  const { courseid, activityuuid } = await params;

  if (!session) {
    redirect('/auth/signin');
  }

  return (
    <div className="container mx-auto py-8">
      <CodeChallengeConfigEditor
        activityUuid={activityuuid}
        courseId={courseid}
      />
    </div>
  );
}
