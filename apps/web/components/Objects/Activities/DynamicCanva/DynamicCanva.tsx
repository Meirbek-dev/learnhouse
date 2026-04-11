import EditorOptionsProvider from '@components/Contexts/Editor/EditorContext';
import { EditorContent, useEditor } from '@tiptap/react';
import AICanvaToolkit from './AI/AICanvaToolkit';
import { useIsMobile } from '@/hooks/use-mobile';
import { createInteractiveCanvasExtensions, normalizeTiptapJsonContent } from '@components/Objects/Editor/core';
import TableOfContents from './TableOfContents';
import styles from './DynamicCanva.module.css';

interface Editor {
  content: unknown;
  activity: any;
}

const Canva = (props: Editor) => {
  /**
   * Important Note : This is a workaround to enable user interaction features to be implemented easily, like text selection, AI features and other planned features, this is set to true but otherwise it should be set to false.
   * Another workaround is implemented below to disable the editor from being edited by the user by setting the caret-color to transparent and using a custom extension to filter out transactions that add/edit/remove text.
   * To let the various Custom Extensions know that the editor is not editable, React context (EditorOptionsProvider) will be used instead of props.extension.options.editable.
   */
  const isEditable = true;
  const isMobile = useIsMobile();
  const extensions = createInteractiveCanvasExtensions(props.activity);

  const editor = useEditor({
    editable: isEditable,
    immediatelyRender: false,
    extensions,
    content: normalizeTiptapJsonContent(props.content),
  });

  return (
    <EditorOptionsProvider options={{ isEditable: false, mode: 'interactive' }}>
      <div className="relative mx-auto w-full">
        <div className="pointer-events-none absolute inset-0 z-[1000] [&>*]:pointer-events-auto">
          {editor ? (
            <AICanvaToolkit
              activity={props.activity}
              editor={editor}
            />
          ) : null}
        </div>
        <div className={styles.contentWrapper}>
          {!isMobile && <TableOfContents editor={editor} />}
          <EditorContent editor={editor} />
        </div>
      </div>
    </EditorOptionsProvider>
  );
};

export default Canva;
