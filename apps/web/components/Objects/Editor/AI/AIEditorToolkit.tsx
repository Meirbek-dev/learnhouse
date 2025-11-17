import {
  AlertTriangle,
  BetweenHorizontalStart,
  FastForward,
  Feather,
  FileStack,
  HelpCircle,
  Languages,
  Lightbulb,
  MoreVertical,
  X,
} from 'lucide-react';
import { sendActivityAIChatMessageStream, startActivityAIChatSessionStream } from '@services/ai/ai-streaming';
import { useAIEditor, useAIEditorDispatch } from '@components/Contexts/AI/AIEditorContext';
import type { CritisizeScope } from '@components/Contexts/AI/AIEditorContext';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import useGetAIFeatures from '@components/Hooks/useGetAIFeatures';
import platformLogoLight from 'public/platform_logo_light.svg';
import { AnimatePresence, motion } from 'framer-motion';
import type { ChangeEvent, KeyboardEvent } from 'react';
import type { Editor } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import Image from 'next/image';

interface AIEditorToolkitProps {
  editor: Editor;
  activity: any;
}

interface AIPromptsLabels {
  label: 'Writer' | 'ContinueWriting' | 'MakeLonger' | 'GenerateQuiz' | 'Translate' | 'Critisize';
  selection: string;
  scope?: CritisizeScope;
}

