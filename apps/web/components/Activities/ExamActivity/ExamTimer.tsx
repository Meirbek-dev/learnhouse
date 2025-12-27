'use client';

import { useEffect, useState, useRef } from 'react';
import { Clock } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface ExamTimerProps {
  startedAt: string;
  timeLimitMinutes?: number | null;
  onExpire?: (reason?: string) => void;
  className?: string;
}

export default function ExamTimer({ startedAt, timeLimitMinutes, onExpire, className = '' }: ExamTimerProps) {
  const t = useTranslations('Activities.ExamActivity');
  const [remaining, setRemaining] = useState<number | null>(null);
  const calledExpire = useRef(false);

  useEffect(() => {
    if (!startedAt || !timeLimitMinutes) {
      // Schedule clearing remaining asynchronously to avoid synchronous setState within effect
      void Promise.resolve().then(() => setRemaining(null));
      return;
    }

    // Reset expire flag when timer params change
    calledExpire.current = false;

    const startTs = new Date(startedAt).getTime();
    const endTs = startTs + (timeLimitMinutes || 0) * 60 * 1000;

    const update = () => {
      const now = Date.now();
      const remMs = Math.max(0, endTs - now);
      const secs = Math.floor(remMs / 1000);
      setRemaining(secs);

      if (remMs <= 0 && !calledExpire.current) {
        calledExpire.current = true;
        onExpire?.('Time expired');
      }
    };

    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [startedAt, timeLimitMinutes, onExpire]);

  if (remaining === null) return null;

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimerColor = (seconds: number | null) => {
    if (seconds === null) return 'text-blue-900';
    if (seconds <= 60) return 'text-red-600';
    if (seconds <= 300) return 'text-orange-600';
    return 'text-blue-900';
  };

  const getTimerBgColor = (seconds: number | null) => {
    if (seconds === null) return 'bg-blue-50';
    if (seconds <= 60) return 'bg-red-50';
    if (seconds <= 300) return 'bg-orange-50';
    return 'bg-blue-50';
  };

  return (
    <div aria-live="polite" className={`flex items-center gap-2 rounded-lg px-4 py-2 ${getTimerBgColor(remaining)} ${className}`}>
      <Clock className={`h-5 w-5 ${remaining <= 60 ? 'animate-pulse' : ''} ${getTimerColor(remaining)}`} />
      <span className={`text-lg font-semibold ${getTimerColor(remaining)}`}>{formatTime(remaining)}</span>
    </div>
  );
}
