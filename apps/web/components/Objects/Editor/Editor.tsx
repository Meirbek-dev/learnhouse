'use client';
import { type AIEditorStateTypes, useAIEditor, useAIEditorDispatch } from '@components/Contexts/AI/AIEditorContext';

import { DividerVerticalIcon, SlashIcon } from '@radix-ui/react-icons';

import { ToolbarButtons } from './Toolbar/ToolbarButtons';

// Extensions
import QuizBlock from './Extensions/Quiz/QuizBlock';

// Lowlight
const lowlight = createLowlight(common);
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import Table from '@tiptap/extension-table';
import TableCell from '@tiptap/extension-table-cell';
import TableHeader from '@tiptap/extension-table-header';
import TableRow from '@tiptap/extension-table-row';
import Youtube from '@tiptap/extension-youtube';
import { EditorContent, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { motion } from 'framer-motion';
import css from 'highlight.js/lib/languages/css';
import java from 'highlight.js/lib/languages/java';
import js from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import ts from 'highlight.js/lib/languages/typescript';
import html from 'highlight.js/lib/languages/xml';
import { common, createLowlight } from 'lowlight';
import { Eye, Monitor } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { styled } from 'styled-components';

import { useIsMobile } from '@/hooks/useIsMobile';
import { CourseProvider } from '@components/Contexts/CourseContext';
import useGetAIFeatures from '@components/Hooks/useGetAIFeatures';
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip';
import { getUriWithOrg } from '@services/config/config';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import touEmblemLight from 'public/tou_emblem_light.png';

import UserAvatar from '../UserAvatar';

import AIEditorToolkit from './AI/AIEditorToolkit';
import { getLinkExtension } from './EditorConf';
import Badges from './Extensions/Badges/Badges';
import Buttons from './Extensions/Buttons/Buttons';
import InfoCallout from './Extensions/Callout/Info/InfoCallout';
import WarningCallout from './Extensions/Callout/Warning/WarningCallout';
import EmbedObjects from './Extensions/EmbedObjects/EmbedObjects';
import ImageBlock from './Extensions/Image/ImageBlock';
import MathEquationBlock from './Extensions/MathEquation/MathEquationBlock';
import PDFBlock from './Extensions/PDF/PDFBlock';
import UserBlock from './Extensions/Users/UserBlock';
import VideoBlock from './Extensions/Video/VideoBlock';
import WebPreview from './Extensions/WebPreview/WebPreview';

interface EditorProps {
  content: string;
  activity: any;
  course: any;
  org: any;
  session: any;
  setContent: (content: any) => void;
}

function Editor(props: EditorProps) {
  const t = useTranslations('DashPage.Editor.Editor');

  // Add defensive checks for context hooks
  let dispatchAIEditor: any = null;
  let aiEditorState: AIEditorStateTypes | null = null;

  dispatchAIEditor = useAIEditorDispatch() as any;
  aiEditorState = useAIEditor() as AIEditorStateTypes;

  const is_ai_feature_enabled = useGetAIFeatures({ feature: 'editor' });
  const [isButtonAvailable, setIsButtonAvailable] = useState(false);

  useEffect(() => {
    if (is_ai_feature_enabled) {
      setIsButtonAvailable(true);
    }
  }, [is_ai_feature_enabled]);

  // Memoize course and activity IDs
  const courseUuid = useMemo(() => props.course.course_uuid.slice(7), [props.course.course_uuid]);
  const activityUuid = useMemo(() => props.activity.activity_uuid.slice(9), [props.activity.activity_uuid]);

  // Memoize lowlight configuration
  const lowlightConfig = useMemo(() => {
    const lowlight = createLowlight(common);
    lowlight.register('html', html);
    lowlight.register('css', css);
    lowlight.register('js', js);
    lowlight.register('ts', ts);
    lowlight.register('python', python);
    lowlight.register('java', java);
    return lowlight;
  }, []);

  // Memoize editor extensions
  const extensions = useMemo(
    () => [
      StarterKit.configure({
        codeBlock: false,
        bulletList: {
          HTMLAttributes: {
            class: 'bullet-list',
          },
        },
        orderedList: {
          HTMLAttributes: {
            class: 'ordered-list',
          },
        },
      }),
      InfoCallout.configure({
        editable: true,
      }),
      WarningCallout.configure({
        editable: true,
      }),
      ImageBlock.configure({
        editable: true,
        activity: props.activity,
      }),
      VideoBlock.configure({
        editable: true,
        activity: props.activity,
      }),
      MathEquationBlock.configure({
        editable: true,
        activity: props.activity,
      }),
      PDFBlock.configure({
        editable: true,
        activity: props.activity,
      }),
      QuizBlock.configure({
        editable: true,
        activity: props.activity,
      }),
      Youtube.configure({
        controls: true,
        modestBranding: true,
      }),
      CodeBlockLowlight.configure({
        lowlight: lowlightConfig,
      }),
      EmbedObjects.configure({
        editable: true,
        activity: props.activity,
      }),
      Badges.configure({
        editable: true,
        activity: props.activity,
      }),
      Buttons.configure({
        editable: true,
        activity: props.activity,
      }),
      UserBlock.configure({
        editable: true,
        activity: props.activity,
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      getLinkExtension(),
      WebPreview.configure({
        editable: true,
        activity: props.activity,
      }),
    ],
    [props.activity, lowlightConfig],
  );

  const editor: any = useEditor({
    editable: true,
    extensions,
    content: props.content,
    immediatelyRender: false,
  });

  // Destructure setContent for stable reference
  const { setContent } = props;

  // Memoize content update handler
  const handleContentSave = useCallback(() => {
    if (editor) {
      setContent(editor.getJSON());
    }
  }, [editor, setContent]);

  const isMobile = useIsMobile();
  if (isMobile) {
    // TODO: Work on a better editor mobile experience
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f8f8f8] p-4">
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
    <Page>
      <CourseProvider courseuuid={props.course.course_uuid}>
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
          <EditorTop className="fixed bg-white bg-opacity-95 backdrop-blur-sm backdrop-brightness-125">
            <EditorDocSection>
              <EditorInfoWrapper>
                <Link href="/">
                  <EditorInfoOpenULogo
                    width={25}
                    height={25}
                    src={touEmblemLight}
                    alt="OpenU Logo"
                  />
                </Link>
                <Link
                  target="_blank"
                  href={`/course/${courseUuid}`}
                >
                  <EditorInfoThumbnail
                    src={`${
                      props.course.thumbnail_image
                        ? getCourseThumbnailMediaDirectory(
                            props.org?.org_uuid,
                            props.course.course_uuid,
                            props.course.thumbnail_image,
                          )
                        : getUriWithOrg(props.org?.slug, '/empty_thumbnail.png')
                    }`}
                    alt={`${props.course.name} Thumbnail`}
                  />
                </Link>
                <EditorInfoDocName>
                  {' '}
                  <b>{props.course.name}</b> <SlashIcon /> {props.activity.name}{' '}
                </EditorInfoDocName>
              </EditorInfoWrapper>
              <EditorButtonsWrapper>
                <ToolbarButtons editor={editor} />
              </EditorButtonsWrapper>
            </EditorDocSection>
            <EditorUsersSection className="space-x-2">
              <div>
                <div className="rounded-md text-teal-100 transition-all ease-linear hover:cursor-pointer">
                  {isButtonAvailable && dispatchAIEditor && aiEditorState && (
                    <div
                      onClick={() =>
                        dispatchAIEditor({
                          type: aiEditorState.isModalOpen ? 'setIsModalClose' : 'setIsModalOpen',
                        })
                      }
                      style={{
                        background:
                          'conic-gradient(from 32deg at 53.75% 50%, rgb(35, 40, 93) 4deg, rgba(20, 0, 52, 0.95) 59deg, rgba(66, 35, 202, 0.88) 281deg)',
                      }}
                      className="flex items-center space-x-1 rounded-md px-3 py-2 text-sm text-white drop-shadow-md transition delay-150 duration-300 ease-in-out hover:scale-105 hover:cursor-pointer"
                      title={t('aiEditor')}
                    >
                      <i>
                        <Image
                          className=""
                          width={24}
                          src={touEmblemLight}
                          alt="AI Editor Icon"
                        />
                      </i>
                      <i className="text-xs font-bold not-italic">{t('aiEditor')}</i>
                    </div>
                  )}
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
              <EditorLeftOptionsSection className="space-x-2">
                <div
                  className="rounded-lg bg-sky-600 px-3 py-2 text-sm font-black text-teal-100 shadow-sm transition-all ease-linear hover:cursor-pointer hover:bg-sky-700"
                  onClick={handleContentSave}
                >
                  {' '}
                  {t('save')}{' '}
                </div>
                <ToolTip content={t('preview')}>
                  <Link
                    target="_blank"
                    href={`/course/${courseUuid}/activity/${activityUuid}`}
                  >
                    <div className="flex h-9 items-center justify-center rounded-lg bg-neutral-600 px-3 py-2 text-sm font-black text-neutral-100 shadow-sm transition-all ease-linear hover:cursor-pointer hover:bg-neutral-700">
                      <Eye
                        className="mx-auto items-center"
                        size={15}
                      />
                    </div>
                  </Link>
                </ToolTip>
              </EditorLeftOptionsSection>
              <DividerVerticalIcon
                style={{
                  marginTop: 'auto',
                  marginBottom: 'auto',
                  color: 'grey',
                  opacity: '0.5',
                }}
              />

              <EditorUserProfileWrapper>
                <UserAvatar
                  border="border-4"
                  use_with_session
                  width={45}
                />
              </EditorUserProfileWrapper>
            </EditorUsersSection>
          </EditorTop>
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
          <EditorContentWrapper>
            <AIEditorToolkit
              activity={props.activity}
              editor={editor}
            />
            <EditorContent editor={editor} />
          </EditorContentWrapper>
        </motion.div>
      </CourseProvider>
    </Page>
  );
}

const Page = styled.div`
  height: 100vh;
  width: 100%;
  padding-top: 30px;

  // dots background
  background-image: radial-gradient(#4744446b 1px, transparent 1px), radial-gradient(#4744446b 1px, transparent 1px);
  background-position:
    0 0,
    25px 25px;
  background-size: 50px 50px;
  background-attachment: fixed;
  background-repeat: repeat;
`;

const EditorTop = styled.div`
  border-radius: 15px;
  margin: 40px;
  margin-top: 0px;
  margin-bottom: 20px;
  padding: 10px;
  display: flex;
  justify-content: space-between;
  box-shadow: 0px 4px 16px rgba(0, 0, 0, 0.03);
  position: fixed;
  z-index: 303;
  width: -webkit-fill-available;
  width: -moz-available;
`;

// Inside EditorTop
const EditorDocSection = styled.div`
  display: flex;
  flex-direction: column;
`;
const EditorUsersSection = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
`;

const EditorLeftOptionsSection = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
`;

// Inside EditorDocSection
const EditorInfoWrapper = styled.div`
  display: flex;
  flex-direction: row;
  margin-bottom: 5px;
`;
const EditorButtonsWrapper = styled.div``;

// Inside EditorUsersSection
const EditorUserProfileWrapper = styled.div`
  padding-right: 8px;
  svg {
    border-radius: 7px;
  }
`;

// Inside EditorInfoWrapper
// ..todo
const EditorInfoOpenULogo = styled(Image)`
  border-radius: 6px;
  margin-right: 0px;
`;
const EditorInfoDocName = styled.div`
  font-size: 16px;
  justify-content: center;
  align-items: center;
  display: flex;
  margin-left: 10px;
  color: #494949;

  svg {
    margin-right: 4px;
    margin-left: 4px;
    padding: 3px;
    color: #353535;
  }
`;

const EditorInfoThumbnail = styled.img`
  height: 25px;
  width: 56px;
  object-fit: cover;
  object-position: top;
  border-radius: 7px;
  margin-left: 5px;

  &:hover {
    cursor: pointer;
  }
`;

export const EditorContentWrapper = styled.div`
  margin: 40px;
  margin-top: 90px;
  background-color: white;
  border-radius: 10px;
  z-index: 300;
  box-shadow: 0px 4px 16px rgba(0, 0, 0, 0.03);

  // disable chrome outline

  .ProseMirror {
    font-family: var(--font-inter), Inter, system-ui, 'Segoe UI', Arial, sans-serif;
    font-size: 1.1rem;
    color: #222;

    h1,
    h2,
    h3,
    h4,
    h5 {
      font-family: inherit;
      font-weight: 700;
      letter-spacing: 0.01em;
      line-height: 1.2;
      color: #18181b;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 2.25rem;
    }
    h2 {
      font-size: 2rem;
    }
    h3 {
      font-size: 1.5rem;
    }
    h4 {
      font-size: 1.25rem;
    }
    h5 {
      font-size: 1.125rem;
    }

    a {
      color: #1a0dab;
      text-decoration: underline;
      cursor: pointer;
      transition: color 0.2s ease;

      &:hover,
      &:focus {
        color: #0b0080;
        text-decoration: underline;
        outline: 2px solid #0b0080;
        outline-offset: 2px;
      }
    }
    padding: 20px;

    &:focus {
      outline: none !important;
      box-shadow: none !important;
    }

    // Code Block
    pre {
      padding: 0.75rem 1rem;
      color: #fff;
      font-family: var(--font-jetbrains-mono), monospace;
      background: #0d0d0d;
      border-radius: 0.5rem;

      code {
        padding: 0;
        color: inherit;
        font-size: 0.8rem;
        background: none;
      }

      .hljs-comment,
      .hljs-quote {
        color: #616161;
      }

      .hljs-variable,
      .hljs-template-variable,
      .hljs-attribute,
      .hljs-tag,
      .hljs-name,
      .hljs-regexp,
      .hljs-link,
      .hljs-name,
      .hljs-selector-id,
      .hljs-selector-class {
        color: #f98181;
      }

      .hljs-number,
      .hljs-meta,
      .hljs-built_in,
      .hljs-builtin-name,
      .hljs-literal,
      .hljs-type,
      .hljs-params {
        color: #fbbc88;
      }

      .hljs-string,
      .hljs-symbol,
      .hljs-bullet {
        color: #b9f18d;
      }

      .hljs-title,
      .hljs-section {
        color: #faf594;
      }

      .hljs-keyword,
      .hljs-selector-tag {
        color: #70cff8;
      }

      .hljs-emphasis {
        font-style: italic;
      }

      .hljs-strong {
        font-weight: 700;
      }
    }

    &.resize-cursor {
      cursor: ew-resize;
      cursor: col-resize;
    }

    .tableWrapper {
      margin: 1.5rem 0;
      overflow-x: auto;
    }
  }

  iframe {
    display: block;
    width: 100%;
    min-width: 200px;
    height: 440px;
    min-height: 200px;
    border: none;
    border-radius: 6px;
    outline: 0px solid transparent;
  }

  ul,
  ol {
    padding: 0 1rem;
    padding-left: 20px;
  }

  ul {
    list-style-type: disc;
  }

  ol {
    list-style-type: decimal;
  }

  table {
    width: 100%;
    margin: 0;
    overflow: hidden;
    table-layout: fixed;
    border-collapse: collapse;

    td,
    th {
      position: relative;
      box-sizing: border-box;
      min-width: 1em;
      padding: 6px 8px;
      vertical-align: top;
      border: 1px solid rgba(139, 139, 139, 0.4);

      > * {
        margin-bottom: 0;
      }
    }

    th {
      font-weight: bold;
      text-align: left;
      background-color: rgba(217, 217, 217, 0.4);
    }

    .selectedCell:after {
      position: absolute;
      top: 0;
      right: 0;
      bottom: 0;
      left: 0;
      z-index: 2;
      background: rgba(139, 139, 139, 0.2);
      content: '';
      pointer-events: none;
    }

    .column-resize-handle {
      position: absolute;
      top: 0;
      right: -2px;
      bottom: -2px;
      width: 4px;
      background-color: #8d78eb;
      pointer-events: none;
    }
  }
`;

export default Editor;
