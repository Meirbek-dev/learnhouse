'use client';

import { useSession } from '@/components/Contexts/SessionProvider';
import { useActivityAutosave } from '@/hooks/useActivityAutosave';

import { PlatformContextProvider } from '@/components/Contexts/PlatformContext';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';
import { toast } from 'sonner';

import Editor from './Editor';

interface EditorWrapperProps {
  content: string | object;
  activity: any;
  course: any;
  platform: any;
}

const EditorWrapper = (props: EditorWrapperProps): JSX.Element => {
  const t = useTranslations('DashPage.Editor.EditorWrapper');
  const { status } = useSession();
  const isReady = status !== 'loading';
  const activityAutosave = useActivityAutosave({
    activityUuid: props.activity.activity_uuid,
    courseUuid: props.course.course_uuid,
  });

  async function setContent(content: any) {
    const { activity } = props;

    const plainContent = structuredClone(content);
    const updatedActivity = { ...activity, content: plainContent };

    toast.promise(activityAutosave.flush(updatedActivity), {
      loading: t('saving'),
      success: () => <b>{t('saveSuccess')}</b>,
      error: (err) => {
        const errorMessage = err?.data?.detail || err?.data?.message || t('saveError');
        const status = err?.status;
        return <b>{status ? t('detailedSaveError', { status, message: errorMessage }) : errorMessage}</b>;
      },
    });
  }

  return (
    <PlatformContextProvider initialPlatform={props.platform}>
      {isReady ? (
        <Editor
          platform={props.platform}
          course={props.course}
          activity={props.activity}
          content={props.content}
          onContentChange={(content) => {
            const plainContent = structuredClone(content);
            const updatedActivity = { ...props.activity, content: plainContent };
            activityAutosave.onChange(updatedActivity);
          }}
          saveState={activityAutosave.saveStatus}
          setContent={setContent}
        />
      ) : null}
    </PlatformContextProvider>
  );
};

export default EditorWrapper;