const AIEditorToolkit = (props: AIEditorToolkitProps) => {
  const dispatchAIEditor = useAIEditorDispatch();
  const aiEditorState = useAIEditor();
  const t = useTranslations('Activities.AIEditorToolkit');
  const is_ai_feature_enabled = useGetAIFeatures({ feature: 'editor' });
  const isToolkitAvailable = is_ai_feature_enabled;

  return (
    <>
      {isToolkitAvailable ? (
        <div className="flex space-x-2">
          <AnimatePresence>
            {aiEditorState.isModalOpen ? (
              <motion.div
                initial={{ y: 20, opacity: 0.3, filter: 'blur(5px)' }}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
                exit={{ y: 50, opacity: 0, filter: 'blur(3px)' }}
                transition={{
                  type: 'spring',
                  bounce: 0.35,
                  duration: 1.7,
                  mass: 0.2,
                  velocity: 2,
                }}
                className="fixed top-0 left-0 z-50 flex h-full w-full items-center justify-center"
                style={{ pointerEvents: 'none' }}
              >
                {aiEditorState.isFeedbackModalOpen && (
                  <UserFeedbackModal
                    activity={props.activity}
                    editor={props.editor}
                  />
                )}
                <div
                  style={{
                    pointerEvents: 'auto',
                    background: `radial-gradient(ellipse at center top,
                    oklch(0.35 0.08 260) 0%,
                    oklch(0.25 0.05 262) 50%,
                    oklch(0.15 0.02 264) 100%
                ),
                linear-gradient(45deg,
                    oklch(0.2 0.03 258) 0%,
                    oklch(0.3 0.06 261) 100%
                ),
                radial-gradient(circle at 75% 25%, oklch(0.6231 0.188 259.8145 / 0.12) 0%, transparent 40%)`,
                  }}
                  className="fixed bottom-0 left-1/2 z-50 mx-auto my-10 w-fit max-w-(--breakpoint-2xl) -translate-x-1/2 flex-col-reverse rounded-2xl p-3 text-white shadow-xl ring-1 ring-white/10 ring-inset"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="pr-1">
                      <div className="flex w-full flex-wrap items-center gap-2 font-bold text-white/80">
                        <Image
                          width={18}
                          src={platformLogoLight}
                          alt={t('aiIconAlt')}
                        />
                        <div className="flex items-center">{t('aiEditorTitle')}</div>
                        <MoreVertical
                          className="text-white/50"
                          size={12}
                        />
                      </div>
                    </div>
                    <div className="tools flex flex-wrap gap-2">
                      <AiEditorToolButton label="Writer" />
                      <AiEditorToolButton label="ContinueWriting" />
                      <AiEditorToolButton label="MakeLonger" />
                      <AiEditorToolButton label="Critisize" />
                      <AiEditorToolButton label="Translate" />
                    </div>
                    <div className="flex items-center space-x-2">
                      <X
                        onClick={() => {
                          dispatchAIEditor({ type: 'setIsModalClose' });
                          dispatchAIEditor({ type: 'setIsFeedbackModalClose' });
                        }}
                        size={20}
                        className="items-center rounded-full bg-white/10 p-1 text-white/50 hover:cursor-pointer"
                      />
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      ) : null}
    </>
  );
};

const UserFeedbackModal = (props: AIEditorToolkitProps) => {
  const dispatchAIEditor = useAIEditorDispatch();
  const aiEditorState = useAIEditor();
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('Activities.AIEditorToolkit');

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await dispatchAIEditor({
      type: 'setChatInputValue',
      payload: event.currentTarget.value,
    });
  };

  const sendReqWithMessage = async (message: string): Promise<string> => {
    // Add user message
    await dispatchAIEditor({
      type: 'addMessage',
      payload: { sender: 'user', message, type: 'user' },
    });

    await dispatchAIEditor({ type: 'setIsWaitingForResponse' });
    await dispatchAIEditor({ type: 'setChatInputValue', payload: '' });

    let streamingContent = '';

    return new Promise((resolve) => {
      const processStream = async () => {
        try {
          if (aiEditorState.aichat_uuid) {
            // Send message with streaming
            await sendActivityAIChatMessageStream(
              message,
              aiEditorState.aichat_uuid,
              props.activity.activity_uuid,
              access_token,
              (chunk) => {
                if (chunk.content) {
                  streamingContent += chunk.content;
                }
              },
              (status) => {
                if ((status as any)?.aichat_uuid) {
                  dispatchAIEditor({ type: 'setAichat_uuid', payload: (status as any).aichat_uuid });
                }
                console.log('Status:', status.message);
              },
              (final) => {
                dispatchAIEditor({ type: 'setIsNoLongerWaitingForResponse' });
                const finalMessage = final.content || streamingContent;
                dispatchAIEditor({
                  type: 'addMessage',
                  payload: { sender: 'ai', message: finalMessage, type: 'ai' },
                });
                resolve(finalMessage);
              },
              async (error) => {
                dispatchAIEditor({ type: 'setIsNoLongerWaitingForResponse' });
                dispatchAIEditor({
                  type: 'setError',
                  payload: {
                    isError: true,
                    status: 500,
                    error_message: error.error || 'Streaming failed',
                  },
                });
                // Ensure feedback modal opens so the user can see the error
                dispatchAIEditor({ type: 'setIsFeedbackModalOpen' });
                resolve('');
              },
            );
          } else {
            // Start new chat session with streaming
            await startActivityAIChatSessionStream(
              message,
              props.activity.activity_uuid,
              access_token,
              (chunk) => {
                if (chunk.content) {
                  streamingContent += chunk.content;
                }
              },
              (status) => {
                if ((status as any)?.aichat_uuid) {
                  dispatchAIEditor({ type: 'setAichat_uuid', payload: (status as any).aichat_uuid });
                }
                console.log('Status:', status.message);
              },
              (final) => {
                dispatchAIEditor({ type: 'setIsNoLongerWaitingForResponse' });

                if ((final as any).aichat_uuid) {
                  dispatchAIEditor({
                    type: 'setAichat_uuid',
                    payload: (final as any).aichat_uuid,
                  });
                }

                const finalMessage = final.content || streamingContent;
                dispatchAIEditor({
                  type: 'addMessage',
                  payload: { sender: 'ai', message: finalMessage, type: 'ai' },
                });
                resolve(finalMessage);
              },
              async (error) => {
                dispatchAIEditor({ type: 'setIsNoLongerWaitingForResponse' });
                dispatchAIEditor({
                  type: 'setError',
                  payload: {
                    isError: true,
                    status: 500,
                    error_message: error.error || 'Streaming failed',
                  },
                });
                dispatchAIEditor({ type: 'setIsFeedbackModalOpen' });
                resolve('');
              },
            );
          }
        } catch (error) {
          dispatchAIEditor({ type: 'setIsNoLongerWaitingForResponse' });
          dispatchAIEditor({
            type: 'setError',
            payload: {
              isError: true,
              status: 500,
              error_message: error instanceof Error ? error.message : 'Unknown error',
            },
          });
          dispatchAIEditor({ type: 'setIsFeedbackModalOpen' });
          resolve('');
        }
      };

      processStream();
    });
  };

  const handleKeyPress = async (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      await handleOperation(aiEditorState.selectedTool, aiEditorState.chatInputValue);
    }
  };

  const handleOperation = async (
    label: 'Writer' | 'ContinueWriting' | 'MakeLonger' | 'GenerateQuiz' | 'Translate' | 'Critisize',
    message: string,
  ) => {
    // Set selected tool
    await dispatchAIEditor({ type: 'setSelectedTool', payload: label });

    // Check what operation that was
    if (label === 'Writer') {
      let ai_message = '';
      const prompt = getPrompt({ label, selection: message });
      await dispatchAIEditor({ type: 'setIsUserInputEnabled', payload: true });
      if (prompt) {
        await dispatchAIEditor({
          type: 'setIsUserInputEnabled',
          payload: false,
        });
        await dispatchAIEditor({ type: 'setIsWaitingForResponse' });
        ai_message = await sendReqWithMessage(prompt);
        await fillEditorWithText(ai_message);
        await dispatchAIEditor({ type: 'setIsNoLongerWaitingForResponse' });
        await dispatchAIEditor({
          type: 'setIsUserInputEnabled',
          payload: true,
        });
      }
    } else if (label === 'ContinueWriting') {
      let ai_message = '';
      const text_selection = getTipTapEditorSelectedTextGlobal();
      const prompt = getPrompt({ label, selection: text_selection });
      if (prompt) {
        await dispatchAIEditor({ type: 'setIsWaitingForResponse' });
        ai_message = await sendReqWithMessage(prompt);
        const message_without_original_text = await removeSentences(text_selection, ai_message);
        await fillEditorWithText(message_without_original_text);
        await dispatchAIEditor({ type: 'setIsNoLongerWaitingForResponse' });
      }
    } else if (label === 'MakeLonger') {
      let ai_message = '';
      const text_selection = getTipTapEditorSelectedText();
      const prompt = getPrompt({ label, selection: text_selection });
      if (prompt) {
        await dispatchAIEditor({ type: 'setIsWaitingForResponse' });
        ai_message = await sendReqWithMessage(prompt);
        await replaceSelectedTextWithText(ai_message);
        await dispatchAIEditor({ type: 'setIsNoLongerWaitingForResponse' });
      }
    } else if (label === 'GenerateQuiz') {
      // will be implemented in future stages
    } else if (label === 'Critisize') {
      const scope = aiEditorState.critisizeScope;
      const text_selection = scope === 'lecture' ? getTipTapEditorEntireText() : getTipTapEditorSelectedTextGlobal();
      if (!text_selection) {
        toast.error(scope === 'lecture' ? t('critisizeLectureMissing') : t('critisizeSelectionMissing'));
        return;
      }
      const prompt = getPrompt({ label, selection: text_selection, scope });
      if (prompt) {
        await dispatchAIEditor({ type: 'setIsWaitingForResponse' });
        await sendReqWithMessage(prompt);
        await dispatchAIEditor({ type: 'setIsNoLongerWaitingForResponse' });
      }
    } else if (label === 'Translate') {
      const text_selection = getTipTapEditorSelectedText(); // Text to translate
      const targetLanguage = message; // This is aiEditorState.chatInputValue from handleOperation's 'message' param

      if (text_selection && !targetLanguage) {
        toast.error(t('translateToLanguageMissing'));
        return;
      }

      const prompt = getPrompt({ label, selection: text_selection });

      if (prompt) {
        await dispatchAIEditor({ type: 'setIsWaitingForResponse' });
        const ai_message = await sendReqWithMessage(prompt);
        if (ai_message) {
          // Check if message is not empty
          await replaceSelectedTextWithText(ai_message);
        }
        await dispatchAIEditor({ type: 'setIsNoLongerWaitingForResponse' });
      }
    }
  };

  const removeSentences = async (textToRemove: string, originalText: string) => {
    // Perform case-insensitive removal while preserving the original case of the rest of the text
    try {
      const escaped = textToRemove.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&');
      const regex = new RegExp(escaped, 'gi');
      return originalText.replace(regex, '');
    } catch (err) {
      return originalText;
    }
  };

  async function fillEditorWithText(text: string) {
    const words = text.split(' ');

    for (let i = 0; i < words.length; i += 1) {
      const textNode = {
        type: 'text',
        text: words[i],
      };

      props.editor.chain().focus().insertContent(textNode).run();

      // Add a space after each word except the last one
      if (i < words.length - 1) {
        const spaceNode = {
          type: 'text',
          text: ' ',
        };

        props.editor.chain().focus().insertContent(spaceNode).run();
      }

      // Wait for 0.12 seconds before adding the next word
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  async function replaceSelectedTextWithText(text: string) {
    const words = text.split(' ');

    // Delete the selected text
    props.editor.chain().focus().deleteSelection().run();

    for (let i = 0; i < words.length; i += 1) {
      const textNode = {
        type: 'text',
        text: words[i],
      };

      props.editor.chain().focus().insertContent(textNode).run();

      // Add a space after each word except the last one
      if (i < words.length - 1) {
        const spaceNode = {
          type: 'text',
          text: ' ',
        };

        props.editor.chain().focus().insertContent(spaceNode).run();
      }

      // Wait for 0.12 seconds before adding the next word
      await new Promise((resolve) => setTimeout(resolve, 120));
    }
  }

  const getPrompt = (args: AIPromptsLabels) => {
    const { label, selection, scope } = args;

    if (label === 'Writer') {
      if (selection === '') return '';
      return t('prompt_writer', { selection });
    }
    if (label === 'ContinueWriting') {
      if (selection === '') return '';
      return t('prompt_continueWriting', { selection });
    }
    if (label === 'MakeLonger') {
      if (selection === '') return '';
      return t('prompt_makeLonger', { selection });
    }
    if (label === 'GenerateQuiz') {
      // will be implemented in future stages
      return '';
    }
    if (label === 'Critisize') {
      if (selection === '') return '';
      if (scope === 'lecture') {
        return t('prompt_critisizeLecture', { selection });
      }
      return t('prompt_critisize', { selection });
    }
    if (label === 'Translate') {
      if (selection === '' || !aiEditorState.chatInputValue) return '';
      return t('prompt_translateTo', {
        language: aiEditorState.chatInputValue,
        selection,
      });
    }
  };

  const getTipTapEditorSelectedTextGlobal = () => {
    // Get the entire block (paragraph / node) the user is in using resolved positions
    const $from = props.editor.state.selection.$from;
    const start = $from.start($from.depth);
    const end = $from.end($from.depth);
    return props.editor.state.doc.textBetween(start, end, '\n', '\n');
  };

  const getTipTapEditorSelectedText = () => {
    const { selection } = props.editor.state;
    return props.editor.state.doc.textBetween(selection.from, selection.to);
  };

  const getTipTapEditorEntireText = () => {
    const { doc } = props.editor.state;
    return doc.textBetween(0, doc.content.size, '\n', '\n');
  };

  return (
    <motion.div
      initial={{ y: 20, opacity: 0.3, filter: 'blur(5px)' }}
      animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
      exit={{ y: 50, opacity: 0, filter: 'blur(3px)' }}
      transition={{
        type: 'spring',
        bounce: 0.35,
        duration: 1.7,
        mass: 0.2,
        velocity: 2,
      }}
      className="fixed top-0 left-0 z-50 flex h-full w-full items-center justify-center"
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          background: `radial-gradient(ellipse at center bottom,
                    oklch(0.35 0.08 260) 0%,
                    oklch(0.25 0.05 262) 50%,
                    oklch(0.15 0.02 264) 100%
                ),
                linear-gradient(45deg,
                    oklch(0.2 0.03 258) 0%,
                    oklch(0.3 0.06 261) 100%
                ),
                radial-gradient(circle at 75% 25%, oklch(0.6231 0.188 259.8145 / 0.12) 0%, transparent 40%)`,
        }}
        className="fixed bottom-16 left-1/2 z-50 mx-auto my-10 h-[200px] w-[500px] max-w-(--breakpoint-2xl) -translate-x-1/2 flex-col-reverse rounded-2xl p-3 text-white shadow-xl ring-1 ring-white/10 ring-inset"
      >
        <div className="flex justify-center">
          <Image
            width={26}
            src={platformLogoLight}
            alt="Ashyq Bilim logo"
          />
        </div>
        <div className="mx-auto flex h-[115px] justify-center antialiased">
          <div className="flex items-center justify-center">
            <AiEditorActionScreen handleOperation={handleOperation} />
          </div>
        </div>
        {aiEditorState.isUserInputEnabled ? (
          <div className="flex cursor-pointer items-center space-x-2">
            <input
              onKeyDown={handleKeyPress}
              value={aiEditorState.chatInputValue}
              onChange={handleChange}
              placeholder={t('askAI')}
              className="w-full rounded-lg bg-gray-950/20 px-4 py-2 text-sm text-white ring-1 ring-white/20 outline-hidden ring-inset placeholder:text-white/30"
            />
            <div
              onClick={() => handleOperation(aiEditorState.selectedTool, aiEditorState.chatInputValue)}
              className="rounded-md bg-white/10 px-3 py-2 outline-neutral-200/20 transition-all delay-75 ease-linear hover:bg-white/20 hover:outline-neutral-200/40"
            >
              <BetweenHorizontalStart
                size={20}
                className="text-white/50 hover:cursor-pointer"
              />
            </div>
          </div>
        ) : null}
      </div>
    </motion.div>
  );
};

