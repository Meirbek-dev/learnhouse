'use client';

import { useActivityAIChat } from '@components/Contexts/AI/ActivityAIChatContext';
import { AlertTriangle, BadgeInfo, NotebookTabs, Send, X } from 'lucide-react';
import { usePlatformSession } from '@/components/Contexts/SessionContext';

// for typing the session prop without exporting internal types
export type PlatformSession = ReturnType<typeof usePlatformSession>;
import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import platformLogoLight from '@public/platform_logo_light.svg';
import UserAvatar from '@components/Objects/UserAvatar';
import { ScrollArea } from '@components/ui/scroll-area';
import { Separator } from '@components/ui/separator';
import { Spinner } from '@components/ui/spinner';
import { Card, CardContent } from '@components/ui/card';
import type { KeyboardEvent } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Badge } from '@components/ui/badge';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { TextPart } from '@tanstack/ai-client';

// Type definitions
interface Activity {
  activity_uuid: string;
  [key: string]: any;
}

interface AIActivityAskProps {
  activity: Activity;
}

interface ErrorState {
  isError: boolean;
  status?: number;
  error_message?: string;
}

type PredefinedQuestionType = 'about' | 'flashcards' | 'examples';

// Main Component
const AIActivityAsk = ({ activity: _activity }: AIActivityAskProps) => {
  const t = useTranslations('Activities.AIActivityAsk');
  const { isModalOpen, setIsModalOpen } = useActivityAIChat();

  const handleToggleModal = () => setIsModalOpen(!isModalOpen);

  const handleKeyDown = (e: any) => {
    const key = e?.key ?? e?.nativeEvent?.key;
    if (key === 'Enter' || key === ' ') {
      e?.preventDefault?.();
      handleToggleModal();
    }
  };

  return (
    <>
      <ActivityChatMessageBox />
      <Button
        variant="outline"
        size="sm"
        role="button"
        tabIndex={0}
        aria-pressed={isModalOpen}
        onKeyDown={handleKeyDown}
        onClick={handleToggleModal}
        className={cn(
          'h-9 gap-2 rounded-full border-zinc-700 bg-zinc-900 px-4 text-zinc-200 hover:bg-zinc-800 hover:text-white',
          isModalOpen && 'border-zinc-600 bg-zinc-800 text-white',
        )}
      >
        <Image
          className="rounded-sm"
          width={16}
          height={16}
          src={platformLogoLight}
          alt={t('askAI')}
        />
        <span className="text-xs font-semibold">{t('askAI')}</span>
      </Button>
    </>
  );
};

