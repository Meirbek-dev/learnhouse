import { useTranslations } from 'next-intl';
import type { KeyboardEvent } from 'react';
import { Check, X } from 'lucide-react';
import { useState } from 'react';

interface LinkInputTooltipProps {
  onSave: (url: string) => void;
  onCancel: () => void;
  currentUrl?: string;
}

const LinkInputTooltip = ({ onSave, onCancel, currentUrl = '' }: LinkInputTooltipProps) => {
  const [url, setUrl] = useState(currentUrl);
  const t = useTranslations('DashPage.Editor.LinkInputTooltip');

  const handleSubmit = (formData: FormData) => {
    const nextUrl = String(formData.get('url') ?? '').trim();

    if (nextUrl) {
      // Ensure the URL has a protocol
      const formattedUrl =
        nextUrl.startsWith('http://') || nextUrl.startsWith('https://') ? nextUrl : `https://${nextUrl}`;
      onSave(formattedUrl);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="absolute top-full left-0 z-[1000] mt-1.5 rounded-lg border border-border bg-popover p-2 shadow-md">
      <form
        action={handleSubmit}
        className="flex items-center gap-1.5"
      >
        <input
          name="url"
          type="text"
          placeholder={t('enterUrl')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-52 rounded-md border border-input bg-background px-2.5 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary/30 focus:outline-none"
        />
        <div className="flex gap-1">
          <button
            type="submit"
            disabled={!url.trim()}
            className="flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
            title={t('saveLink')}
          >
            <Check size={16} />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
            title={t('cancel')}
          >
            <X size={16} />
          </button>
        </div>
      </form>
    </div>
  );
};

export default LinkInputTooltip;
