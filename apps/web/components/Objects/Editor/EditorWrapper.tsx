'use client';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import Toast from '@components/Objects/StyledElements/Toast/Toast';
import { OrgProvider } from '@components/Contexts/OrgContext';
import { updateActivity } from '@services/courses/activities';
import { type JSX, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import Editor from './Editor';

interface EditorWrapperProps {
  content: string;
  activity: any;
  course: any;
  org: any;
}

function EditorWrapper(props: EditorWrapperProps): JSX.Element {
  const t = useTranslations('DashPage.Editor.EditorWrapper');
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!session.isLoading) {
      setIsReady(true);
    }
  }, [session.isLoading]);

  async function setContent(content: any) {
    const activity = props.activity;
    activity.content = content;

    toast.promise(
      updateActivity(activity, activity.activity_uuid, access_token).then((res) => {
        if (!res.success) {
          throw res;
        }
        return res;
      }),
      {
        loading: t('saving'),
        success: () => <b>{t('saveSuccess')}</b>,
        error: (err) => {
          const errorMessage = err?.data?.detail || err?.data?.message || t('saveError');
          const status = err?.status;
          return <b>{status ? t('detailedSaveError', { status, message: errorMessage }) : errorMessage}</b>;
        },
      },
    );
  }

  return (
    <>
      <Toast />
      <OrgProvider orgslug={props.org.slug}>
        {isReady && (
          <Editor
            org={props.org}
            course={props.course}
            activity={props.activity}
            content={props.content}
            setContent={setContent}
            session={session}
          />
        )}
      </OrgProvider>
    </>
  );
}

export default EditorWrapper;
