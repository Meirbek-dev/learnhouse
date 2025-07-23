'use client';

import type React from 'react';

import UserAvatar from '@components/Objects/UserAvatar';
import { Button } from '@/components/ui/button';
import RichTextEditor from './rich-text-editor';
import { Send } from 'lucide-react';
import { useState } from 'react';

interface DiscussionFormProps {
  currentUser: any;
  onSubmit: (content: string) => void;
  t: (key: string) => string;
}

export default function DiscussionForm({ currentUser, onSubmit, t }: DiscussionFormProps) {
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Check if content has meaningful text (not just empty HTML tags)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';

    if (!textContent.trim()) return;
    onSubmit(content);
    setContent('');
  };

  return (
    <div className="bg-card text-card-foreground rounded-lg border p-5 shadow-sm">
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
            <RichTextEditor
              content={content}
              onChange={setContent}
              placeholder={t('startDiscussionPlaceholder')}
              minHeight="120px"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button
            type="submit"
            disabled={!content.trim()}
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
