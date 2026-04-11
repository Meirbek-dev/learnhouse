import { Plugin, PluginKey } from '@tiptap/pm/state';
import { Extension } from '@tiptap/core';

export const NoTextInput = Extension.create({
  name: 'selectionOnlyInput',

  addOptions() {
    return {
      enabled: true,
    };
  },

  addProseMirrorPlugins() {
    if (!this.options.enabled) {
      return [];
    }

    return [
      new Plugin({
        key: new PluginKey('selectionOnlyInput'),
        filterTransaction: (transaction) => {
          // Block all content-changing transactions
          return !transaction.docChanged;
        },
      }),
    ];
  },
});
