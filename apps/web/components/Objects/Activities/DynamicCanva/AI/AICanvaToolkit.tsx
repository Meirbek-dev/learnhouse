import { sendActivityAIChatMessageStream, startActivityAIChatSessionStream } from '@services/ai/ai-streaming';
import { useAIChatBot, useAIChatBotDispatch } from '@components/Contexts/AI/AIChatBotContext';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip';
import useGetAIFeatures from '@components/Hooks/useGetAIFeatures';
import { BookOpen, FormInput, Languages } from 'lucide-react';
import platformLogo from 'public/platform_logo.svg';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import Image from 'next/image';

interface AICanvaToolkitProps {
  editor: Editor;
  activity: any;
}

const AICanvaToolkit = (props: AICanvaToolkitProps) => {
  const t = useTranslations('Activities.AICanvaToolkit');
  const is_ai_feature_enabled = useGetAIFeatures({ feature: 'activity_ask' });
  const isBubbleMenuAvailable = is_ai_feature_enabled;

  return (
    <>
      {isBubbleMenuAvailable ? (
        <BubbleMenu
          className="w-fit"
          editor={props.editor}
          shouldShow={({ editor }) => {
            // Only show the bubble menu if text is selected
            return editor.isActive('text') && !editor.state.selection.empty;
          }}
        >
          <div
            style={{
              background:
                'linear-gradient(0deg, rgba(0, 0, 0, 0.25) 0%, rgba(0, 0, 0, 0.25) 100%), radial-gradient(105.16% 105.16% at 50% -5.16%, rgba(255, 255, 255, 0.2) 0%, rgba(0, 0, 0, 0) 100%), rgba(2, 1, 25, 0.98)',
            }}
            className="flex h-auto w-max cursor-pointer items-center space-x-3 rounded-xl px-3 py-2 text-white shadow-2xl ring-1 ring-white/10 backdrop-blur-sm"
          >
            <div className="flex items-center space-x-2 font-bold text-white/90">
              <Image
                className="rounded-lg ring-1 ring-white/10"
                width={22}
                src={platformLogo}
                alt={t('aiIconAlt')}
              />
              <div className="text-sm">{t('aiTitle')}</div>
            </div>
            <div
              className="flex h-4 w-px bg-white/20"
              aria-hidden="true"
            />
            <div className="flex space-x-2">
              <AIActionButton
                editor={props.editor}
                activity={props.activity}
                label="Explain"
              />
              <AIActionButton
                editor={props.editor}
                activity={props.activity}
                label="Summarize"
              />
              <AIActionButton
                editor={props.editor}
                activity={props.activity}
                label="Translate"
              />
              <AIActionButton
                editor={props.editor}
                activity={props.activity}
                label="Examples"
              />
            </div>
          </div>
        </BubbleMenu>
      ) : null}
    </>
  );
};

