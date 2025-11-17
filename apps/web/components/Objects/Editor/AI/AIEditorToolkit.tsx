import {
  AlertTriangle,
  BetweenHorizontalStart,
  FastForward,
  Feather,
  FileStack,
  HelpCircle,
  Languages,
  Lightbulb,
  X,
} from 'lucide-react';
import { sendActivityAIChatMessageStream, startActivityAIChatSessionStream } from '@services/ai/ai-streaming';
import { useAIEditor, useAIEditorDispatch } from '@components/Contexts/AI/AIEditorContext';
import type { CritisizeScope } from '@components/Contexts/AI/AIEditorContext';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import useGetAIFeatures from '@components/Hooks/useGetAIFeatures';
import platformLogoLight from 'public/platform_logo_light.svg';
import { ScrollArea } from '@components/ui/scroll-area';
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
                initial={{ y: 20, opacity: 0, filter: 'blur(10px)', scale: 0.95 }}
                animate={{ y: 0, opacity: 1, filter: 'blur(0px)', scale: 1 }}
                exit={{ y: 30, opacity: 0, filter: 'blur(8px)', scale: 0.98 }}
                transition={{
                  type: 'spring',
                  bounce: 0.25,
                  duration: 0.6,
                  mass: 0.8,
                }}
                className="fixed top-0 left-0 z-50 flex h-full w-full items-center justify-center"
                style={{ pointerEvents: 'none' }}
              >
                {/* Backdrop blur overlay - only blocks clicks when feedback modal is NOT open */}
                {!aiEditorState.isFeedbackModalOpen && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/20 backdrop-blur-sm"
                    onClick={() => {
                      dispatchAIEditor({ type: 'setIsModalClose' });
                    }}
                    style={{ pointerEvents: 'auto' }}
                  />
                )}

                {aiEditorState.isFeedbackModalOpen && (
                  <UserFeedbackModal
                    activity={props.activity}
                    editor={props.editor}
                  />
                )}
                <div
                  style={{
                    pointerEvents: 'auto',
                    background: `
                      linear-gradient(135deg,
                        rgba(255, 255, 255, 0.15) 0%,
                        rgba(255, 255, 255, 0.08) 100%
                      ),
                      linear-gradient(180deg,
                        oklch(0.35 0.15 260 / 0.7) 0%,
                        oklch(0.28 0.12 262 / 0.6) 100%
                      )
                    `,
                    backdropFilter: 'blur(32px) saturate(180%)',
                    WebkitBackdropFilter: 'blur(32px) saturate(180%)',
                  }}
                  className="fixed bottom-0 left-1/2 z-40 mx-auto mb-6 w-fit max-w-[95vw] -translate-x-1/2 flex-col-reverse rounded-2xl border border-white/20 p-3 text-white shadow-2xl shadow-black/50 sm:mb-10 sm:rounded-3xl sm:p-4 md:max-w-(--breakpoint-2xl)"
                >
                  {/* Glass reflection effect */}
                  <div className="pointer-events-none absolute inset-0 rounded-2xl bg-linear-to-br from-white/20 via-transparent to-transparent opacity-60 sm:rounded-3xl" />

                  <div className="relative flex flex-wrap items-center gap-2 sm:gap-3">
                    <div className="flex items-center gap-2 pr-2 sm:gap-2.5">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-white/25 to-white/10 shadow-lg backdrop-blur-sm sm:h-9 sm:w-9 sm:rounded-xl">
                        <Image
                          width={18}
                          height={18}
                          src={platformLogoLight}
                          alt={t('aiIconAlt')}
                          className="drop-shadow-lg sm:h-5 sm:w-5"
                        />
                      </div>
                      <div className="hidden flex-col sm:flex">
                        <span className="text-sm font-bold text-white">{t('aiEditorTitle')}</span>
                      </div>
                    </div>

                    <div className="hidden h-8 w-px bg-linear-to-b from-transparent via-white/30 to-transparent sm:block" />

                    <div className="tools flex flex-wrap gap-1.5 sm:gap-2">
                      <AiEditorToolButton label="Writer" />
                      <AiEditorToolButton label="ContinueWriting" />
                      <AiEditorToolButton label="MakeLonger" />
                      <AiEditorToolButton label="Critisize" />
                      <AiEditorToolButton label="Translate" />
                    </div>

                    <div className="ml-auto flex items-center">
                      <button
                        onClick={() => {
                          dispatchAIEditor({ type: 'setIsModalClose' });
                          dispatchAIEditor({ type: 'setIsFeedbackModalClose' });
                        }}
                        className="group relative flex h-8 w-8 items-center justify-center overflow-hidden rounded-lg bg-white/10 text-white/80 backdrop-blur-sm transition-all duration-300 hover:bg-red-500/30 hover:text-white focus:ring-2 focus:ring-white/40 focus:outline-none active:scale-95 sm:h-9 sm:w-9 sm:rounded-xl"
                        aria-label={t('closeToolkit')}
                        type="button"
                      >
                        <div className="absolute inset-0 bg-linear-to-br from-white/15 to-transparent opacity-0 transition-opacity group-hover:opacity-100" />
                        <X
                          size={18}
                          className="relative z-10 transition-transform group-hover:rotate-90"
                        />
                      </button>
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
      initial={{ y: 30, opacity: 0, filter: 'blur(10px)', scale: 0.9 }}
      animate={{ y: 0, opacity: 1, filter: 'blur(0px)', scale: 1 }}
      exit={{ y: 40, opacity: 0, filter: 'blur(8px)', scale: 0.95 }}
      transition={{
        type: 'spring',
        bounce: 0.2,
        duration: 0.7,
      }}
      className="fixed top-0 left-0 z-60 flex h-full w-full items-center justify-center"
      style={{ pointerEvents: 'none' }}
    >
      <div
        style={{
          pointerEvents: 'auto',
          background: `
            linear-gradient(135deg,
              rgba(255, 255, 255, 0.16) 0%,
              rgba(255, 255, 255, 0.08) 100%
            ),
            linear-gradient(180deg,
              oklch(0.36 0.16 260 / 0.75) 0%,
              oklch(0.28 0.12 262 / 0.65) 100%
            )
          `,
          backdropFilter: 'blur(48px) saturate(180%)',
          WebkitBackdropFilter: 'blur(48px) saturate(180%)',
        }}
        className="fixed bottom-[120px] left-1/2 z-50 mx-auto min-h-[240px] w-[calc(100vw-2rem)] max-w-[560px] -translate-x-1/2 flex-col rounded-2xl border border-white/25 p-4 text-white shadow-2xl shadow-black/60 sm:bottom-[120px] sm:rounded-3xl sm:p-5"
      >
        {/* Enhanced glass reflection */}
        <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-2xl sm:rounded-3xl">
          <div className="absolute inset-0 bg-linear-to-br from-white/30 via-white/10 to-transparent opacity-80" />
          <div className="absolute top-0 left-0 h-24 w-24 bg-white/15 blur-3xl sm:h-32 sm:w-32" />
          <div className="absolute right-0 bottom-0 h-20 w-20 bg-purple-400/20 blur-2xl sm:h-24 sm:w-24" />
        </div>

        <div className="relative flex flex-col space-y-3 sm:space-y-4">
          {/* Header */}
          <div className="flex items-center justify-center">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-linear-to-br from-white/30 to-white/15 shadow-xl ring-1 ring-white/25 backdrop-blur-sm sm:h-12 sm:w-12 sm:rounded-2xl">
              <Image
                width={24}
                height={24}
                src={platformLogoLight}
                alt={t('platformLogoAlt')}
                className="drop-shadow-2xl sm:h-7 sm:w-7"
              />
            </div>
          </div>

          {/* Content area */}
          <div className="mx-auto flex min-h-[120px] w-full items-center justify-center rounded-xl bg-black/20 p-3 backdrop-blur-sm sm:rounded-2xl sm:p-4">
            <AiEditorActionScreen handleOperation={handleOperation} />
          </div>

          {/* Input area */}
          {aiEditorState.isUserInputEnabled ? (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex items-center gap-2"
            >
              <div className="relative flex-1">
                <input
                  onKeyDown={handleKeyPress}
                  value={aiEditorState.chatInputValue}
                  onChange={handleChange}
                  placeholder={t('askAI')}
                  disabled={aiEditorState.isWaitingForResponse}
                  className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2.5 text-sm text-white shadow-inner backdrop-blur-xl transition-all placeholder:text-white/50 hover:border-white/30 hover:bg-white/15 focus:border-white/40 focus:bg-white/15 focus:ring-2 focus:ring-white/30 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 sm:rounded-xl sm:px-4 sm:py-3"
                  aria-label={t('askAI')}
                />
                <div className="pointer-events-none absolute inset-0 rounded-lg bg-linear-to-r from-white/10 to-transparent sm:rounded-xl" />
              </div>
              <button
                onClick={() => handleOperation(aiEditorState.selectedTool, aiEditorState.chatInputValue)}
                disabled={aiEditorState.isWaitingForResponse || !aiEditorState.chatInputValue.trim()}
                className="group relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-linear-to-br from-white/25 to-white/15 shadow-lg backdrop-blur-sm transition-all duration-300 hover:scale-105 hover:from-white/35 hover:to-white/20 hover:shadow-xl focus:ring-2 focus:ring-white/40 focus:outline-none active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:scale-100 sm:h-11 sm:w-11 sm:rounded-xl"
                aria-label={t('sendMessage')}
                type="button"
              >
                <div className="absolute inset-0 bg-linear-to-br from-purple-400/30 to-blue-400/30 opacity-0 transition-opacity group-hover:opacity-100" />
                <BetweenHorizontalStart
                  size={18}
                  className="relative z-10 text-white/90 transition-colors group-hover:text-white sm:h-5 sm:w-5"
                />
              </button>
            </motion.div>
          ) : null}
        </div>
      </div>
    </motion.div>
  );
};

