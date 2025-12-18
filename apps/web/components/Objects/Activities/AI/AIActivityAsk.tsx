'use client';

import { sendActivityAIChatMessageStream, startActivityAIChatSessionStream } from '@services/ai/ai-streaming';
import { useAIChatBot, useAIChatBotDispatch } from '@components/Contexts/AI/AIChatBotContext';
import { AlertTriangle, BadgeInfo, MessageCircle, NotebookTabs, X } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, useTransition } from 'react';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import platformLogoLight from 'public/platform_logo_light.svg';
import UserAvatar from '@components/Objects/UserAvatar';
import { ScrollArea } from '@components/ui/scroll-area';
import type { ChangeEvent, KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useTranslations } from 'next-intl';
import Image from 'next/image';
import clsx from 'clsx';

import useGetAIFeatures from '../../../Hooks/useGetAIFeatures';

interface AIActivityAskProps {
  activity: any;
}

const AIActivityAsk = (props: AIActivityAskProps) => {
  const t = useTranslations('Activities.AIActivityAsk');
  const is_ai_feature_enabled = useGetAIFeatures({ feature: 'activity_ask' });
  const isButtonAvailable = is_ai_feature_enabled;
  const dispatchAIChatBot = useAIChatBotDispatch();
  const aiChatBotState = useAIChatBot();

  return (
    <>
      {isButtonAvailable ? (
        <div>
          <ActivityChatMessageBox activity={props.activity} />
          <div
            role="button"
            tabIndex={0}
            aria-pressed={aiChatBotState.isModalOpen}
            onKeyDown={(e: KeyboardEvent<HTMLDivElement>) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                dispatchAIChatBot({ type: aiChatBotState.isModalOpen ? 'setIsModalClose' : 'setIsModalOpen' });
              }
            }}
            onClick={() =>
              dispatchAIChatBot({ type: aiChatBotState.isModalOpen ? 'setIsModalClose' : 'setIsModalOpen' })
            }
            style={{
              background:
                'linear-gradient(135deg, oklch(0.25 0.15 270) 0%, oklch(0.40 0.18 260) 50%, oklch(0.32 0.16 255) 100%)',
            }}
            className={clsx(
              'flex items-center space-x-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white shadow-lg ring-1 ring-white/10 transition-all duration-200 hover:scale-105 hover:shadow-xl hover:ring-white/20 focus:ring-2 focus:ring-white/30 focus:outline-none active:scale-95',
              { 'ring-2 ring-white/30 shadow-xl': aiChatBotState.isModalOpen },
            )}
          >
            <Image
              className="rounded-md"
              width={20}
              src={platformLogoLight}
              alt={t('askAI')}
              style={{ height: 'auto' }}
            />
            <span className="text-xs font-bold">{t('askAI')}</span>
          </div>
        </div>
      ) : null}
    </>
  );
};

export interface AIMessage {
  sender: string;
  message: any;
  type: 'ai' | 'user';
}

interface ActivityChatMessageBoxProps {
  activity: any;
}

