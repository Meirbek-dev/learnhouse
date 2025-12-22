'use client';

import { usePlatformSession } from '@components/Contexts/LHSessionContext';

import { OrgProvider } from '@components/Contexts/OrgContext';
import { updateActivity } from '@services/courses/activities';
import { useTranslations } from 'next-intl';
import type { JSX } from 'react';
import { toast } from 'sonner';

import { Toaster } from '@components/ui/sonner';
import Editor from './Editor';

interface EditorWrapperProps {
  content: string;
  activity: any;
  course: any;
  org: any;
}

const EditorWrapper = (props: EditorWrapperProps): JSX.Element => {
  const t = useTranslations('DashPage.Editor.EditorWrapper');
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const isReady = !session.isLoading;

  async function setContent(content: any) {
    const { activity } = props;

    // CRITICAL: Deep clone and ensure plain object before server action call
    // Next.js server action serialization can corrupt Tiptap JSON if not plain
    const plainContent = JSON.parse(JSON.stringify(content));
    const updatedActivity = { ...activity, content: plainContent };

    // Debug: log whether the content contains blockEmbed nodes and the outgoing content size + snippet
    try {
      const payloadStr = JSON.stringify(content);
      const updatedStr = JSON.stringify(updatedActivity.content);
      const containsEmbed = payloadStr.includes('blockEmbed');
      console.info('[EditorWrapper] Saving activity', {
        activity_uuid: activity.activity_uuid,
        containsEmbed,
        originalContentSize: payloadStr.length,
        updatedActivityContentSize: updatedStr.length,
        contentSnippet: payloadStr.slice(0, 500),
        updatedActivitySnippet: updatedStr.slice(0, 500),
      });
    } catch (e) {
      console.info('[EditorWrapper] Error serializing content for debug', e);
    }

    toast.promise(
      updateActivity(updatedActivity, activity.activity_uuid, access_token).then((res) => {
        // Debug: log server response metadata for investigation
        console.info('[EditorWrapper] updateActivity response', res);
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
      <Toaster />
      <OrgProvider orgslug={props.org.slug}>
        {isReady ? (
          <Editor
            org={props.org}
            course={props.course}
            activity={props.activity}
            content={props.content}
            setContent={setContent}
            session={session}
          />
        ) : null}
      </OrgProvider>
    </>
  );
};

export default EditorWrapper;
