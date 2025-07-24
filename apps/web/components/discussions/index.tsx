'use client';

import DiscussionList from './discussion-list';

interface CourseDiscussionsProps {
  initialPosts: any[];
  currentUser: any;
}

export default function CourseDiscussions({ initialPosts, currentUser }: CourseDiscussionsProps) {
  return (
    <div className="my-8">
      <DiscussionList
        initialPosts={initialPosts}
        currentUser={currentUser}
      />
    </div>
  );
}
