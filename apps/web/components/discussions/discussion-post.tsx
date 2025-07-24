'use client';

import { ArrowBigUp, ArrowBigDown, Clock, Edit, Reply, Send, Trash2 } from 'lucide-react';
import { useFormatter, useNow, useTranslations } from 'next-intl';
import { useState } from 'react';
import type React from 'react';

import useAdminStatus from '@components/Hooks/useAdminStatus';
import RichContentRenderer from './rich-content-renderer';
import { useOrg } from '@components/Contexts/OrgContext';
import UserAvatar from '@components/Objects/UserAvatar';
import { Separator } from '@/components/ui/separator';
import DiscussionReply from './discussion-reply';
import { Button } from '@/components/ui/button';
import RichTextEditor from './rich-text-editor';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DiscussionPostProps {
  post: any;
  currentUser: any;
  onVotePost: (postId: string, voteType: 'up' | 'down') => void;
  onVoteReply: (postId: string, replyId: string, voteType: 'up' | 'down') => void;
  onDeletePost: (postId: string) => void;
  onDeleteReply: (postId: string, replyId: string) => void;
  onEditPost: (postId: string, newMessage: string) => void;
  onEditReply: (postId: string, replyId: string, newMessage: string) => void;
  onSubmitReply: (postId: string, replyText: string) => void;
}

