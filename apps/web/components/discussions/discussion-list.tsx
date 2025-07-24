'use client';

import { MessageCircle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import DiscussionPost from './discussion-post';
import DiscussionForm from './discussion-form';
import { Badge } from '@/components/ui/badge';

interface DiscussionListProps {
  initialPosts: any[];
  currentUser: any;
}

export default function DiscussionList({ initialPosts, currentUser }: DiscussionListProps) {
  const t = useTranslations('CoursePage');
  const [posts, setPosts] = useState(initialPosts);

  const handleSubmitDiscussion = (content: string) => {
    const newPost = {
      id: Date.now().toString(),
      username: currentUser?.username,
      firstName: currentUser?.first_name || '',
      lastName: currentUser?.last_name || '',
      postMessage: content,
      createDate: new Date().toISOString(),
      updateDate: new Date().toISOString(),
      upvotes: 0,
      downvotes: 0,
      userVote: null,
      replies: [],
    };
    setPosts([newPost, ...posts]);
  };

  const handleSubmitReply = (postId: string, replyContent: string) => {
    const newReply = {
      id: Date.now().toString(),
      username: currentUser?.username,
      firstName: currentUser?.first_name || '',
      lastName: currentUser?.last_name || '',
      replyMessage: replyContent,
      createDate: new Date().toISOString(),
      upvotes: 0,
      downvotes: 0,
      userVote: null,
    };

    setPosts(
      posts.map((post) => (post.id === postId ? { ...post, replies: [...(post.replies || []), newReply] } : post)),
    );
  };

  const handleVotePost = (postId: string, voteType: 'up' | 'down') => {
    setPosts(
      posts.map((post) => {
        if (post.id !== postId) return post;

        let newUpvotes = post.upvotes;
        let newDownvotes = post.downvotes;
        let newUserVote: 'up' | 'down' | null = voteType;

        if (post.userVote === voteType) {
          // Remove vote
          if (voteType === 'up') newUpvotes -= 1;
          else newDownvotes -= 1;
          newUserVote = null;
        } else if (post.userVote === null) {
          // Add new vote
          if (voteType === 'up') newUpvotes += 1;
          else newDownvotes += 1;
        } else {
          // Change vote
          if (post.userVote === 'up') {
            newUpvotes -= 1;
            newDownvotes += 1;
          } else {
            newDownvotes -= 1;
            newUpvotes += 1;
          }
        }

        return {
          ...post,
          upvotes: Math.max(0, newUpvotes),
          downvotes: Math.max(0, newDownvotes),
          userVote: newUserVote,
        };
      }),
    );
  };

  const handleVoteReply = (postId: string, replyId: string, voteType: 'up' | 'down') => {
    setPosts(
      posts.map((post) => {
        if (post.id !== postId) return post;

        return {
          ...post,
          replies: post.replies?.map((reply) => {
            if (reply.id !== replyId) return reply;

            let newUpvotes = reply.upvotes;
            let newDownvotes = reply.downvotes;
            let newUserVote: 'up' | 'down' | null = voteType;

            if (reply.userVote === voteType) {
              // Remove vote
              if (voteType === 'up') newUpvotes -= 1;
              else newDownvotes -= 1;
              newUserVote = null;
            } else if (reply.userVote === null) {
              // Add new vote
              if (voteType === 'up') newUpvotes += 1;
              else newDownvotes += 1;
            } else {
              // Change vote
              if (reply.userVote === 'up') {
                newUpvotes -= 1;
                newDownvotes += 1;
              } else {
                newDownvotes -= 1;
                newUpvotes += 1;
              }
            }

            return {
              ...reply,
              upvotes: Math.max(0, newUpvotes),
              downvotes: Math.max(0, newDownvotes),
              userVote: newUserVote,
            };
          }),
        };
      }),
    );
  };

  const handleDeletePost = (postId: string) => {
    setPosts(posts.filter((post) => post.id !== postId));
  };

  const handleDeleteReply = (postId: string, replyId: string) => {
    setPosts(
      posts.map((post) =>
        post.id === postId ? { ...post, replies: post.replies?.filter((reply) => reply.id !== replyId) } : post,
      ),
    );
  };

  const handleEditPost = (postId: string, newMessage: string) => {
    setPosts(
      posts.map((post) =>
        post.id === postId ? { ...post, postMessage: newMessage, updateDate: new Date().toISOString() } : post,
      ),
    );
  };

  const handleEditReply = (postId: string, replyId: string, newMessage: string) => {
    setPosts(
      posts.map((post) =>
        post.id === postId
          ? {
              ...post,
              replies: post.replies?.map((reply) =>
                reply.id === replyId ? { ...reply, replyMessage: newMessage } : reply,
              ),
            }
          : post,
      ),
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <h2 className="text-2xl font-semibold">{t('courseDiscussions')}</h2>
        <Badge
          variant="secondary"
          className="rounded-full px-2.5"
        >
          {posts.length}
        </Badge>
      </div>

      <DiscussionForm
        currentUser={currentUser}
        onSubmit={handleSubmitDiscussion}
      />

      <div className="space-y-4">
        {posts.map((post) => (
          <DiscussionPost
            key={post.id}
            post={post}
            currentUser={currentUser}
            onVotePost={handleVotePost}
            onVoteReply={handleVoteReply}
            onDeletePost={handleDeletePost}
            onDeleteReply={handleDeleteReply}
            onEditPost={handleEditPost}
            onEditReply={handleEditReply}
            onSubmitReply={handleSubmitReply}
          />
        ))}

        {posts.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <MessageCircle
                size={48}
                className="mx-auto mb-4 text-neutral-300"
              />
              <h3 className="mb-2 text-lg font-semibold text-neutral-600">{t('noDiscussions')}</h3>
              <p className="mb-4 text-neutral-500">{t('noDiscussionsDesc')}</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
