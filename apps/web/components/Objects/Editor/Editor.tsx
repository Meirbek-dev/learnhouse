'use client';

import { ActivityAIChatProvider } from '@components/Contexts/AI/ActivityAIChatContext';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import DividerVerticalIcon from '@components/svg/DividerVerticalIcon';
import ToolTip from '@/components/Objects/Elements/Tooltip/Tooltip';
import { CourseProvider } from '@components/Contexts/CourseContext';
import platformLogoLight from '@public/platform_logo_light.svg';
import { ToolbarButtons } from './Toolbar/ToolbarButtons';
import { EditorContent, useEditor } from '@tiptap/react';
import platformLogo from '@public/platform_logo.svg';
import AIEditorToolkit from './AI/AIEditorToolkit';
import { useIsMobile } from '@/hooks/use-mobile';
import { Eye, Monitor } from 'lucide-react';
import { createAuthoringEditorExtensions, normalizeTiptapJsonContent } from '@components/Objects/Editor/core';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import styles from './Editor.module.css';
import UserAvatar from '../UserAvatar';
import type { ReactNode } from 'react';
import { motion } from 'motion/react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import Image from 'next/image';

interface EditorProps {
  content: unknown;
  activity: any;
  course: any;
  platform: any;
  onContentChange: (content: any) => void;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  setContent: (content: any) => void;
}

