export const queryKeys = {
  assignments: {
    detail: (assignmentUuid: string) => ['assignments', 'detail', assignmentUuid] as const,
    submissions: (assignmentUuid: string) => ['assignments', 'submissions', assignmentUuid] as const,
    tasks: (assignmentUuid: string) => ['assignments', 'tasks', assignmentUuid] as const,
  },
  codeChallenges: {
    settings: (activityUuid: string) => ['code-challenges', 'settings', activityUuid] as const,
    submission: (submissionUuid: string) => ['code-challenges', 'submission', submissionUuid] as const,
    submissions: (activityUuid: string) => ['code-challenges', 'submissions', activityUuid] as const,
  },
  certifications: {
    course: (courseUuid: string) => ['certifications', 'course', courseUuid] as const,
    userAll: () => ['certifications', 'user-all'] as const,
  },
  courses: {
    metadata: (courseUuid: string) => ['courses', 'metadata', courseUuid] as const,
    updates: (courseUuid: string) => ['courses', 'updates', courseUuid] as const,
  },
  discussions: {
    list: (courseUuid: string, includeReplies = false, limit = 50, offset = 0) =>
      ['courses', 'discussions', courseUuid, { includeReplies, limit, offset }] as const,
    replies: (courseUuid: string, discussionUuid: string, limit = 50, offset = 0) =>
      ['courses', 'discussion-replies', courseUuid, discussionUuid, { limit, offset }] as const,
  },
  exams: {
    activity: (activityUuid: string) => ['exams', 'activity', activityUuid] as const,
    allAttempts: (examUuid: string) => ['exams', 'attempts', 'all', examUuid] as const,
    attempts: (examUuid: string) => ['exams', 'attempts', examUuid] as const,
    config: () => ['exams', 'config'] as const,
    myAttempt: (examUuid: string) => ['exams', 'attempts', 'me', examUuid] as const,
    questions: (examUuid: string) => ['exams', 'questions', examUuid] as const,
  },
  payments: {
    config: () => ['payments', 'config'] as const,
    courseProducts: (courseId: number | string) => ['payments', 'course-products', courseId] as const,
    customers: () => ['payments', 'customers'] as const,
    ownedCourses: () => ['payments', 'owned-courses'] as const,
    productCourses: (productId: number | string) => ['payments', 'product-courses', productId] as const,
    products: () => ['payments', 'products'] as const,
  },
  platform: {
    config: () => ['platform', 'config'] as const,
    courses: () => ['platform', 'courses'] as const,
    permissions: () => ['platform', 'permissions'] as const,
  },
  trail: {
    current: () => ['trail', 'current'] as const,
    leaderboard: (limit = 10) => ['trail', 'leaderboard', { limit }] as const,
  },
  userGroups: {
    all: () => ['user-groups', 'all'] as const,
    resource: (resourceId: string) => ['user-groups', 'resource', resourceId] as const,
    users: (userGroupId: string | number) => ['user-groups', 'users', userGroupId] as const,
  },
  users: {
    allMembers: () => ['users', 'members', 'all'] as const,
    byId: (userId: number) => ['users', 'detail', userId] as const,
    byUsername: (username: string) => ['users', 'username', username] as const,
    members: (page: number, perPage: number) => ['users', 'members', { page, perPage }] as const,
    roles: () => ['users', 'roles'] as const,
  },
};

