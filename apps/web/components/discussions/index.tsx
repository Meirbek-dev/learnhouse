'use client';

import DiscussionList from './discussion-list';

interface CourseDiscussionsProps {
  initialPosts: any[];
  currentUser: any;
  t: (key: string) => string;
}

export default function CourseDiscussions({ initialPosts, currentUser, t }: CourseDiscussionsProps) {
  return (
    <div className="my-8">
      <DiscussionList
        initialPosts={initialPosts}
        currentUser={currentUser}
        t={t}
      />
    </div>
  );
}