const AiEditorToolButton = (props: any) => {
  const dispatchAIEditor = useAIEditorDispatch();
  const t = useTranslations('Activities.AIEditorToolkit');

  const handleToolButtonClick = async (
    label: 'Writer' | 'ContinueWriting' | 'MakeLonger' | 'GenerateQuiz' | 'Translate' | 'Critisize',
  ) => {
    // Ensure main modal is open, set the selected tool and show the feedback modal
    dispatchAIEditor({ type: 'setIsModalOpen' });
    dispatchAIEditor({ type: 'setIsUserInputEnabled', payload: label === 'Writer' });
    dispatchAIEditor({ type: 'setSelectedTool', payload: label });
    dispatchAIEditor({ type: 'setIsFeedbackModalOpen' });
  };

  return (
    <button
      onClick={() => handleToolButtonClick(props.label)}
      className="flex items-center space-x-1.5 rounded-md bg-white/10 px-2 py-0.5 text-sm font-semibold text-white/70 outline-neutral-200/20 transition-all delay-75 ease-linear hover:bg-white/20 hover:outline-neutral-200/40"
    >
      {props.label === 'Writer' && <Feather size={14} />}
      {props.label === 'ContinueWriting' && <FastForward size={14} />}
      {props.label === 'MakeLonger' && <FileStack size={14} />}
      {props.label === 'GenerateQuiz' && <HelpCircle size={14} />}
      {props.label === 'Translate' && <Languages size={14} />}
      {props.label === 'Critisize' && <Lightbulb size={14} />}
      <span>{t(`${props.label}Label`)}</span>
    </button>
  );
};