const AiEditorToolButton = (props: any) => {
  const dispatchAIEditor = useAIEditorDispatch();
  const aiEditorState = useAIEditor();
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

  const isSelected = aiEditorState.selectedTool === props.label;

  return (
    <motion.button
      onClick={() => handleToolButtonClick(props.label)}
      whileHover={{ scale: 1.05, y: -2 }}
      whileTap={{ scale: 0.95 }}
      className={`group relative flex items-center gap-1.5 overflow-hidden rounded-lg px-2.5 py-1.5 text-xs font-semibold backdrop-blur-xl transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:outline-none sm:gap-2 sm:rounded-xl sm:px-3.5 sm:py-2 sm:text-sm ${
        isSelected
          ? 'bg-white/25 text-white shadow-lg ring-1 ring-white/40'
          : 'bg-white/12 text-white/80 ring-1 ring-white/15 hover:bg-white/20 hover:text-white hover:ring-white/25'
      }`}
      aria-label={t(`${props.label}Label`)}
      type="button"
    >
      {/* Glass shine effect */}
      <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-white/30 via-transparent to-transparent opacity-0 transition-opacity group-hover:opacity-100" />

      {/* Icon with enhanced animations */}
      <div className="relative z-10 transition-transform group-hover:scale-110 group-hover:rotate-6">
        {props.label === 'Writer' && (
          <Feather
            size={14}
            className="drop-shadow-lg sm:h-4 sm:w-4"
          />
        )}
        {props.label === 'ContinueWriting' && (
          <FastForward
            size={14}
            className="drop-shadow-lg sm:h-4 sm:w-4"
          />
        )}
        {props.label === 'MakeLonger' && (
          <FileStack
            size={14}
            className="drop-shadow-lg sm:h-4 sm:w-4"
          />
        )}
        {props.label === 'GenerateQuiz' && (
          <HelpCircle
            size={14}
            className="drop-shadow-lg sm:h-4 sm:w-4"
          />
        )}
        {props.label === 'Translate' && (
          <Languages
            size={14}
            className="drop-shadow-lg sm:h-4 sm:w-4"
          />
        )}
        {props.label === 'Critisize' && (
          <Lightbulb
            size={14}
            className="drop-shadow-lg sm:h-4 sm:w-4"
          />
        )}
      </div>

      <span className="relative z-10 hidden drop-shadow-sm sm:inline">{t(`${props.label}Label`)}</span>

      {/* Bottom glow indicator for selected state */}
      {isSelected && (
        <motion.div
          layoutId="activeToolIndicator"
          className="absolute bottom-0 left-1/2 h-0.5 w-3/4 -translate-x-1/2 rounded-full bg-linear-to-r from-transparent via-white to-transparent"
          transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
        />
      )}
    </motion.button>
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
  const hasAiResponse =
    lastAiMessage && !aiEditorState.isWaitingForResponse && aiEditorState.selectedTool === 'Critisize';

  return (
    <div>
      {aiEditorState.selectedTool === 'Writer' && !aiEditorState.isWaitingForResponse && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center justify-center space-y-2 text-center"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-linear-to-br from-white/30 to-white/15 shadow-xl ring-1 ring-white/30 backdrop-blur-sm sm:h-14 sm:w-14 sm:rounded-2xl">
            <Feather
              size={24}
              className="text-white drop-shadow-lg sm:h-7 sm:w-7"
            />
          </div>
          <span className="text-base font-bold text-white drop-shadow-sm sm:text-lg">{t('writerPlaceholder')}</span>
          <span className="text-xs text-white/60">{t('typePromptBelow')}</span>
        </motion.div>
      )}
      {aiEditorState.selectedTool === 'ContinueWriting' && !aiEditorState.isWaitingForResponse && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto flex flex-col items-center justify-center space-y-3 sm:space-y-4"
        >
          <p className="text-center text-sm font-semibold text-white drop-shadow-sm">{t('continuePlaceholder')}</p>
          <motion.button
            onClick={() => {
              handleOperation(aiEditorState.selectedTool, aiEditorState.chatInputValue);
            }}
            whileHover={{ scale: 1.1, rotate: 3 }}
            whileTap={{ scale: 0.95 }}
            className="group relative flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-white/30 to-white/15 shadow-2xl ring-1 ring-white/30 backdrop-blur-sm transition-all duration-300 hover:shadow-purple-500/30 focus:ring-2 focus:ring-white/50 focus:outline-none sm:h-16 sm:w-16 sm:rounded-2xl"
            aria-label={t('continuePlaceholder')}
            type="button"
          >
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-purple-400/30 to-blue-400/30 opacity-0 transition-opacity group-hover:opacity-100" />
            <FastForward
              size={24}
              className="relative z-10 text-white drop-shadow-lg transition-transform group-hover:translate-x-1 sm:h-7 sm:w-7"
            />
          </motion.button>
        </motion.div>
      )}
      {aiEditorState.selectedTool === 'MakeLonger' && !aiEditorState.isWaitingForResponse && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto flex flex-col items-center justify-center space-y-3 sm:space-y-4"
        >
          <p className="text-center text-sm font-semibold text-white drop-shadow-sm">{t('longerPlaceholder')}</p>
          <motion.button
            onClick={() => {
              handleOperation(aiEditorState.selectedTool, aiEditorState.chatInputValue);
            }}
            whileHover={{ scale: 1.1, y: -4 }}
            whileTap={{ scale: 0.95 }}
            className="group relative flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-white/30 to-white/15 shadow-2xl ring-1 ring-white/30 backdrop-blur-sm transition-all duration-300 hover:shadow-blue-500/30 focus:ring-2 focus:ring-white/50 focus:outline-none sm:h-16 sm:w-16 sm:rounded-2xl"
            aria-label={t('longerPlaceholder')}
            type="button"
          >
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-blue-400/30 to-cyan-400/30 opacity-0 transition-opacity group-hover:opacity-100" />
            <FileStack
              size={24}
              className="relative z-10 text-white drop-shadow-lg transition-transform group-hover:scale-110 sm:h-7 sm:w-7"
            />
          </motion.button>
        </motion.div>
      )}
      {aiEditorState.selectedTool === 'Critisize' && !aiEditorState.isWaitingForResponse && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto flex w-full flex-col items-center justify-center space-y-3"
        >
          {hasAiResponse ? (
            <ScrollArea className="h-[140px] w-full rounded-xl border border-white/20 bg-white/10 shadow-inner backdrop-blur-sm">
              <div className="p-3 text-sm leading-relaxed whitespace-pre-wrap text-white sm:p-4">
                {lastAiMessage.message}
              </div>
            </ScrollArea>
          ) : (
            <>
              <p className="text-center text-sm font-semibold text-white drop-shadow-sm">{t('critisizePlaceholder')}</p>
              <div className="flex flex-col items-center space-y-2 sm:space-y-3">
                <span className="text-xs font-medium text-white/70">{t('critisizeScopeLabel')}</span>
                <div className="flex gap-2">
                  <motion.button
                    type="button"
                    onClick={() => dispatchAIEditor({ type: 'setCritisizeScope', payload: 'selection' })}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative overflow-hidden rounded-lg px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:outline-none sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm ${
                      aiEditorState.critisizeScope === 'selection'
                        ? 'bg-white/30 text-white shadow-lg ring-1 ring-white/40'
                        : 'bg-white/10 text-white/70 ring-1 ring-white/15 hover:bg-white/20 hover:text-white'
                    }`}
                    aria-pressed={aiEditorState.critisizeScope === 'selection'}
                  >
                    {aiEditorState.critisizeScope === 'selection' && (
                      <motion.div
                        layoutId="critisizeScope"
                        className="absolute inset-0 bg-linear-to-br from-white/20 to-transparent"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10">{t('critisizeScopeSelection')}</span>
                  </motion.button>
                  <motion.button
                    type="button"
                    onClick={() => dispatchAIEditor({ type: 'setCritisizeScope', payload: 'lecture' })}
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    className={`relative overflow-hidden rounded-lg px-3 py-1.5 text-xs font-semibold backdrop-blur-sm transition-all duration-300 focus:ring-2 focus:ring-white/40 focus:outline-none sm:rounded-xl sm:px-4 sm:py-2 sm:text-sm ${
                      aiEditorState.critisizeScope === 'lecture'
                        ? 'bg-white/30 text-white shadow-lg ring-1 ring-white/40'
                        : 'bg-white/10 text-white/70 ring-1 ring-white/15 hover:bg-white/20 hover:text-white'
                    }`}
                    aria-pressed={aiEditorState.critisizeScope === 'lecture'}
                  >
                    {aiEditorState.critisizeScope === 'lecture' && (
                      <motion.div
                        layoutId="critisizeScope"
                        className="absolute inset-0 bg-linear-to-br from-white/20 to-transparent"
                        transition={{ type: 'spring', bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10">{t('critisizeScopeLecture')}</span>
                  </motion.button>
                </div>
              </div>
              <motion.button
                onClick={() => {
                  handleOperation(aiEditorState.selectedTool, aiEditorState.chatInputValue);
                }}
                whileHover={{ scale: 1.1, rotate: 12 }}
                whileTap={{ scale: 0.95 }}
                className="group relative mt-3 flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-white/30 to-white/15 shadow-2xl ring-1 ring-white/30 backdrop-blur-sm transition-all duration-300 hover:shadow-amber-500/30 focus:ring-2 focus:ring-white/50 focus:outline-none sm:mt-4 sm:h-16 sm:w-16 sm:rounded-2xl"
                aria-label={t('critisizePlaceholder')}
                type="button"
              >
                <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-amber-400/30 to-orange-400/30 opacity-0 transition-opacity group-hover:opacity-100" />
                <Lightbulb
                  size={24}
                  className="relative z-10 text-white drop-shadow-lg transition-transform sm:h-7 sm:w-7"
                />
              </motion.button>
            </>
          )}
        </motion.div>
      )}
      {aiEditorState.selectedTool === 'Translate' && !aiEditorState.isWaitingForResponse && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto flex w-full flex-col items-center justify-center space-y-3 sm:space-y-4"
        >
          <div className="flex w-full flex-col items-center gap-2 sm:gap-3">
            <p className="text-center text-sm font-semibold text-white drop-shadow-sm">{t('translatePlaceholder')}</p>
            <input
              value={aiEditorState.chatInputValue}
              onChange={handleChange}
              placeholder={t('translateExample')}
              className="w-full rounded-lg border border-white/20 bg-white/10 px-3 py-2 text-sm text-white shadow-inner backdrop-blur-sm transition-all placeholder:text-white/50 hover:border-white/30 hover:bg-white/15 focus:border-white/40 focus:bg-white/15 focus:ring-2 focus:ring-white/30 focus:outline-none sm:rounded-xl sm:px-4 sm:py-2.5"
            />
          </div>
          <motion.button
            onClick={() => {
              handleOperation(aiEditorState.selectedTool, aiEditorState.chatInputValue);
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
            className="group relative flex h-14 w-14 cursor-pointer items-center justify-center overflow-hidden rounded-xl bg-linear-to-br from-white/30 to-white/15 shadow-2xl ring-1 ring-white/30 backdrop-blur-sm transition-all duration-300 hover:shadow-green-500/30 focus:ring-2 focus:ring-white/50 focus:outline-none sm:h-16 sm:w-16 sm:rounded-2xl"
            aria-label={t('translatePlaceholder')}
            type="button"
          >
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-green-400/30 to-emerald-400/30 opacity-0 transition-opacity group-hover:opacity-100" />
            <Languages
              size={24}
              className="relative z-10 text-white drop-shadow-lg transition-transform group-hover:scale-110 sm:h-7 sm:w-7"
            />
          </motion.button>
        </motion.div>
      )}
      {aiEditorState.isWaitingForResponse && !aiEditorState.error.isError ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          className="mx-auto flex flex-col items-center justify-center gap-5"
        >
          <div className="relative">
            {/* Outer glow ring */}
            <div className="absolute inset-0 animate-ping rounded-full bg-purple-400/30 blur-xl" />

            {/* Spinner */}
            <svg
              className="relative h-14 w-14 animate-spin text-white/90 drop-shadow-xl"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-20"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="3"
              />
              <path
                className="opacity-90"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>

            {/* Inner glow */}
            <div className="absolute inset-2 animate-pulse rounded-full bg-linear-to-tr from-purple-400/20 to-blue-400/20 blur-md" />
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <motion.p
              animate={{ opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 2, repeat: Number.POSITIVE_INFINITY }}
              className="font-bold text-white/90 drop-shadow-sm"
            >
              {t('thinking')}
            </motion.p>
            <p className="text-xs text-white/50">{t('processingRequest')}</p>
          </div>
        </motion.div>
      ) : null}

      {aiEditorState.error.isError ? (
        <motion.div
          initial={{ opacity: 0, y: 10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="flex h-auto items-center"
        >
          <div className="relative mx-auto flex w-full flex-col space-y-2 overflow-hidden rounded-xl border border-red-500/40 bg-red-500/20 p-4 shadow-xl backdrop-blur-xl sm:space-y-3 sm:rounded-2xl sm:p-5">
            {/* Glass effect overlay */}
            <div className="pointer-events-none absolute inset-0 bg-linear-to-br from-red-400/20 to-transparent" />

            <div className="relative flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 sm:gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-500/30 ring-1 ring-red-500/40 sm:h-9 sm:w-9 sm:rounded-xl">
                  <AlertTriangle
                    size={18}
                    className="text-red-200 sm:h-5 sm:w-5"
                    aria-hidden="true"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="text-sm font-bold text-red-100 sm:text-base">{t('errorTitle')}</h3>
                  <span className="text-xs leading-relaxed text-red-50/90 sm:text-sm">
                    {aiEditorState.error.error_message}
                  </span>
                </div>
              </div>
              <motion.button
                onClick={() =>
                  dispatchAIEditor({ type: 'setError', payload: { isError: false, status: 0, error_message: '' } })
                }
                whileHover={{ scale: 1.1, rotate: 90 }}
                whileTap={{ scale: 0.9 }}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-red-500/30 text-red-200 transition-colors hover:bg-red-500/40 hover:text-red-100 focus:ring-2 focus:ring-red-300/50 focus:outline-none sm:h-8 sm:w-8"
                aria-label={t('dismissError')}
                type="button"
              >
                <X
                  size={14}
                  className="sm:h-4 sm:w-4"
                />
              </motion.button>
            </div>
          </div>
        </motion.div>
      ) : null}
    </div>
  );
};

export default AIEditorToolkit;