const AIActionButton = (props: { editor: Editor; label: string; activity: any }) => {
  const t = useTranslations('Activities.AICanvaToolkit');
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const dispatchAIChatBot = useAIChatBotDispatch();
  const aiChatBotState = useAIChatBot();
  const controllerRef = useRef<AbortController | null>(null);
  const streamingBufferRef = useRef('');

  useEffect(() => () => controllerRef.current?.abort(), []);

  const resetStreamingState = () => {
    streamingBufferRef.current = '';
    dispatchAIChatBot({ type: 'clearStreamingMessage' });
    dispatchAIChatBot({ type: 'setStatusMessage', payload: null });
  };

  const getController = () => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller;
  };

  async function handleAction(label: string) {
    const selection = getTipTapEditorSelectedText();
    const prompt = getPrompt(label, selection);
    dispatchAIChatBot({ type: 'setIsModalOpen' });
    await sendMessage(prompt);
  }

  const getTipTapEditorSelectedText = () => {
    const { selection } = props.editor.state;
    const { from } = selection;
    const { to } = selection;
    return props.editor.state.doc.textBetween(from, to);
  };

  const getPrompt = (label: string, selection: string) => {
    switch (label) {
      case 'Explain': {
        return t('explainPrompt', { selection });
      }
      case 'Summarize': {
        return t('summarizePrompt', { selection });
      }
      case 'Translate': {
        return t('translatePrompt', { selection });
      }
      case 'Examples': {
        return t('examplesPrompt', { selection });
      }
      default: {
        return '';
      }
    }
  };

  const sendMessage = async (message: string) => {
    // Add user message
    await dispatchAIChatBot({
      type: 'addMessage',
      payload: { sender: 'user', message, type: 'user' },
    });

    await dispatchAIChatBot({ type: 'setIsWaitingForResponse' });
    await dispatchAIChatBot({ type: 'setChatInputValue', payload: '' });
    await dispatchAIChatBot({ type: 'setStatusMessage', payload: 'Думаю...' });
    resetStreamingState();
    const controller = getController();

    try {
      if (aiChatBotState.aichat_uuid) {
        // Send message with streaming
        await sendActivityAIChatMessageStream(
          message,
          aiChatBotState.aichat_uuid,
          props.activity.activity_uuid,
          access_token,
          (chunk) => {
            if (chunk.content) {
              streamingBufferRef.current += chunk.content;
              dispatchAIChatBot({ type: 'setStreamingMessage', payload: streamingBufferRef.current });
            }
          },
          (status) => {
            // Persist aichat_uuid if provided in status so clients can
            // send follow-up messages before the final chunk arrives.
            if ((status as any)?.aichat_uuid) {
              dispatchAIChatBot({ type: 'setAichat_uuid', payload: (status as any).aichat_uuid });
            }
            dispatchAIChatBot({ type: 'setStatusMessage', payload: status.message ?? null });
          },
          (final) => {
            dispatchAIChatBot({ type: 'setIsNoLongerWaitingForResponse' });
            dispatchAIChatBot({
              type: 'addMessage',
              payload: { sender: 'ai', message: final.content || streamingBufferRef.current, type: 'ai' },
            });
            resetStreamingState();
            controllerRef.current = null;
          },
          (error) => {
            dispatchAIChatBot({ type: 'setIsNoLongerWaitingForResponse' });
            dispatchAIChatBot({
              type: 'setError',
              payload: {
                isError: true,
                status: 500,
                error_message: error.error || 'Streaming failed',
              },
            });
            resetStreamingState();
            controllerRef.current = null;
          },
          controller.signal,
        );
      } else {
        // Start new chat session with streaming
        await startActivityAIChatSessionStream(
          message,
          props.activity.activity_uuid,
          access_token,
          (chunk) => {
            if (chunk.content) {
              streamingBufferRef.current += chunk.content;
              dispatchAIChatBot({ type: 'setStreamingMessage', payload: streamingBufferRef.current });
            }
          },
          (status) => {
            if ((status as any)?.aichat_uuid) {
              dispatchAIChatBot({ type: 'setAichat_uuid', payload: (status as any).aichat_uuid });
            }
            dispatchAIChatBot({ type: 'setStatusMessage', payload: status.message ?? null });
          },
          (final) => {
            dispatchAIChatBot({ type: 'setIsNoLongerWaitingForResponse' });

            if ((final as any).aichat_uuid) {
              dispatchAIChatBot({
                type: 'setAichat_uuid',
                payload: (final as any).aichat_uuid,
              });
            }

            dispatchAIChatBot({
              type: 'addMessage',
              payload: { sender: 'ai', message: final.content || streamingBufferRef.current, type: 'ai' },
            });
            resetStreamingState();
            controllerRef.current = null;
          },
          (error) => {
            dispatchAIChatBot({ type: 'setIsNoLongerWaitingForResponse' });
            dispatchAIChatBot({
              type: 'setError',
              payload: {
                isError: true,
                status: 500,
                error_message: error.error || 'Streaming failed',
              },
            });
            resetStreamingState();
            controllerRef.current = null;
          },
          controller.signal,
        );
      }
    } catch (error) {
      await dispatchAIChatBot({ type: 'setIsNoLongerWaitingForResponse' });
      await dispatchAIChatBot({
        type: 'setError',
        payload: {
          isError: true,
          status: 500,
          error_message: error instanceof Error ? error.message : 'Unknown error',
        },
      });
      resetStreamingState();
      controllerRef.current = null;
    }
  };

  const getTooltipLabel = (label: string) => {
    switch (label) {
      case 'Explain': {
        return t('explainTooltip');
      }
      case 'Summarize': {
        return t('summarizeTooltip');
      }
      case 'Translate': {
        return t('translateTooltip');
      }
      case 'Examples': {
        return t('examplesTooltip');
      }
      default: {
        return '';
      }
    }
  };

  const getButtonLabel = (label: string) => {
    switch (label) {
      case 'Explain': {
        return t('explainLabel');
      }
      case 'Summarize': {
        return t('summarizeLabel');
      }
      case 'Translate': {
        return t('translateLabel');
      }
      case 'Examples': {
        return t('examplesLabel');
      }
      default: {
        return label;
      }
    }
  };

  return (
    <div className="flex space-x-2">
      <ToolTip
        sideOffset={10}
        slateBlack
        content={getTooltipLabel(props.label)}
      >
        <button
          onClick={() => handleAction(props.label)}
          className="flex items-center space-x-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-sm font-semibold text-white/80 ring-1 ring-white/5 transition-all duration-200 hover:bg-white/20 hover:text-white hover:shadow-lg hover:ring-white/20 focus:ring-2 focus:ring-white/40 focus:outline-none active:scale-95"
          aria-label={getButtonLabel(props.label)}
          type="button"
        >
          {props.label === 'Explain' && (
            <BookOpen
              size={16}
              className="transition-transform group-hover:scale-110"
            />
          )}
          {props.label === 'Summarize' && (
            <FormInput
              size={16}
              className="transition-transform group-hover:scale-110"
            />
          )}
          {props.label === 'Translate' && (
            <Languages
              size={16}
              className="transition-transform group-hover:scale-110"
            />
          )}
          {props.label === 'Examples' && <div className="text-xs font-bold text-white/60">{t('examplesAbbr')}</div>}
          <div>{getButtonLabel(props.label)}</div>
        </button>
      </ToolTip>
    </div>
  );
};

export default AICanvaToolkit;
