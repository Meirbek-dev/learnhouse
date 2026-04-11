import type { NodeViewProps } from '@tiptap/react';

export type TypedNodeViewProps<TAttrs, TExtensionOptions = Record<string, unknown>> = Omit<
  NodeViewProps,
  'node' | 'extension'
> & {
  node: NodeViewProps['node'] & {
    attrs: TAttrs;
  };
  extension: NodeViewProps['extension'] & {
    options: TExtensionOptions;
  };
};
