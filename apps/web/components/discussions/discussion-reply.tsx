'use client';

import type React from 'react';

import { ArrowBigUp, ArrowBigDown, Clock, Edit, Trash2 } from 'lucide-react';
import UserAvatar from '@components/Objects/UserAvatar';
import { useFormatter, useNow } from 'next-intl';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { useOrg } from '@components/Contexts/OrgContext';
import RichTextEditor from './rich-text-editor';
import RichContentRenderer from './rich-content-renderer';

interface DiscussionReplyProps {
  reply: any;
  postId: string;
  currentUser: any;
  onVoteReply: (postId: string, replyId: string, voteType: 'up' | 'down') => void;
  onDeleteReply: (postId: string, replyId: string) => void;
  onEditReply: (postId: string, replyId: string, newMessage: string) => void;
  t: (key: string) => string;
}

export default function DiscussionReply({
  reply,
  postId,
  currentUser,
  onVoteReply,
  onDeleteReply,
  onEditReply,
  t,
}: DiscussionReplyProps) {
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(reply.replyMessage);
  const format = useFormatter();
  const now = useNow();
  const org = useOrg() as any;
  const { isAdmin } = useAdminStatus();

  const isOwnReply = reply.username === currentUser?.username;
  const netScore = reply.upvotes - reply.downvotes;

  const getUserDisplayName = (firstName?: string, lastName?: string) => {
    const first = firstName || '';
    const last = lastName || '';
    return `${first} ${last}`.trim() || 'Anonymous';
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Check if content has meaningful text (not just empty HTML tags)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editContent;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';

    if (!textContent.trim()) return;
    onEditReply(postId, reply.id, editContent);
    setEditing(false);
  };

  // Helper to check if a given user is admin for the org
  const isAuthorAdmin = (username: string) => {
    if (!org || !org.id || !reply || !reply.username) return false;
    // If current user is admin and is the author, show badge
    return isAdmin && username === currentUser?.username;
  };

  return (
    <div className="border-l-2 border-blue-200 mx-4 my-2 pl-4 py-3">
      <div className="flex items-start gap-3">
        <UserAvatar
          size="sm"
          variant="default"
          username={reply.username}
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <h5 className="font-medium text-neutral-800">{getUserDisplayName(reply.firstName, reply.lastName)}</h5>
              <span className="text-sm text-neutral-500">@{reply.username}</span>
              {isAuthorAdmin(reply.username) && (
                <Badge variant="destructive" className="ml-1">{t('admin')}</Badge>
              )}
              <div className="flex items-center gap-1 text-xs text-neutral-400">
                <Clock size={10} />
                <span>{format.relativeTime(new Date(reply.createDate), now)}</span>
              </div>
            </div>
            {isOwnReply && !editing && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setEditing(true);
                    setEditContent(reply.replyMessage);
                  }}
                  className="h-7 px-2 text-xs text-neutral-500 hover:text-blue-600 hover:bg-blue-50"
                >
                  <Edit size={12} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onDeleteReply(postId, reply.id)}
                  className="h-7 px-2 text-xs text-neutral-500 hover:text-red-600 hover:bg-red-50"
                >
                  <Trash2 size={12} />
                </Button>
              </div>
            )}
          </div>

          {editing ? (
            <form
              onSubmit={handleEditSubmit}
              className="mt-2"
            >
              <RichTextEditor
                content={editContent}
                onChange={setEditContent}
                placeholder={t('editReplyPlaceholder')}
                minHeight="80px"
              />
              <div className="mt-2 flex justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(false)}
                  className="h-7 text-xs"
                >
                  {t('cancel')}
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={!editContent.trim()}
                  className="h-7 text-xs"
                >
                  {t('save')}
                </Button>
              </div>
            </form>
          ) : (
            <div className="mt-1">
              <RichContentRenderer
                content={reply.replyMessage}
                className="text-sm"
              />
            </div>
          )}

          {!editing && (
            <div className="mt-2 flex items-center">
              <div className="flex items-center rounded-full bg-neutral-100 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onVoteReply(postId, reply.id, 'up')}
                  className={cn(
                    'h-6 rounded-full px-1.5 text-xs transition-colors',
                    reply.userVote === 'up'
                      ? 'bg-green-100 text-green-700'
                      : 'text-neutral-600 hover:bg-green-50 hover:text-green-700',
                  )}
                >
                  <ArrowBigUp
                    size={12}
                    className="mr-0.5"
                  />
                  <span>{reply.upvotes}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onVoteReply(postId, reply.id, 'down')}
                  className={cn(
                    'h-6 rounded-full px-1.5 text-xs transition-colors',
                    reply.userVote === 'down'
                      ? 'bg-red-100 text-red-700'
                      : 'text-neutral-600 hover:bg-red-50 hover:text-red-700',
                  )}
                >
                  <ArrowBigDown
                    size={12}
                    className="mr-0.5"
                  />
                  <span>{reply.downvotes}</span>
                </Button>
                <div
                  className={cn(
                    'px-1.5 text-xs font-medium',
                    netScore > 0 ? 'text-green-700' : netScore < 0 ? 'text-red-700' : 'text-neutral-600',
                  )}
                >
                  {netScore > 0 && '+'}
                  {netScore}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
