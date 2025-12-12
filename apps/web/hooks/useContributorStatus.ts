import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getCourseContributors } from '@services/courses/courses';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

export type ContributorStatus = 'NONE' | 'PENDING' | 'ACTIVE' | 'INACTIVE';

interface Contributor {
  user_id: number;
  authorship_status: ContributorStatus;
}

export function useContributorStatus(courseUuid: string) {
  const session = usePlatformSession() as any;
  const [contributorStatus, setContributorStatus] = useState<ContributorStatus>('NONE');
  const [isLoading, setIsLoading] = useState(true);
  const t = useTranslations('Hooks.useContributorStatus');
  const accessToken = session?.data?.tokens?.access_token;
  const userId = session?.data?.user?.id;

  const checkContributorStatus = useCallback(async () => {
    if (!userId) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await getCourseContributors(
        courseUuid.startsWith('course_') ? courseUuid : `course_${courseUuid}`,
        accessToken,
      );

      if (response?.data && Array.isArray(response.data)) {
        const currentUser = response.data.find((contributor: Contributor) => contributor.user_id === userId);

        if (currentUser) {
          setContributorStatus(currentUser.authorship_status as ContributorStatus);
        } else {
          setContributorStatus('NONE');
        }
      } else {
        setContributorStatus('NONE');
      }
    } catch (error) {
      console.error(`${t('checkStatusError')}: ${error}`);
      toast.error(t('checkStatusError'));
      setContributorStatus('NONE');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseUuid, accessToken, userId]);

  useEffect(() => {
    if (userId) {
      checkContributorStatus();
    }
  }, [checkContributorStatus, userId]);

  return { contributorStatus, isLoading, refetch: checkContributorStatus };
}
