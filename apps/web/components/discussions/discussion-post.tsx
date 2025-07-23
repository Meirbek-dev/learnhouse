'use client';

import type React from 'react';

import { ArrowBigUp, ArrowBigDown, Clock, Edit, Reply, Send, Trash2 } from 'lucide-react';
import UserAvatar from '@components/Objects/UserAvatar';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import DiscussionReply from './discussion-reply';
import { Button } from '@/components/ui/button';
import { useFormatter, useNow } from 'next-intl';
import { cn } from '@/lib/utils';
import { useState } from 'react';

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
  t: (key: string) => string;
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
  t,
}: DiscussionPostProps) {
  const [replyingTo, setReplyingTo] = useState<boolean>(false);
  const [replyText, setReplyText] = useState('');
  const [editingPost, setEditingPost] = useState(false);
  const [editText, setEditText] = useState(post.postMessage);
  const format = useFormatter();
  const now = useNow();

  const isOwnPost = post.username === currentUser?.username;
  const netScore = post.upvotes - post.downvotes;

  const getUserDisplayName = (firstName?: string, lastName?: string) => {
    const first = firstName || '';
    const last = lastName || '';
    return `${first} ${last}`.trim() || 'Anonymous';
  };

  const handleSubmitReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    onSubmitReply(post.id, replyText);
    setReplyText('');
    setReplyingTo(false);
  };

  const handleEditSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editText.trim()) return;
    onEditPost(post.id, editText);
    setEditingPost(false);
  };

  return (
    <div className="rounded-lg border bg-card text-card-foreground shadow-sm overflow-hidden">
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
                      setEditText(post.postMessage);
                    }}
                    className="h-8 px-2 text-neutral-500 hover:text-blue-600 hover:bg-blue-50"
                  >
                    <Edit
                      size={14}
                    />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeletePost(post.id)}
                    className="h-8 px-2 text-neutral-500 hover:text-red-600 hover:bg-red-50"
                  >
                    <Trash2
                      size={14}
                    />
                  </Button>
                </div>
              )}
            </div>

            {editingPost ? (
              <form
                onSubmit={handleEditSubmit}
                className="mt-3"
              >
                <Textarea
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="resize-none"
                  rows={3}
                  maxLength={2048}
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
                    disabled={!editText.trim()}
                  >
                    {t('save')}
                  </Button>
                </div>
              </form>
            ) : (
              <p className="mt-3 text-neutral-700 leading-relaxed whitespace-pre-line">{post.postMessage}</p>
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
                    <Textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder={t('writeReplyPlaceholder')}
                      className="resize-none"
                      rows={2}
                      maxLength={2048}
                    />
                    <div className="mt-2 flex justify-end gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setReplyingTo(false);
                          setReplyText('');
                        }}
                      >
                        {t('cancel')}
                      </Button>
                      <Button
                        type="submit"
                        size="sm"
                        disabled={!replyText.trim()}
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
                t={t}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
