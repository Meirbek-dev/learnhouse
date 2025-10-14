import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type React from 'react';

interface LinkInputTooltipProps {
  onSave: (url: string) => void;
  onCancel: () => void;
  currentUrl?: string;
}

const LinkInputTooltip: React.FC<LinkInputTooltipProps> = ({ onSave, onCancel, currentUrl = '' }) => {
  const [url, setUrl] = useState(currentUrl);
  const t = useTranslations('Components.Editor.LinkInputTooltip');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) {
      // Ensure the URL has a protocol
      const formattedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
      onSave(formattedUrl);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="absolute top-full left-0 z-[1000] mt-1 rounded-md border border-gray-300/50 bg-white p-2 shadow-md">
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-1"
      >
        <input
          type="text"
          placeholder={t('enterUrl')}
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-[200px] rounded border border-gray-300/50 px-2 py-1 text-xs focus:border-blue-500 focus:ring-1 focus:ring-blue-500 focus:outline-none"
        />
        <div className="flex gap-0.5">
          <button
            type="submit"
            disabled={!url.trim()}
            className="flex cursor-pointer items-center justify-center rounded bg-green-50 p-1 text-green-600 transition-colors hover:bg-green-100 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-green-50"
            title={t('saveLink')}
          >
            <CheckIcon />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex cursor-pointer items-center justify-center rounded bg-red-50 p-1 text-red-600 transition-colors hover:bg-red-100"
            title={t('cancel')}
          >
            <Cross2Icon />
          </button>
        </div>
      </form>
    </div>
  );
};

export default LinkInputTooltip;