const ActivityChatMessageBox = (props: ActivityChatMessageBoxProps) => {
  const t = useTranslations('Activities.AIActivityAsk');
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const aiChatBotState = useAIChatBot();
  const dispatchAIChatBot = useAIChatBotDispatch();

  // TODO : come up with a better way to handle this
  const inputClass = clsx(
    'w-full rounded-lg bg-gray-950/40 px-4 py-2 text-sm text-white ring-1 ring-white/10 outline-hidden ring-inset placeholder:text-white/30',
    { 'opacity-30': aiChatBotState.isWaitingForResponse },
  );

  // Keep the background scrollable on desktop while still preventing
  // background scroll on small screens (mobile) where the fixed modal can
  // produce awkward scrolling behaviour. We also preserve the current
  // scroll position when locking and restore it on close.
  const scrollYRef = useRef<number>(0);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isSmallViewport = window.matchMedia('(max-width: 767px)').matches;

    if (aiChatBotState.isModalOpen && isSmallViewport) {
      // Save current scroll position and lock the body so the underlying
      // content doesn't move on mobile devices.
      scrollYRef.current = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
    } else {
      // Restore body styles for desktop or when modal is closed.
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';

      // If we were previously locked on mobile, restore the scroll pos.
      if (!aiChatBotState.isModalOpen && isSmallViewport) {
        window.scrollTo(0, scrollYRef.current || 0);
      }
    }

    return () => {
      // Cleanup in case the component is unmounted while modal is open.
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      if (isSmallViewport) window.scrollTo(0, scrollYRef.current || 0);
    };
  }, [aiChatBotState.isModalOpen]);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      // Perform the sending action here
      sendMessage(event.currentTarget.value);
    }
  }

  const handleChange = async (event: ChangeEvent<HTMLInputElement>) => {
    await dispatchAIChatBot({
      type: 'setChatInputValue',
      payload: event.currentTarget.value,
    });
  };

  const [isPending, startTransition] = useTransition();
  const controllerRef = useRef<AbortController | null>(null);
  const streamingBufferRef = useRef('');

  const resetStreamingState = useCallback(async () => {
    streamingBufferRef.current = '';
    await dispatchAIChatBot({ type: 'clearStreamingMessage' });
    await dispatchAIChatBot({ type: 'setStatusMessage', payload: null });
  }, [dispatchAIChatBot]);

  const startNewController = useCallback(() => {
    if (controllerRef.current) {
      controllerRef.current.abort();
    }
    const controller = new AbortController();
    controllerRef.current = controller;
    return controller;
  }, []);

  useEffect(() => {
    return () => {
      controllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (!aiChatBotState.isModalOpen && controllerRef.current) {
      controllerRef.current.abort();
      controllerRef.current = null;
      resetStreamingState();
    }
  }, [aiChatBotState.isModalOpen, resetStreamingState]);

  const sendMessage = async (message: string) => {
    // Add user message
    await dispatchAIChatBot({
      type: 'addMessage',
      payload: { sender: 'user', message, type: 'user' },
    });

    startTransition(() => dispatchAIChatBot({ type: 'setIsWaitingForResponse' }));
    await dispatchAIChatBot({ type: 'setChatInputValue', payload: '' });
    await dispatchAIChatBot({ type: 'setStatusMessage', payload: 'Думаю...' });

    await resetStreamingState();
    const controller = startNewController();

    try {
      if (aiChatBotState.aichat_uuid) {
        // Send message to existing chat
        await sendActivityAIChatMessageStream(
          message,
          aiChatBotState.aichat_uuid,
          props.activity.activity_uuid,
          access_token,
          // onChunk: accumulate content as it arrives
          (chunk) => {
            if (chunk.content) {
              streamingBufferRef.current += chunk.content;
              dispatchAIChatBot({ type: 'setStreamingMessage', payload: streamingBufferRef.current });
            }
          },
          // onStatus: handle status updates
          (status) => {
            if ((status as any)?.aichat_uuid) {
              startTransition(() =>
                dispatchAIChatBot({ type: 'setAichat_uuid', payload: (status as any).aichat_uuid }),
              );
            }
            dispatchAIChatBot({ type: 'setStatusMessage', payload: status.message ?? null });
          },
          // onComplete: finalize the message
          (final) => {
            startTransition(() => dispatchAIChatBot({ type: 'setIsNoLongerWaitingForResponse' }));
            dispatchAIChatBot({
              type: 'addMessage',
              payload: { sender: 'ai', message: final.content || streamingBufferRef.current, type: 'ai' },
            });
            resetStreamingState();
            controllerRef.current = null;
          },
          // onError: handle errors
          (error) => {
            startTransition(() => dispatchAIChatBot({ type: 'setIsNoLongerWaitingForResponse' }));
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
        // Start new chat session
        await startActivityAIChatSessionStream(
          message,
          props.activity.activity_uuid,
          access_token,
          // onChunk: accumulate content as it arrives
          (chunk) => {
            if (chunk.content) {
              streamingBufferRef.current += chunk.content;
              dispatchAIChatBot({ type: 'setStreamingMessage', payload: streamingBufferRef.current });
            }
          },
          // onStatus: handle status updates
          (status) => {
            if ((status as any)?.aichat_uuid) {
              startTransition(() =>
                dispatchAIChatBot({ type: 'setAichat_uuid', payload: (status as any).aichat_uuid }),
              );
            }
            dispatchAIChatBot({ type: 'setStatusMessage', payload: status.message ?? null });
          },
          // onComplete: finalize the message
          (final) => {
            startTransition(() => dispatchAIChatBot({ type: 'setIsNoLongerWaitingForResponse' }));

            // Extract aichat_uuid from final response if available
            if ((final as any).aichat_uuid) {
              startTransition(() =>
                dispatchAIChatBot({
                  type: 'setAichat_uuid',
                  payload: (final as any).aichat_uuid,
                }),
              );
            }

            dispatchAIChatBot({
              type: 'addMessage',
              payload: { sender: 'ai', message: final.content || streamingBufferRef.current, type: 'ai' },
            });
            resetStreamingState();
            controllerRef.current = null;
          },
          // onError: handle errors
          (error) => {
            startTransition(() => dispatchAIChatBot({ type: 'setIsNoLongerWaitingForResponse' }));
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
      startTransition(() => dispatchAIChatBot({ type: 'setIsNoLongerWaitingForResponse' }));
      dispatchAIChatBot({
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

  function closeModal() {
    dispatchAIChatBot({ type: 'setIsModalClose' });
  }

  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, []);

  return (
    <AnimatePresence>
      {aiChatBotState.isModalOpen ? (
        <motion.div
          initial={{ y: 20, opacity: 0.3, filter: 'blur(5px)' }}
          animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
          exit={{ y: 50, opacity: 0, filter: 'blur(25px)' }}
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
              background: `linear-gradient(160deg, #0c1222 0%, #1a2332 30%, #2d3748 60%, #4a5568 100%),
                       radial-gradient(ellipse at top left, rgba(99, 179, 237, 0.12) 0%, transparent 60%),
                       radial-gradient(ellipse at bottom right, rgba(167, 139, 250, 0.08) 0%, transparent 60%)`,
            }}
            className="fixed bottom-0 left-1/2 z-50 mx-auto my-10 h-[350px] w-10/12 max-w-(--breakpoint-2xl) -translate-x-1/2 flex-col-reverse rounded-2xl bg-black p-4 text-white shadow-lg ring-1 ring-white/10 ring-inset"
          >
            <div className="flex flex-row-reverse items-center justify-between pb-3">
              <div className="flex items-center space-x-2">
                <X
                  size={20}
                  className="items-center rounded-full bg-white/10 p-1 text-white/50 hover:cursor-pointer"
                  onClick={closeModal}
                />
              </div>
              <div
                className={`ml-[-120px] flex items-center space-x-1 ${
                  aiChatBotState.isWaitingForResponse ? 'animate-pulse' : ''
                }`}
              >
                <Image
                  className={`rounded-lg outline-neutral-200/20 ${
                    aiChatBotState.isWaitingForResponse ? 'animate-pulse' : ''
                  }`}
                  width={28}
                  src={platformLogoLight}
                  alt={t('askAI')}
                  style={{ height: 'auto' }}
                />
                <span className="text-sm font-bold text-white"> {t('AI')}</span>
              </div>
            </div>
            {aiChatBotState.statusMessage ? (
              <p className="text-xs text-white/60">{aiChatBotState.statusMessage}</p>
            ) : null}
            {aiChatBotState.messages.length > 0 && !aiChatBotState.error.isError ? (
              <ScrollArea className="h-[237px] w-full">
                <div className="flex-col space-y-4">
                  {aiChatBotState.messages.map((message: AIMessage, index: number) => {
                    return (
                      <AIMessageComponent
                        key={index}
                        message={message}
                        animated={message.sender === 'ai'}
                      />
                    );
                  })}
                  {aiChatBotState.streamingMessage && (
                    <AIMessageComponent
                      message={{ sender: 'ai', message: aiChatBotState.streamingMessage, type: 'ai' }}
                      animated
                    />
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </ScrollArea>
            ) : (
              <AIMessagePlaceHolder
                sendMessage={sendMessage}
                activity_uuid={props.activity.activity_uuid}
              />
            )}
            {aiChatBotState.error.isError ? (
              <div className="flex h-[237px] items-center">
                <div className="mx-auto flex w-[600px] flex-col space-y-2 rounded-lg bg-red-500/20 p-5 outline-red-500">
                  <AlertTriangle
                    size={20}
                    className="text-red-500"
                  />
                  <div className="flex flex-col">
                    <h3 className="font-semibold text-red-200">{t('errorTitle')}</h3>
                    <span className="text-sm text-red-100">{aiChatBotState.error.error_message}</span>
                  </div>
                </div>
              </div>
            ) : null}
            <div className="flex items-center space-x-2">
              <div className="">
                <UserAvatar
                  size="sm"
                  variant="outline"
                />
              </div>
              <div className="w-full">
                <input
                  onKeyDown={handleKeyDown}
                  onChange={handleChange}
                  disabled={aiChatBotState.isWaitingForResponse || isPending}
                  value={aiChatBotState.chatInputValue}
                  placeholder={t('placeholder')}
                  type="text"
                  className={inputClass}
                  name=""
                  id=""
                />
              </div>
              <div className="">
                <MessageCircle
                  size={20}
                  className="text-white/50 hover:cursor-pointer"
                  onClick={() => sendMessage(aiChatBotState.chatInputValue)}
                />
              </div>
            </div>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
};

interface AIMessageComponentProps {
  message: AIMessage;
  animated: boolean;
}

const AIMessageComponent = (props: AIMessageComponentProps) => {
  const words = props.message.message.split(' ');

  return (
    <div className="flex w-full space-x-2 font-medium antialiased">
      <div className="">
        {props.message.sender === 'ai' ? (
          <UserAvatar
            size="sm"
            variant="outline"
            predefined_avatar="ai"
          />
        ) : (
          <UserAvatar
            size="sm"
            variant="outline"
          />
        )}
      </div>
      <div className="w-full">
        <p
          className="w-full rounded-lg px-2 py-1 text-base text-white outline-hidden placeholder:text-white/30"
          id=""
        >
          <AnimatePresence>
            {words.map((word: string, i: number) => (
              <motion.span
                key={i}
                initial={props.animated ? { opacity: 0, y: -10 } : { opacity: 1, y: 0 }}
                animate={{ opacity: 1, y: 0 }}
                exit={props.animated ? { opacity: 0, y: 10 } : { opacity: 1, y: 0 }}
                transition={props.animated ? { delay: i * 0.1 } : {}}
              >
                {`${word} `}
              </motion.span>
            ))}
          </AnimatePresence>
        </p>
      </div>
    </div>
  );
};

const AIMessagePlaceHolder = (props: { activity_uuid: string; sendMessage: any }) => {
  const t = useTranslations('Activities.AIActivityAsk');
  const session = usePlatformSession() as any;
  const [_feedbackModal, _setFeedbackModal] = useState(false);
  const aiChatBotState = useAIChatBot();

  if (!aiChatBotState.error.isError) {
    return (
      <div className="h-[237px] w-full flex-col">
        <div className="flex flex-col justify-center pt-12 text-center">
          <motion.div
            initial={{ y: 20, opacity: 0, filter: 'blur(5px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: 50, opacity: 0 }}
            transition={{
              type: 'spring',
              bounce: 0.35,
              duration: 1.7,
              mass: 0.2,
              velocity: 2,
              delay: 0.17,
            }}
          >
            <p className="flex items-center justify-center space-x-2 pt-4 text-2xl font-semibold text-white/70">
              <span className="items-center">{t('hello')}</span>
              <span className="flex items-center space-x-2 capitalize">
                <UserAvatar
                  size="sm"
                  variant="outline"
                />
                <span>{session.data.user.first_name ?? session.data.user.username},</span>
              </span>
              <span>{t('howCanWeHelp')}</span>
            </p>
          </motion.div>
          <motion.div
            initial={{ y: 20, opacity: 0, filter: 'blur(5px)' }}
            animate={{ y: 0, opacity: 1, filter: 'blur(0px)' }}
            exit={{ y: 50, opacity: 0 }}
            transition={{
              type: 'spring',
              bounce: 0.35,
              duration: 1.7,
              mass: 0.2,
              velocity: 2,
              delay: 0.27,
            }}
            className="questions mx-auto flex flex-wrap justify-center space-x-3 pt-6"
          >
            <AIChatPredefinedQuestion
              sendMessage={props.sendMessage}
              label="about"
            />
            <AIChatPredefinedQuestion
              sendMessage={props.sendMessage}
              label="flashcards"
            />
            <AIChatPredefinedQuestion
              sendMessage={props.sendMessage}
              label="examples"
            />
          </motion.div>
        </div>
      </div>
    );
  }
};

const AIChatPredefinedQuestion = (props: { sendMessage: any; label: string }) => {
  const t = useTranslations('Activities.AIActivityAsk');

  function getQuestion(label: string) {
    if (label === 'about') {
      return t('questionAbout');
    }
    if (label === 'flashcards') {
      return t('questionFlashcards');
    }
    if (label === 'examples') {
      return t('questionExamples');
    }
    return '';
  }

  return (
    <button
      onClick={() => props.sendMessage(getQuestion(props.label))}
      className="flex items-center space-x-2 rounded-xl bg-white/5 px-4 py-2 text-xs font-semibold text-white/50 ring-1 ring-white/10 transition-all duration-200 hover:bg-white/10 hover:text-white/70 hover:shadow-md hover:ring-white/20 focus:ring-2 focus:ring-white/30 focus:outline-none active:scale-95"
      type="button"
      aria-label={getQuestion(props.label)}
    >
      {props.label === 'about' && <BadgeInfo size={16} />}
      {props.label === 'flashcards' && <NotebookTabs size={16} />}
      {props.label === 'examples' && <div className="text-xs font-bold text-white/50">{t('examplesAbbr')}</div>}
      <span>{getQuestion(props.label)}</span>
    </button>
  );
};

export default AIActivityAsk;
