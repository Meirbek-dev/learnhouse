import MathEquationBlock from '@components/Objects/Editor/Extensions/MathEquation/MathEquationBlock';
import WarningCallout from '@components/Objects/Editor/Extensions/Callout/Warning/WarningCallout';
import { NoTextInput } from '@components/Objects/Editor/Extensions/NoTextInput/NoTextInput';
import EmbedObjects from '@components/Objects/Editor/Extensions/EmbedObjects/EmbedObjects';
import InfoCallout from '@components/Objects/Editor/Extensions/Callout/Info/InfoCallout';
import WebPreview from '@components/Objects/Editor/Extensions/WebPreview/WebPreview';
import VideoBlock from '@components/Objects/Editor/Extensions/Video/VideoBlock';
import ImageBlock from '@components/Objects/Editor/Extensions/Image/ImageBlock';
import UserBlock from '@components/Objects/Editor/Extensions/Users/UserBlock';
import EditorOptionsProvider from '@components/Contexts/Editor/EditorContext';
import QuizBlock from '@components/Objects/Editor/Extensions/Quiz/QuizBlock';
import Buttons from '@components/Objects/Editor/Extensions/Buttons/Buttons';
import PDFBlock from '@components/Objects/Editor/Extensions/PDF/PDFBlock';
import Badges from '@components/Objects/Editor/Extensions/Badges/Badges';
import { getLinkExtension } from '@components/Objects/Editor/EditorConf';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { CustomHeading } from './CustomHeadingExtenstion';
import TableHeader from '@tiptap/extension-table-header';
import { EditorContent, useEditor } from '@tiptap/react';
import ts from 'highlight.js/lib/languages/typescript';
import js from 'highlight.js/lib/languages/javascript';
import python from 'highlight.js/lib/languages/python';
import TableCell from '@tiptap/extension-table-cell';
import java from 'highlight.js/lib/languages/java';
import TableRow from '@tiptap/extension-table-row';
import html from 'highlight.js/lib/languages/xml';
// Custom Extensions
import { useIsMobile } from '@/hooks/useIsMobile';
import { common, createLowlight } from 'lowlight';
import css from 'highlight.js/lib/languages/css';
import AICanvaToolkit from './AI/AICanvaToolkit';
import Youtube from '@tiptap/extension-youtube';
import { Table } from '@tiptap/extension-table';
import TableOfContents from './TableOfContents';
import StarterKit from '@tiptap/starter-kit';
import { styled } from 'styled-components';
import { useMemo } from 'react';

interface Editor {
  content: string;
  activity: any;
}

function Canva(props: Editor) {
  /**
   * Important Note : This is a workaround to enable user interaction features to be implemented easily, like text selection, AI features and other planned features, this is set to true but otherwise it should be set to false.
   * Another workaround is implemented below to disable the editor from being edited by the user by setting the caret-color to transparent and using a custom extension to filter out transactions that add/edit/remove text.
   * To let the various Custom Extensions know that the editor is not editable, React context (EditorOptionsProvider) will be used instead of props.extension.options.editable.
   */
  const isEditable = true;
  const isMobile = useIsMobile();

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
        heading: false,
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
      CustomHeading,
      NoTextInput,
      // Custom Extensions
      InfoCallout.configure({
        editable: isEditable,
      }),
      WarningCallout.configure({
        editable: isEditable,
      }),
      ImageBlock.configure({
        editable: isEditable,
        activity: props.activity,
      }),
      VideoBlock.configure({
        editable: true,
        activity: props.activity,
      }),
      MathEquationBlock.configure({
        editable: false,
        activity: props.activity,
      }),
      PDFBlock.configure({
        editable: true,
        activity: props.activity,
      }),
      QuizBlock.configure({
        editable: isEditable,
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
        editable: isEditable,
        activity: props.activity,
      }),
      Badges.configure({
        editable: isEditable,
        activity: props.activity,
      }),
      Buttons.configure({
        editable: isEditable,
        activity: props.activity,
      }),
      UserBlock.configure({
        editable: isEditable,
        activity: props.activity,
      }),
      Table.configure({
        resizable: true,
      }),
      getLinkExtension(),
      WebPreview.configure({
        editable: true,
        activity: props.activity,
      }),
      TableRow,
      TableHeader,
      TableCell,
    ],
    [props.activity, lowlightConfig, isEditable],
  );

  const editor: any = useEditor({
    editable: isEditable,
    immediatelyRender: false,
    extensions,
    content: props.content,
  });

  return (
    <EditorOptionsProvider options={{ isEditable: false }}>
      <CanvaWrapper>
        <AIToolkitWrapper>
          <AICanvaToolkit
            activity={props.activity}
            editor={editor}
          />
        </AIToolkitWrapper>
        <ContentWrapper>
          {!isMobile && <TableOfContents editor={editor} />}
          <EditorContent editor={editor} />
        </ContentWrapper>
      </CanvaWrapper>
    </EditorOptionsProvider>
  );
}

const CanvaWrapper = styled.div`
  width: 100%;
  margin: 0 auto;
  position: relative;
`;

const AIToolkitWrapper = styled.div`
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  pointer-events: none;
  z-index: 1000;

  // Allow pointer events for the bubble menu content
  * {
    pointer-events: auto;
  }
`;

const ContentWrapper = styled.div`
  display: flex;
  width: 100%;
  height: 100%;

  // Default: when TableOfContents has content, it takes 20% and editor takes 80%
  > div:first-child:not(:empty) {
    flex-shrink: 0;
    width: 20%;
    padding-right: 1rem;
  }

  > div:last-child {
    flex: 1;
  }

  // When TableOfContents is empty, editor takes full width
  > div:first-child:empty {
    width: 0;
    padding-right: 0;
    overflow: hidden;
  }

  > div:first-child:empty + div {
    width: 100%;
  }

  .ProseMirror {
    flex: 1;
    padding: 1rem;
    font-family: var(--font-inter), Inter, system-ui, 'Segoe UI', Arial, sans-serif;
    font-size: 1.1rem;
    color: #222;
    // disable chrome outline
    caret-color: transparent;

    h1 {
      font-size: 32px;
      font-weight: 600;
      margin-bottom: 24px;
    }

    h2 {
      font-size: 28px;
      font-weight: 600;
      margin-bottom: 24px;
    }

    h3 {
      font-size: 24px;
      font-weight: 600;
      margin-bottom: 24px;
    }

    h4 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 24px;
    }

    h5 {
      font-size: 18px;
      font-weight: 600;
      margin-bottom: 24px;
    }

    // Link styling
    a {
      color: #2563eb;
      text-decoration: underline;
      cursor: pointer;
      transition: color 0.2s ease;

      &:hover {
        color: #1d4ed8;
        text-decoration: none;
      }
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

    &:focus {
      outline: none !important;
      outline-style: none !important;
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
  }
`;

export default Canva;
