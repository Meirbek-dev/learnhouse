import { CheckIcon, Cross2Icon } from '@radix-ui/react-icons';
import { useEffect, useState } from 'react';
import type React from 'react';

interface LinkInputTooltipProps {
  onSave: (url: string) => void;
  onCancel: () => void;
  currentUrl?: string;
}

const LinkInputTooltip: React.FC<LinkInputTooltipProps> = ({ onSave, onCancel, currentUrl }) => {
  const [url, setUrl] = useState(currentUrl || '');

  useEffect(() => {
    setUrl(currentUrl || '');
  }, [currentUrl]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url) {
      // Ensure the URL has a protocol
      const formattedUrl = url.startsWith('http://') || url.startsWith('https://') ? url : `https://${url}`;
      onSave(formattedUrl);
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
          placeholder="Enter URL"
          value={url}
          onChange={(e) => {
            setUrl(e.target.value);
          }}
          className="w-[200px] rounded border border-gray-300/50 px-2 py-1 text-xs focus:border-gray-300/80 focus:outline-none"
        />
        <div className="flex gap-0.5">
          <button
            type="submit"
            disabled={!url}
            className="flex cursor-pointer items-center justify-center rounded bg-gray-300/24 p-1 text-green-500 transition-colors hover:bg-gray-300/48 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <CheckIcon />
          </button>
          <button
            type="button"
            onClick={onCancel}
            className="flex cursor-pointer items-center justify-center rounded bg-gray-300/24 p-1 text-red-500 transition-colors hover:bg-gray-300/48"
          >
            <Cross2Icon />
          </button>
        </div>
      </form>
    </div>
  );
};

export default LinkInputTooltip;