export default function DiscussionPost({
  post,
  currentUser,
  onVotePost,
  onVoteReply,
  onDeletePost,
  onDeleteReply,
  onEditPost,
  onEditReply,
  onSubmitReply,
}: DiscussionPostProps) {
  const t = useTranslations('CoursePage');
  const [replyingTo, setReplyingTo] = useState<boolean>(false);
  const [replyContent, setReplyContent] = useState('');
  const [editingPost, setEditingPost] = useState(false);
  const [editContent, setEditContent] = useState(post.postMessage);
  const format = useFormatter();
  const now = useNow();
  const org = useOrg() as any;
  const { isAdmin } = useAdminStatus();

  const isOwnPost = post.username === currentUser?.username;
  const netScore = post.upvotes - post.downvotes;

  const getUserDisplayName = (firstName?: string, lastName?: string) => {
    const first = firstName || '';
    const last = lastName || '';
    return `${first} ${last}`.trim() || 'Anonymous';
  };

  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    // Check if content has meaningful text (not just empty HTML tags)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = replyContent;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';

    if (!textContent.trim()) return;
    onSubmitReply(post.id, replyContent);
    setReplyContent('');
    setReplyingTo(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Check if content has meaningful text (not just empty HTML tags)
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = editContent;
    const textContent = tempDiv.textContent || tempDiv.innerText || '';

    if (!textContent.trim()) return;
    onEditPost(post.id, editContent);
    setEditingPost(false);
  };

  // Helper to check if a given user is admin for the org
  const isAuthorAdmin = (username: string) => {
    if (!org || !org.id || !post || !post.username) return false;
    // If current user is admin and is the author, show badge
    return isAdmin && username === currentUser?.username;
  };

  return (
    <div className="bg-card text-card-foreground overflow-hidden rounded-lg border shadow-sm">
      <div className="p-5">
        <div className="flex items-start gap-4">
          <UserAvatar
            size="md"
            variant="default"
            username={post.username}
          />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="font-semibold text-neutral-800">{getUserDisplayName(post.firstName, post.lastName)}</h4>
                <span className="text-sm text-neutral-500">@{post.username}</span>
                {isAuthorAdmin(post.username) && (
                  <Badge
                    variant="destructive"
                    className="ml-1"
                  >
                    {t('admin')}
                  </Badge>
                )}
                <div className="flex items-center gap-1 text-xs text-neutral-400">
                  <Clock size={12} />
                  <span>{format.relativeTime(new Date(post.createDate), now)}</span>
                  {post.updateDate !== post.createDate && (
                    <span className="text-xs text-neutral-400">({t('edited')})</span>
                  )}
                </div>
              </div>
              {isOwnPost && !editingPost && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditingPost(true);
                      setEditContent(post.postMessage);
                    }}
                    className="h-8 px-2 text-neutral-500 hover:bg-blue-50 hover:text-blue-600"
                  >
                    <Edit size={14} />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeletePost(post.id)}
                    className="h-8 px-2 text-neutral-500 hover:bg-red-50 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </Button>
                </div>
              )}
            </div>

            {editingPost ? (
              <form
                onSubmit={handleEditSubmit}
                className="mt-3"
              >
                <RichTextEditor
                  content={editContent}
                  onChange={setEditContent}
                  placeholder={t('editPostPlaceholder')}
                  minHeight="120px"
                />
                <div className="mt-3 flex justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setEditingPost(false)}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    type="submit"
                    size="sm"
                    disabled={!editContent.trim()}
                  >
                    {t('save')}
                  </Button>
                </div>
              </form>
            ) : (
              <div className="mt-3">
                <RichContentRenderer content={post.postMessage} />
              </div>
            )}

            <div className="mt-4 flex flex-wrap items-center gap-4">
              <div className="flex items-center rounded-full bg-neutral-100 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onVotePost(post.id, 'up')}
                  className={cn(
                    'h-8 rounded-full px-2 transition-colors',
                    post.userVote === 'up'
                      ? 'bg-green-100 text-green-700'
                      : 'text-neutral-600 hover:bg-green-50 hover:text-green-700',
                  )}
                >
                  <ArrowBigUp
                    size={16}
                    className="mr-1"
                  />
                  <span>{post.upvotes}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onVotePost(post.id, 'down')}
                  className={cn(
                    'h-8 rounded-full px-2 transition-colors',
                    post.userVote === 'down'
                      ? 'bg-red-100 text-red-700'
                      : 'text-neutral-600 hover:bg-red-50 hover:text-red-700',
                  )}
                >
                  <ArrowBigDown
                    size={16}
                    className="mr-1"
                  />
                  <span>{post.downvotes}</span>
                </Button>
                <div
                  className={cn(
                    'px-2 text-sm font-medium',
                    netScore > 0 ? 'text-green-700' : netScore < 0 ? 'text-red-700' : 'text-neutral-600',
                  )}
                >
                  {netScore > 0 && '+'}
                  {netScore}
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setReplyingTo(!replyingTo)}
                className={cn('h-8 rounded-full px-3 text-neutral-600', replyingTo && 'bg-blue-50 text-blue-700')}
              >
                <Reply
                  size={16}
                  className="mr-1"
                />
                <span>{t('reply')}</span>
                {post.replies && post.replies.length > 0 && (
                  <span className="ml-1 rounded-full bg-neutral-200 px-1.5 py-0.5 text-xs">{post.replies.length}</span>
                )}
              </Button>
            </div>

            {replyingTo && (
              <form
                onSubmit={handleSubmitReply}
                className="mt-4"
              >
                <div className="flex items-start gap-3">
                  <UserAvatar
                    size="xs"
                    variant="default"
                    username={currentUser?.username}
                  />
                  <div className="flex-1">
                    <RichTextEditor
                      content={replyContent}
                      onChange={setReplyContent}
                      placeholder={t('writeReplyPlaceholder')}
                      minHeight="100px"
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReplyingTo(false);
                          setReplyContent('');
                        }}
                      >
                        {t('cancel')}
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!replyContent.trim()}
                        className="flex items-center gap-1"
                      >
                        <Send size={14} />
                        <span>{t('reply')}</span>
                      </Button>
                    </div>
                  </div>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>

      {/* Replies */}
      {post.replies && post.replies.length > 0 && (
        <>
          <Separator />
          <div className="bg-neutral-50/80 py-1">
            {post.replies.map((reply: any) => (
              <DiscussionReply
                key={reply.id}
                reply={reply}
                postId={post.id}
                currentUser={currentUser}
                onVoteReply={onVoteReply}
                onDeleteReply={onDeleteReply}
                onEditReply={onEditReply}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
