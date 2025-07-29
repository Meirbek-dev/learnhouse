'use client';

import UserAvatar from '@components/Objects/UserAvatar';
import { Button } from '@/components/ui/button';
import RichTextEditor from './rich-text-editor';
import { useTranslations } from 'next-intl';
import { Send } from 'lucide-react';
import { useState } from 'react';

interface DiscussionFormProps {
  currentUser: any;
  onSubmit: (content: string) => void;
}

export default function DiscussionForm({ currentUser, onSubmit }: DiscussionFormProps) {
  const t = useTranslations('CoursePage');
  const [content, setContent] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Check if content has meaningful text (not just empty HTML tags)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const textContent = tempDiv.textContent || tempDiv.textContent || '';

    if (!textContent.trim()) return;
    onSubmit(content);
    setContent('');
  };

  // Helper function to check if content is empty
  const isContentEmpty = () => {
    if (!content) return true;
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = content;
    const textContent = tempDiv.textContent || tempDiv.textContent || '';
    return !textContent.trim();
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
            disabled={isContentEmpty()}
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
