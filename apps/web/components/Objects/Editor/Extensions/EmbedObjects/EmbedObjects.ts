import { ReactNodeViewRenderer } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';

import EmbedObjectsComponent from './EmbedObjectsComponent';

export default Node.create({
  name: 'blockEmbed',
  group: 'block',
  atom: true,
  draggable: false,

  addAttributes() {
    return {
      embedUrl: {
        default: '',
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute('data-embed-url') || '',
        renderHTML: (attributes) => {
          return { 'data-embed-url': attributes.embedUrl || '' };
        },
      },
      embedCode: {
        default: '',
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute('data-embed-code') || '',
        renderHTML: (attributes) => {
          return { 'data-embed-code': attributes.embedCode || '' };
        },
      },
      embedType: {
        default: 'url',
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute('data-embed-type') || 'url',
        renderHTML: (attributes) => {
          return { 'data-embed-type': attributes.embedType || 'url' };
        },
      },
      embedHeight: {
        default: 300,
        keepOnSplit: false,
        parseHTML: (element) => {
          const height = element.getAttribute('data-embed-height');
          return height ? Number.parseInt(height, 10) : 300;
        },
        renderHTML: (attributes) => {
          return { 'data-embed-height': String(attributes.embedHeight || 300) };
        },
      },
      embedWidth: {
        default: '100%',
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute('data-embed-width') || '100%',
        renderHTML: (attributes) => {
          return { 'data-embed-width': attributes.embedWidth || '100%' };
        },
      },
      alignment: {
        default: 'left',
        keepOnSplit: false,
        parseHTML: (element) => element.getAttribute('data-alignment') || 'left',
        renderHTML: (attributes) => {
          return { 'data-alignment': attributes.alignment || 'left' };
        },
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'block-embed',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return ['block-embed', mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbedObjectsComponent);
  },
});
