import { type CommandProps, Node, mergeAttributes } from '@tiptap/core';

import PDFBlockComponent from './PDFBlockComponent';
import { nodeView } from '@components/Objects/Editor/core';

export interface PdfBlockObject {
  block_uuid: string;
  content: {
    file_id: string;
    file_format: string;
  };
}

export interface PdfBlockAttrs {
  blockObject: PdfBlockObject | null;
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    blockPDF: {
      insertPDFBlock: () => ReturnType;
    };
  }
}

export default Node.create({
  name: 'blockPDF',
  group: 'block',

  atom: true,

  addAttributes() {
    return {
      blockObject: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'block-pdf',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['block-pdf', mergeAttributes(HTMLAttributes), 0];
  },

  addCommands() {
    return {
      insertPDFBlock:
        () =>
        ({ commands }: CommandProps) =>
          commands.insertContent({ type: this.name }),
    };
  },

  addNodeView() {
    return nodeView(PDFBlockComponent);
  },
});
