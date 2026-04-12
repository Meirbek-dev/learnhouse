import { Editor } from '@tiptap/core';
import { afterEach, describe, expect, it } from 'vitest';

import { createAuthoringEditorExtensions } from '../../components/Objects/Editor/core';

const activity = {
  activity_uuid: 'activity_123',
  name: 'Sample activity',
};

function createEditor() {
  return new Editor({
    editable: true,
    extensions: createAuthoringEditorExtensions(activity),
    content: { type: 'doc', content: [{ type: 'paragraph' }] },
  });
}

const runtimeCases = [
  { title: 'info callout', run: (editor: Editor) => editor.commands.insertInfoCallout(), expectedType: 'calloutInfo' },
  {
    title: 'warning callout',
    run: (editor: Editor) => editor.commands.insertWarningCallout(),
    expectedType: 'calloutWarning',
  },
  { title: 'badge', run: (editor: Editor) => editor.commands.insertBadge(), expectedType: 'badge' },
  { title: 'button', run: (editor: Editor) => editor.commands.insertButton(), expectedType: 'button' },
  { title: 'embed object', run: (editor: Editor) => editor.commands.insertEmbedObject(), expectedType: 'blockEmbed' },
  { title: 'flipcard', run: (editor: Editor) => editor.commands.insertFlipcard(), expectedType: 'flipcard' },
  { title: 'image block', run: (editor: Editor) => editor.commands.insertImageBlock(), expectedType: 'blockImage' },
  {
    title: 'math equation',
    run: (editor: Editor) => editor.commands.insertMathEquation(),
    expectedType: 'blockMathEquation',
  },
  { title: 'pdf block', run: (editor: Editor) => editor.commands.insertPDFBlock(), expectedType: 'blockPDF' },
  { title: 'quiz block', run: (editor: Editor) => editor.commands.insertQuizBlock(), expectedType: 'blockQuiz' },
  { title: 'scenario block', run: (editor: Editor) => editor.commands.insertScenarios(), expectedType: 'scenarios' },
  { title: 'user block', run: (editor: Editor) => editor.commands.insertUserBlock(), expectedType: 'blockUser' },
  { title: 'video block', run: (editor: Editor) => editor.commands.insertVideoBlock(), expectedType: 'blockVideo' },
  {
    title: 'web preview',
    run: (editor: Editor) => editor.commands.insertWebPreview(),
    expectedType: 'blockWebPreview',
  },
];

describe('custom block runtime commands', () => {
  let editor: Editor | null = null;

  afterEach(() => {
    editor?.destroy();
    editor = null;
  });

  for (const testCase of runtimeCases) {
    it(`inserts ${testCase.title}`, () => {
      editor = createEditor();

      expect(testCase.run(editor)).toBe(true);

      const doc = editor.getJSON();
      expect(doc.content?.[0]?.type).toBe(testCase.expectedType);
    });
  }
});