const Editor = (props: EditorProps) => {
  const t = useTranslations('DashPage.Editor.Editor');
  const tWrapper = useTranslations('DashPage.Editor.EditorWrapper');
  const [isAIOpen, setIsAIOpen] = useState(false);

  const courseUuid = props.course.course_uuid.slice(7);
  const activityUuid = props.activity.activity_uuid.slice(9);
  const extensions = createAuthoringEditorExtensions(props.activity);

  const editor = useEditor({
    editable: true,
    extensions,
    content: normalizeTiptapJsonContent(props.content),
    immediatelyRender: false,
    onUpdate: ({ editor: currentEditor }) => {
      props.onContentChange(currentEditor.getJSON());
    },
  });

  // Destructure setContent for stable reference
  const { setContent } = props;

  function handleContentSave() {
    if (editor) {
      setContent(editor.getJSON());
    }
  }

  const isMobile = useIsMobile();
  if (isMobile) {
    // TODO: Work on a better editor mobile experience
    return (
      <div className="bg-muted flex h-screen w-full items-center justify-center p-4">
        <div className="rounded-lg bg-white p-6 text-center shadow-md">
          <h2 className="mb-4 text-xl font-bold">{t('mobileTitle')}</h2>
          <Monitor
            className="mx-auto my-5"
            size={60}
          />
          <p>{t('mobileMessage1')}</p>
          <p>{t('mobileMessage2')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <CourseProvider courseuuid={props.course.course_uuid}>
        <ActivityAIChatProvider activityUuid={props.activity.activity_uuid}>
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            key="modal"
            transition={{
              type: 'spring',
              stiffness: 360,
              damping: 70,
              delay: 0.02,
            }}
            exit={{ opacity: 0 }}
          >
            <div
              className={cn(styles.editorTop, 'bg-opacity-95 fixed bg-white backdrop-blur-sm backdrop-brightness-125')}
            >
              <div className="flex flex-col">
                <div className="mb-[5px] flex flex-row">
                  <Link href="/">
                    <Image
                      className="rounded-[6px]"
                      width={25}
                      height={25}
                      src={platformLogo}
                      alt="Ashyq Bilim logo"
                    />
                  </Link>
                  <Link
                    target="_blank"
                    href={`/course/${courseUuid}`}
                  >
                    <Image
                      className="ml-[5px] rounded-[7px] object-cover object-top hover:cursor-pointer"
                      width={56}
                      height={25}
                      src={
                        props.course.thumbnail_image
                          ? getCourseThumbnailMediaDirectory(props.course.course_uuid, props.course.thumbnail_image)
                          : '/empty_thumbnail.webp'
                      }
                      alt={`${props.course.name} Thumbnail`}
                    />
                  </Link>
                  <div className={styles.editorInfoDocName}>
                    <b>{props.course.name}</b> <DividerVerticalIcon className="size-7" /> {props.activity.name}{' '}
                  </div>
                </div>
                <div>
                  <ToolbarButtons editor={editor} />
                </div>
              </div>
              <div className="flex items-center justify-center space-x-2">
                <div>
                  <div className="rounded-md text-teal-100 transition-all ease-linear hover:cursor-pointer">
                    <div
                      onClick={() => setIsAIOpen((prev) => !prev)}
                      style={{
                        background:
                          'linear-gradient(135deg, oklch(0.25 0.15 270) 0%, oklch(0.40 0.18 260) 50%, oklch(0.32 0.16 255) 100%)',
                      }}
                      className="flex items-center space-x-1 rounded-md px-3 py-2 text-sm text-white drop-shadow-md transition delay-150 duration-300 ease-in-out hover:scale-105 hover:cursor-pointer"
                      title={t('aiEditor')}
                    >
                      <Image
                        className=""
                        width={16}
                        height={16}
                        src={platformLogoLight}
                        alt="AI Editor Icon"
                      />
                      <i className="text-xs font-bold not-italic">{t('aiEditor')}</i>
                    </div>
                  </div>
                </div>
                <DividerVerticalIcon
                  style={{
                    marginTop: 'auto',
                    marginBottom: 'auto',
                    color: 'grey',
                    opacity: '0.5',
                  }}
                />
                <div className="flex items-center justify-center space-x-2">
                  <div className="border-border bg-muted text-muted-foreground rounded-lg border px-3 py-2 text-xs font-semibold">
                    {props.saveState === 'saving'
                      ? tWrapper('saving')
                      : props.saveState === 'saved'
                        ? tWrapper('saveSuccess')
                        : props.saveState === 'error'
                          ? tWrapper('saveError')
                          : t('save')}
                  </div>
                  <div
                    className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-bold text-teal-100 shadow-sm transition-all ease-linear hover:cursor-pointer hover:bg-sky-700"
                    onClick={handleContentSave}
                  >
                    {t('save')}
                  </div>
                  <ToolTip content={t('preview')}>
                    <Link
                      target="_blank"
                      href={`/course/${courseUuid}/activity/${activityUuid}`}
                    >
                      <div className="flex h-9 items-center justify-center rounded-lg bg-neutral-600 px-3 py-2 text-sm font-bold text-neutral-100 shadow-sm transition-all ease-linear hover:cursor-pointer hover:bg-neutral-700">
                        <Eye
                          className="mx-auto items-center"
                          size={14}
                        />
                      </div>
                    </Link>
                  </ToolTip>
                </div>
                <DividerVerticalIcon
                  style={{
                    marginTop: 'auto',
                    marginBottom: 'auto',
                    color: 'grey',
                    opacity: '0.5',
                  }}
                />

                <div className={styles.editorUserProfileWrapper}>
                  <UserAvatar
                    size="lg"
                    variant="outline"
                    use_with_session
                  />
                </div>
              </div>
            </div>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{
              type: 'spring',
              stiffness: 360,
              damping: 70,
              delay: 0.5,
            }}
            exit={{ opacity: 0 }}
          >
            <div className={styles.editorContentWrapper}>
              {editor ? (
                <AIEditorToolkit
                  activity={props.activity}
                  editor={editor}
                  isOpen={isAIOpen}
                  onClose={() => setIsAIOpen(false)}
                />
              ) : null}
              <EditorContent editor={editor} />
            </div>
          </motion.div>
        </ActivityAIChatProvider>
      </CourseProvider>
    </div>
  );
};

export default Editor;

export const EditorContentWrapper = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn(styles.editorContentWrapper, className)}>{children}</div>
);
