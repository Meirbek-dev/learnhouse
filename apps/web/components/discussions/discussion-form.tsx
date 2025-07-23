'use client';

import type React from 'react';

import UserAvatar from '@components/Objects/UserAvatar';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Send } from 'lucide-react';
import { useState } from 'react';

interface DiscussionFormProps {
  currentUser: any;
  onSubmit: (text: string) => void;
  t: (key: string) => string;
}

export default function DiscussionForm({ currentUser, onSubmit, t }: DiscussionFormProps) {
  const [text, setText] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;
    onSubmit(text);
    setText('');
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm p-5">
      <form
        onSubmit={handleSubmit}
        className="space-y-4"
      >
        <div className="flex items-start gap-4">
          <UserAvatar
            size="md"
            variant="default"
            username={currentUser?.username}
          />
          <div className="flex-1">
            <Textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={t('startDiscussionPlaceholder')}
              className="resize-none min-h-[100px]"
              rows={3}
              maxLength={2048}
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!text.trim()}
            className="flex items-center gap-2"
          >
            <Send size={16} />
            <span>{t('postDiscussion')}</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