// Chat Message Box Component
const ActivityChatMessageBox = () => {
  const t = useTranslations('Activities.AIActivityAsk');
  const session = usePlatformSession();

  const { messages, sendMessage, isLoading, stop, error, statusMessage, isModalOpen, setIsModalOpen, inputValue, setInputValue } =
    useActivityAIChat();

  const scrollYRef = useRef(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Extract streaming text from the last assistant message during generation.
  const lastMsg = messages.at(-1);
  const streamingText =
    isLoading && lastMsg?.role === 'assistant'
      ? lastMsg.parts
          .filter((p): p is TextPart => p.type === 'text')
          .map((p) => p.content)
          .join('')
      : '';

  const hasMessages = messages.length > 0;
  const hasError = error !== undefined;

  // Lock scroll on mobile when modal is open.
  useEffect(() => {
    if (typeof globalThis.window === 'undefined') return;

    const isSmallViewport = globalThis.matchMedia('(max-width: 767px)').matches;

    if (isModalOpen && isSmallViewport) {
      scrollYRef.current = window.scrollY || window.pageYOffset || 0;
      document.body.style.position = 'fixed';
      document.body.style.top = `-${scrollYRef.current}px`;
      document.body.style.left = '0';
      document.body.style.right = '0';
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';

      if (!isModalOpen && isSmallViewport) {
        window.scrollTo(0, scrollYRef.current || 0);
      }
    }

    return () => {
      document.body.style.position = '';
      document.body.style.top = '';
      document.body.style.left = '';
      document.body.style.right = '';
      document.body.style.overflow = '';
      if (isSmallViewport) window.scrollTo(0, scrollYRef.current || 0);
    };
  }, [isModalOpen]);

  // Auto-scroll: instant during streaming, smooth on committed messages.
  useEffect(() => {
    if (streamingText) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'instant' as ScrollBehavior });
    }
  }, [streamingText]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Abort stream and clear input when the modal closes.
  useEffect(() => {
    if (!isModalOpen) {
      stop();
      setInputValue('');
    }
  }, [isModalOpen, stop, setInputValue]);

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' && !isLoading && inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const handleSend = () => {
    if (!isLoading && inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const closeModal = () => setIsModalOpen(false);

  return (
    <AnimatePresence>
      {isModalOpen && (
        <motion.div
          initial={{ y: 12, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 8, opacity: 0 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
          className="fixed bottom-4 left-1/2 z-50 w-[95%] max-w-2xl -translate-x-1/2"
          style={{ pointerEvents: 'auto' }}
        >
          <Card className="h-[340px] overflow-hidden border-zinc-700/60 bg-zinc-900 shadow-xl">
            <CardContent className="flex h-full flex-col p-4">
              {/* Header */}
              <div className="mb-3 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image
                    className="rounded-sm"
                    width={20}
                    height={20}
                    src={platformLogoLight}
                    alt={t('AI')}
                  />
                  <span className="text-sm font-semibold text-zinc-100">{t('AI')}</span>
                  {isLoading && <Spinner className="h-3.5 w-3.5 text-zinc-400" />}
                </div>

                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closeModal}
                  className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Status Message */}
              {statusMessage && <p className="mb-2 text-xs text-zinc-500">{statusMessage}</p>}

              {/* Messages Area */}
              <div className="mb-3 flex-1 overflow-hidden">
                {hasMessages && !hasError ? (
                  <ScrollArea className="h-full pr-2">
                    <div className="space-y-3">
                      {messages.map((message, index) => {
                        const text = message.parts
                          .filter((p): p is TextPart => p.type === 'text')
                          .map((p) => p.content)
                          .join('');
                        return (
                          <AIMessageComponent
                            key={`${message.role}-${index}`}
                            role={message.role as 'user' | 'assistant'}
                            text={text}
                          />
                        );
                      })}
                      {streamingText && (
                        <AIMessageComponent
                          role="assistant"
                          text={streamingText}
                        />
                      )}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                ) : hasError ? (
                  <ErrorDisplay
                    error={{ isError: true, error_message: error?.message }}
                    t={t}
                  />
                ) : (
                  <AIMessagePlaceHolder
                    sendMessage={(msg) => sendMessage(msg)}
                    session={session}
                  />
                )}
              </div>

              <Separator className="mb-3 bg-zinc-800" />

              {/* Input Area */}
              <div className="flex items-center gap-2">
                <UserAvatar
                  size="sm"
                  variant="outline"
                />
                <Input
                  onKeyDown={handleKeyDown}
                  onChange={(e) => setInputValue(e.currentTarget.value)}
                  disabled={isLoading}
                  value={inputValue}
                  placeholder={t('placeholder')}
                  className="flex-1 border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
                />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleSend}
                  disabled={isLoading || !inputValue.trim()}
                  className="h-9 w-9 text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

// AI Message Component
interface AIMessageComponentProps {
  role: 'user' | 'assistant';
  text: string;
}

const AIMessageComponent = ({ role, text }: AIMessageComponentProps) => {
  return (
    <div className={cn('flex gap-2', role === 'user' && 'flex-row-reverse')}>
      <UserAvatar
        size="sm"
        variant="outline"
        predefined_avatar={role === 'assistant' ? 'ai' : undefined}
      />
      <div
        className={cn(
          'max-w-[78%] rounded-lg px-3 py-2 text-sm leading-relaxed',
          role === 'assistant' ? 'bg-zinc-800 text-zinc-100' : 'bg-indigo-600/20 text-zinc-100',
        )}
      >
        <p className="whitespace-pre-wrap">{text}</p>
      </div>
    </div>
  );
};

// Error Display Component
interface ErrorDisplayProps {
  error: ErrorState;
  t: (key: string) => string;
}

const ErrorDisplay = ({ error, t }: ErrorDisplayProps) => (
  <div className="flex h-full items-center justify-center">
    <Alert
      variant="destructive"
      className="max-w-md"
    >
      <AlertTriangle className="h-4 w-4" />
      <AlertTitle>{t('errorTitle')}</AlertTitle>
      <AlertDescription>{error.error_message}</AlertDescription>
    </Alert>
  </div>
);

// Placeholder Component
interface AIMessagePlaceHolderProps {
  sendMessage: (message: string) => void;
  session: PlatformSession | null;
}

const AIMessagePlaceHolder = ({ sendMessage, session }: AIMessagePlaceHolderProps) => {
  const t = useTranslations('Activities.AIActivityAsk');

  const userName = session?.data?.user?.first_name || session?.data?.user?.username || 'Пользователь';

  return (
    <div className="flex h-full flex-col items-center justify-center gap-5">
      <div className="text-center">
        <p className="flex flex-wrap items-center justify-center gap-1.5 text-sm font-medium text-zinc-400">
          <span>{t('hello')}</span>
          <span className="flex items-center gap-1.5 capitalize">
            <UserAvatar
              size="sm"
              variant="outline"
            />
            <span className="text-zinc-300">{userName},</span>
          </span>
          <span>{t('howCanWeHelp')}</span>
        </p>
      </div>

      <div className="flex flex-wrap justify-center gap-2">
        <AIChatPredefinedQuestion
          sendMessage={sendMessage}
          label="about"
        />
        <AIChatPredefinedQuestion
          sendMessage={sendMessage}
          label="flashcards"
        />
        <AIChatPredefinedQuestion
          sendMessage={sendMessage}
          label="examples"
        />
      </div>
    </div>
  );
};

// Predefined Question Component
interface AIChatPredefinedQuestionProps {
  sendMessage: (message: string) => void;
  label: PredefinedQuestionType;
}

const AIChatPredefinedQuestion = ({ sendMessage, label }: AIChatPredefinedQuestionProps) => {
  const t = useTranslations('Activities.AIActivityAsk');

  const questions: Record<PredefinedQuestionType, string> = {
    about: t('questionAbout'),
    flashcards: t('questionFlashcards'),
    examples: t('questionExamples'),
  };

  const icons: Record<PredefinedQuestionType, ReactNode> = {
    about: <BadgeInfo className="h-3.5 w-3.5" />,
    flashcards: <NotebookTabs className="h-3.5 w-3.5" />,
    examples: <span className="text-xs font-bold leading-none">{t('examplesAbbr')}</span>,
  };

  const question = questions[label];

  return (
    <Badge
      variant="outline"
      className="cursor-pointer gap-1.5 border-zinc-700 bg-zinc-800 py-1 text-zinc-400 transition-colors hover:border-zinc-600 hover:bg-zinc-700 hover:text-zinc-200"
      onClick={() => sendMessage(question)}
    >
      {icons[label]}
      <span className="text-xs">{question}</span>
    </Badge>
  );
};

export default AIActivityAsk;
