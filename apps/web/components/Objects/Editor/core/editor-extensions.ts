import type { Extension, Mark, Node } from '@tiptap/core';
import Image from '@tiptap/extension-image';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import { Youtube } from '@tiptap/extension-youtube';
import { StarterKit } from '@tiptap/starter-kit';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';

import Badges from '../Extensions/Badges/Badges';
import Buttons from '../Extensions/Buttons/Buttons';
import EmbedObjects from '../Extensions/EmbedObjects/EmbedObjects';
import Flipcard from '../Extensions/Flipcard/Flipcard';
import ImageBlock from '../Extensions/Image/ImageBlock';
import InfoCallout from '../Extensions/Callout/Info/InfoCallout';
import MathEquationBlock from '../Extensions/MathEquation/MathEquationBlock';
import PDFBlock from '../Extensions/PDF/PDFBlock';
import QuizBlock from '../Extensions/Quiz/QuizBlock';
import Scenarios from '../Extensions/Scenarios/Scenarios';
import UserBlock from '../Extensions/Users/UserBlock';
import VideoBlock from '../Extensions/Video/VideoBlock';
import WarningCallout from '../Extensions/Callout/Warning/WarningCallout';
import WebPreview from '../Extensions/WebPreview/WebPreview';
import { NoTextInput } from '../Extensions/NoTextInput/NoTextInput';
import { getLinkExtension } from '../EditorConf';

import { HeadingWithIds } from './heading-with-ids';
import { SHARED_LOWLIGHT } from './lowlight';

type EditorExtension = Extension | Node | Mark;

export function createBaseEditorExtensions(): EditorExtension[] {
  return [
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
    HeadingWithIds.configure({
      levels: [1, 2, 3, 4, 5, 6],
    }),
    getLinkExtension(),
  ];
}

export function createAuthoringEditorExtensions(activity: any): EditorExtension[] {
  return [
    ...createBaseEditorExtensions(),
    InfoCallout.configure({ editable: true }),
    WarningCallout.configure({ editable: true }),
    ImageBlock.configure({ editable: true, activity }),
    VideoBlock.configure({ editable: true, activity }),
    MathEquationBlock.configure({ editable: true, activity }),
    PDFBlock.configure({ editable: true, activity }),
    QuizBlock.configure({ editable: true, activity }),
    Youtube.configure({ controls: true, modestBranding: true }),
    CodeBlockLowlight.configure({ lowlight: SHARED_LOWLIGHT }),
    EmbedObjects.configure({ editable: true, activity }),
    Badges.configure({ editable: true, activity }),
    Buttons.configure({ editable: true, activity }),
    UserBlock.configure({ editable: true, activity }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    WebPreview.configure({ editable: true, activity }),
    Flipcard.configure({ editable: true, activity }),
    Scenarios.configure({ editable: true, activity }),
  ];
}

export function createInteractiveCanvasExtensions(activity: any): EditorExtension[] {
  return [
    ...createBaseEditorExtensions(),
    NoTextInput.configure({ enabled: true }),
    InfoCallout.configure({ editable: false }),
    WarningCallout.configure({ editable: false }),
    ImageBlock.configure({ editable: false, activity }),
    VideoBlock.configure({ editable: true, activity }),
    MathEquationBlock.configure({ editable: false, activity }),
    PDFBlock.configure({ editable: true, activity }),
    QuizBlock.configure({ editable: false, activity }),
    Youtube.configure({ controls: true, modestBranding: true }),
    CodeBlockLowlight.configure({ lowlight: SHARED_LOWLIGHT }),
    EmbedObjects.configure({ editable: false, activity }),
    Badges.configure({ editable: false, activity }),
    Buttons.configure({ editable: false, activity }),
    UserBlock.configure({ editable: false, activity }),
    Table.configure({ resizable: true }),
    TableRow,
    TableHeader,
    TableCell,
    WebPreview.configure({ editable: true, activity }),
    Flipcard.configure({ editable: false, activity }),
    Scenarios.configure({ editable: false, activity }),
  ];
}

export function createDiscussionEditorExtensions(): EditorExtension[] {
  return [
    StarterKit.configure({
      heading: false,
      bulletList: {
        HTMLAttributes: {
          class: 'list-disc list-outside ml-4 space-y-1',
        },
      },
      orderedList: {
        HTMLAttributes: {
          class: 'list-decimal list-outside ml-4 space-y-1',
        },
      },
      listItem: {
        HTMLAttributes: {
          class: 'ml-0',
        },
      },
      blockquote: {
        HTMLAttributes: {
          class: 'border-l-4 border-gray-300 pl-4 italic',
        },
      },
      code: {
        HTMLAttributes: {
          class: 'bg-gray-100 px-1 py-0.5 rounded text-sm font-mono',
        },
      },
      codeBlock: {
        HTMLAttributes: {
          class: 'bg-gray-100 p-3 rounded-md overflow-x-auto',
        },
      },
      link: {
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-blue-600 hover:text-blue-800 underline',
        },
      },
    }),
    HeadingWithIds.configure({
      levels: [1, 2, 3, 4, 5, 6],
    }),
    Image.configure({
      HTMLAttributes: {
        class: 'max-w-full h-auto rounded-lg',
      },
    }),
    Youtube.configure({
      controls: true,
      modestBranding: true,
      HTMLAttributes: {
        class: 'w-full aspect-video rounded-lg',
      },
    }),
  ];
}
