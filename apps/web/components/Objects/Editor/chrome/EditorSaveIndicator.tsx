'use client';

import { useTranslations } from 'next-intl';
import { Check, Loader2 } from 'lucide-react';

interface EditorSaveIndicatorProps {
  saveState: 'idle' | 'saving' | 'saved' | 'error';
}

export function EditorSaveIndicator({ saveState }: EditorSaveIndicatorProps) {
  const t = useTranslations('DashPage.Editor.EditorWrapper');

  if (saveState === 'idle') return null;

  return (
    <span className="flex items-center gap-1.5 rounded-md px-2 py-0.5 text-xs text-muted-foreground">
      {saveState === 'saving' ? (
        <>
          <Loader2 className="size-3 animate-spin" />
          <span>{t('saving')}</span>
        </>
      ) : saveState === 'saved' ? (
        <>
          <Check className="size-3 text-emerald-600" />
          <span>{t('saveSuccess')}</span>
        </>
      ) : (
        <span className="font-medium text-destructive">{t('saveError')}</span>
      )}
    </span>
  );
}
