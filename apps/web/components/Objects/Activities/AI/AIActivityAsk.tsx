'use client';

import { useActivityAIChat } from '@components/Contexts/AI/ActivityAIChatContext';
import { AlertTriangle, BadgeInfo, NotebookTabs, X } from 'lucide-react';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { AiMessageBubble } from '@components/Shared/AI/AiMessageBubble';
import { AiChatInput } from '@components/Shared/AI/AiChatInput';
import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import platformLogoLight from '@public/platform_logo_light.svg';
import UserAvatar from '@components/Objects/UserAvatar';
import { ScrollArea } from '@components/ui/scroll-area';
import { Separator } from '@components/ui/separator';
import { Spinner } from '@components/ui/spinner';
import { AnimatePresence, motion } from 'motion/react';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { useTranslations } from 'next-intl';
import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import type { TextPart } from '@tanstack/ai-client';

// ── Types ─────────────────────────────────────────────────────────────────────

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

// ── Main Trigger Button ────────────────────────────────────────────────────────

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
      <ActivityChatPanel />
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

// ── Chat Panel ─────────────────────────────────────────────────────────────────

const ActivityChatPanel = () => {
  const t = useTranslations('Activities.AIActivityAsk');
  const session = usePlatformSession();

  const {
    messages,
    sendMessage,
    isLoading,
    stop,
    error,
    statusMessage,
    isModalOpen,
    setIsModalOpen,
    inputValue,
    setInputValue,
  } = useActivityAIChat();

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const hasMessages = messages.length > 0;
  const hasError = error !== undefined;

  // Auto-scroll to the latest message.
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Abort stream and clear input when the panel closes.
  useEffect(() => {
    if (!isModalOpen) {
      stop();
      setInputValue('');
    }
  }, [isModalOpen, stop, setInputValue]);

  const handleSend = () => {
    if (!isLoading && inputValue.trim()) {
      sendMessage(inputValue);
      setInputValue('');
    }
  };

  const closePanel = () => setIsModalOpen(false);

  return (
    <AnimatePresence>
      {isModalOpen && (
        <>
          {/* Mobile backdrop */}
          <motion.div
            key="ai-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-40 bg-black/50 md:hidden"
            onClick={closePanel}
            aria-hidden="true"
          />

          {/* Panel */}
          <motion.div
            key="ai-panel"
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.18, ease: 'easeOut' }}
            className={cn(
              'fixed z-50 flex flex-col overflow-hidden',
              'border border-zinc-700/60 bg-zinc-900 shadow-2xl',
              'inset-x-0 bottom-0 rounded-t-2xl',
              'h-[62dvh]',
              'md:bottom-4 md:left-1/2 md:h-auto md:max-h-[620px] md:min-h-[380px] md:w-[min(680px,95vw)] md:-translate-x-1/2 md:rounded-xl',
            )}
            style={{ pointerEvents: 'auto' }}
            role="dialog"
            aria-label={t('AI')}
            aria-modal="true"
          >
            {/* Mobile drag-handle pill */}
            <div
              className="mx-auto mt-2.5 h-1 w-10 flex-shrink-0 rounded-full bg-zinc-700 md:hidden"
              aria-hidden="true"
            />

            <div className="flex flex-1 flex-col overflow-hidden p-4 pt-3">
              {/* Header */}
              <div className="mb-3 flex flex-shrink-0 items-center justify-between">
                <div className="flex items-center gap-2">
                  <Image
                    className="rounded-sm"
                    width={20}
                    height={20}
                    src={platformLogoLight}
                    alt={t('logoAlt')}
                  />
                  <span className="text-sm font-semibold text-zinc-100">{t('AI')}</span>
                  {isLoading && <Spinner className="h-3.5 w-3.5 text-zinc-400" />}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={closePanel}
                  aria-label={t('closePanel')}
                  className="h-7 w-7 text-zinc-500 hover:text-zinc-300"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {/* Status hint */}
              {statusMessage && (
                <p className="mb-2 flex-shrink-0 text-xs text-zinc-500">{statusMessage}</p>
              )}

              {/* Messages area */}
              <div className="mb-3 min-h-0 flex-1 overflow-hidden">
                {hasMessages && !hasError ? (
                  <ScrollArea className="h-full overscroll-contain pr-1">
                    <div className="space-y-3 pb-2">
                      {messages.map((message, index) => {
                        const text = message.parts
                          .filter((p): p is TextPart => p.type === 'text')
                          .map((p) => p.content)
                          .join('');
                        const isLast = index === messages.length - 1;
                        const isStreamingThis = isLast && isLoading && message.role === 'assistant';
                        return (
                          <AiMessageBubble
                            key={message.id ?? index}
                            role={message.role as 'user' | 'assistant'}
                            content={text}
                            isStreaming={isStreamingThis}
                          />
                        );
                      })}
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
                    sendMessage={(msg) => {
                      sendMessage(msg);
                    }}
                    session={session}
                  />
                )}
              </div>

              <Separator className="mb-3 flex-shrink-0 bg-zinc-800" />

              {/* Input row */}
              <div className="flex-shrink-0">
                <AiChatInput
                  value={inputValue}
                  onChange={setInputValue}
                  onSend={handleSend}
                  disabled={isLoading}
                  placeholder={t('placeholder')}
                  showAvatar
                />
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

// ── Error Display ──────────────────────────────────────────────────────────────

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

// ── Placeholder ────────────────────────────────────────────────────────────────

interface AIMessagePlaceHolderProps {
  sendMessage: (message: string) => void;
  session: ReturnType<typeof usePlatformSession> | null;
}

const AIMessagePlaceHolder = ({ sendMessage, session }: AIMessagePlaceHolderProps) => {
  const t = useTranslations('Activities.AIActivityAsk');

  const userName =
    session?.data?.user?.first_name || session?.data?.user?.username || '\u041f\u043e\u043b\u044c\u0437\u043e\u0432\u0430\u0442\u0435\u043b\u044c';

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

// ── Predefined Question Badge ──────────────────────────────────────────────────

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
