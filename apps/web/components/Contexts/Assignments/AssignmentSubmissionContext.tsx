'use client';

import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { createContext, use } from 'react';
import type { ReactNode } from 'react';
import useSWR from 'swr';

import { useLHSession } from '../LHSessionContext';

export const AssignmentSubmissionContext = createContext({});

function AssignmentSubmissionProvider({
  children,
  assignment_uuid,
}: {
  children: ReactNode;
  assignment_uuid: string | undefined;
}) {
  const session = useLHSession() as any;
  const accessToken = session?.data?.tokens?.access_token;

  const { data: assignmentSubmission, error: assignmentError } = useSWR(
    assignment_uuid && assignment_uuid !== 'undefined'
      ? `${getAPIUrl()}assignments/${assignment_uuid}/submissions/me`
      : null,
    (url) => swrFetcher(url, accessToken),
  );

  return <AssignmentSubmissionContext value={assignmentSubmission}>{children}</AssignmentSubmissionContext>;
}

export function useAssignmentSubmission() {
  return use(AssignmentSubmissionContext);
}

export default AssignmentSubmissionProvider;
