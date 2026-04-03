'use client';

import { Send } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import UserAvatar from '@components/Objects/UserAvatar';
import type { KeyboardEvent } from 'react';

interface AiChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  disabled?: boolean;
  placeholder?: string;
  /** Whether to show the user avatar to the left of the input. */
  showAvatar?: boolean;
}

/**
 * Shared input row used by AI chat surfaces.
 * Handles Enter-to-send internally so consumers don't need to re-implement it.
 */
export function AiChatInput({
  value,
  onChange,
  onSend,
  disabled = false,
  placeholder = 'Ask AI…',
  showAvatar = true,
}: AiChatInputProps) {
  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !disabled && value.trim()) {
      e.preventDefault();
      onSend();
    }
  };

  return (
    <div className="flex items-center gap-2">
      {showAvatar && (
        <UserAvatar
          size="sm"
          variant="outline"
        />
      )}
      <Input
        value={value}
        onChange={(e) => onChange(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        disabled={disabled}
        placeholder={placeholder}
        aria-label={placeholder}
        className="flex-1 border-zinc-700 bg-zinc-800 text-zinc-100 placeholder:text-zinc-500 focus-visible:ring-zinc-600"
      />
      <Button
        variant="ghost"
        size="icon"
        onClick={onSend}
        disabled={disabled || !value.trim()}
        aria-label="Send message"
        type="button"
        className="h-9 w-9 shrink-0 text-zinc-500 hover:text-zinc-300 disabled:opacity-40"
      >
        <Send className="h-4 w-4" />
      </Button>
    </div>
  );
}