const AiEditorActionScreen = ({ handleOperation }: { handleOperation: any }) => {
  const dispatchAIEditor = useAIEditorDispatch();
  const aiEditorState = useAIEditor();
  const t = useTranslations('Activities.AIEditorToolkit');

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await dispatchAIEditor({
      type: 'setChatInputValue',
      payload: event.currentTarget.value,
    });
  };

  // Get the last AI message if it exists
  // Use a more compatible approach instead of `findLast` for environments where it's unavailable
  const lastAiMessage = [...aiEditorState.messages].reverse().find((msg) => msg.sender === 'ai');
  const hasAiResponse = lastAiMessage && !aiEditorState.isWaitingForResponse;

  return (
    <div>
      {aiEditorState.selectedTool === 'Writer' && !aiEditorState.isWaitingForResponse && (
        <div className="space-x-2 text-xl font-extrabold text-white/90">
          <span>{t('writerPlaceholder')}</span>
        </div>
      )}
      {aiEditorState.selectedTool === 'ContinueWriting' && !aiEditorState.isWaitingForResponse && (
        <div className="mx-auto flex flex-col items-center justify-center align-middle">
          <p className="mx-auto mt-4 flex justify-center p-2 align-middle text-sm font-bold text-white/80">
            {t('continuePlaceholder')}
          </p>
          <div
            onClick={() => {
              handleOperation(aiEditorState.selectedTool, aiEditorState.chatInputValue);
            }}
            className="mt-4 flex cursor-pointer items-center space-x-1.5 rounded-md bg-white/10 p-4 text-2xl font-semibold text-white/70 outline-neutral-200/20 transition-all delay-75 ease-linear hover:bg-white/20 hover:outline-neutral-200/40"
          >
            <FastForward size={24} />
          </div>
        </div>
      )}
      {aiEditorState.selectedTool === 'MakeLonger' && !aiEditorState.isWaitingForResponse && (
        <div className="mx-auto flex flex-col items-center justify-center align-middle">
          <p className="mx-auto mt-4 flex justify-center p-2 align-middle text-sm font-bold text-white/80">
            {t('longerPlaceholder')}
          </p>
          <div
            onClick={() => {
              handleOperation(aiEditorState.selectedTool, aiEditorState.chatInputValue);
            }}
            className="mt-4 flex cursor-pointer items-center space-x-1.5 rounded-md bg-white/10 p-4 text-2xl font-semibold text-white/70 outline-neutral-200/20 transition-all delay-75 ease-linear hover:bg-white/20 hover:outline-neutral-200/40"
          >
            <FileStack size={24} />
          </div>
        </div>
      )}
      {aiEditorState.selectedTool === 'Critisize' && !aiEditorState.isWaitingForResponse && (
        <div className="mx-auto flex flex-col items-center justify-center pt-2 align-middle">
          {hasAiResponse ? (
            <div className="max-h-[140px] w-full overflow-y-auto rounded-lg bg-white/5 p-4">
              <div className="text-sm whitespace-pre-wrap text-white/90">{lastAiMessage.message}</div>
            </div>
          ) : (
            <>
              <p className="mx-auto mt-4 flex justify-center p-2 align-middle text-sm font-bold text-white/80">
                {t('critisizePlaceholder')}
              </p>
              <div className="mt-3 flex flex-col items-center space-y-2 text-xs text-white/70">
                <span className="font-semibold text-white/80">{t('critisizeScopeLabel')}</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => dispatchAIEditor({ type: 'setCritisizeScope', payload: 'selection' })}
                    className={`rounded-md px-3 py-1 text-sm font-semibold transition ${
                      aiEditorState.critisizeScope === 'selection'
                        ? 'bg-white/20 text-white'
                        : 'bg-white/5 text-white/60'
                    }`}
                  >
                    {t('critisizeScopeSelection')}
                  </button>
                  <button
                    type="button"
                    onClick={() => dispatchAIEditor({ type: 'setCritisizeScope', payload: 'lecture' })}
                    className={`rounded-md px-3 py-1 text-sm font-semibold transition ${
                      aiEditorState.critisizeScope === 'lecture' ? 'bg-white/20 text-white' : 'bg-white/5 text-white/60'
                    }`}
                  >
                    {t('critisizeScopeLecture')}
                  </button>
                </div>
              </div>
              <div
                onClick={() => {
                  handleOperation(aiEditorState.selectedTool, aiEditorState.chatInputValue);
                }}
                className="mt-4 flex cursor-pointer items-center space-x-1.5 rounded-md bg-white/10 p-4 text-2xl font-semibold text-white/70 outline-neutral-200/20 transition-all delay-75 ease-linear hover:bg-white/20 hover:outline-neutral-200/40"
              >
                <Lightbulb size={24} />
              </div>
            </>
          )}
        </div>
      )}
      {aiEditorState.selectedTool === 'Translate' && !aiEditorState.isWaitingForResponse && (
        <div className="mx-auto flex flex-col items-center justify-center align-middle">
          <div className="mx-auto mt-4 flex justify-center space-x-6 p-2 align-middle text-sm font-bold text-white/80">
            <p>{t('translatePlaceholder')}</p>
            <input
              value={aiEditorState.chatInputValue}
              onChange={handleChange}
              placeholder={t('translateExample')}
              className="w-full rounded-lg bg-gray-950/20 px-4 py-2 text-sm text-white ring-1 ring-white/20 outline-hidden ring-inset placeholder:text-white/30"
            />
          </div>
          <div
            onClick={() => {
              handleOperation(aiEditorState.selectedTool, aiEditorState.chatInputValue);
            }}
            className="mt-4 flex cursor-pointer items-center space-x-1.5 rounded-md bg-white/10 p-4 text-2xl font-semibold text-white/70 outline-neutral-200/20 transition-all delay-75 ease-linear hover:bg-white/20 hover:outline-neutral-200/40"
          >
            <Languages size={24} />
          </div>
        </div>
      )}
      {aiEditorState.isWaitingForResponse && !aiEditorState.error.isError ? (
        <div className="mx-auto flex flex-col items-center justify-center align-middle">
          <svg
            className="mt-10 h-10 w-10 animate-spin text-white"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
          <p className="mt-4 font-bold text-white/90">{t('thinking')}</p>
        </div>
      ) : null}

      {aiEditorState.error.isError ? (
        <div className="flex h-auto items-center pt-7">
          <div className="mx-auto flex w-full flex-col space-y-2 rounded-lg bg-red-500/20 p-5 outline-red-500">
            <AlertTriangle
              size={20}
              className="text-red-500"
            />
            <div className="flex flex-col">
              <h3 className="font-semibold text-red-200">{t('errorTitle')}</h3>
              <span className="text-sm text-red-100">{aiEditorState.error.error_message}</span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default AIEditorToolkit;
