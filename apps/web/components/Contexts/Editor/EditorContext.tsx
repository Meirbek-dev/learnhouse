'use client';
import { createContext, use, useState } from 'react';
import type { ReactNode } from 'react';

export const EditorProviderContext = createContext(null) as any;

interface EditorProviderProps {
  children: ReactNode;
  options: EditorProviderState;
}

interface EditorProviderState {
  isEditable: boolean;
}

const EditorOptionsProvider = ({ children, options }: EditorProviderProps) => {
  const [editorOptions, _setEditorOptions] = useState<EditorProviderState>(options);

  return <EditorProviderContext value={editorOptions}>{children}</EditorProviderContext>;
};

export default EditorOptionsProvider;

export function useEditorProvider() {
  return use(EditorProviderContext);
}
