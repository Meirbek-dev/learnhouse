'use client';
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle';
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper';
import TrailCourseElement from '@components/Pages/Trail/TrailCourseElement';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { revalidateTags } from '@services/utils/ts/requests';
import { removeCourse } from '@services/courses/activity';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import useSWR from 'swr';

function Trail(params: any) {
  const orgslug = params.orgslug;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;
  const orgID = org?.id;
  const t = useTranslations('TrailPage');
  const router = useRouter();
  const [isQuittingAll, setIsQuittingAll] = useState(false);
  const [quittingProgress, setQuittingProgress] = useState(0);

  const {
    data: trail,
    error,
    mutate,
  } = useSWR(`${getAPIUrl()}trail/org/${orgID}/trail`, (url) => swrFetcher(url, access_token));

  const handleQuitAllCourses = async () => {
    if (!trail?.runs?.length || isQuittingAll) return;

    setIsQuittingAll(true);
    const totalCourses = trail.runs.length;

    try {
      for (let i = 0; i < trail.runs.length; i++) {
        const run = trail.runs[i];
        await removeCourse(run.course.course_uuid, orgslug, access_token);
        setQuittingProgress(Math.round(((i + 1) / totalCourses) * 100));
      }

      await revalidateTags(['courses'], orgslug);
      router.refresh();
      await mutate();
    } catch (error) {
      console.error('Error quitting courses:', error);
    } finally {
      setIsQuittingAll(false);
      setQuittingProgress(0);
    }
  };

  useEffect(() => {}, [trail, org]);

  return (
    <GeneralWrapperStyled>
      <div className="mb-6 flex items-center justify-between">
        <TypeOfContentTitle
          title={t('title')}
          type="tra"
        />
        {trail?.runs?.length > 0 && (
          <ConfirmationModal
            confirmationButtonText={
              isQuittingAll ? t('quittingProgress', { progress: quittingProgress }) : t('quitAllCourses')
            }
            confirmationMessage={t('quitAllCoursesConfirmation')}
            dialogTitle={t('quitAllCoursesDialogTitle')}
            dialogTrigger={
              <button
                disabled={isQuittingAll}
                className={`rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  isQuittingAll
                    ? 'cursor-not-allowed bg-gray-100 text-gray-500'
                    : 'bg-red-100 text-red-700 hover:bg-red-200'
                }`}
              >
                {isQuittingAll ? t('quittingProgress', { progress: quittingProgress }) : t('quitAllCourses')}
              </button>
            }
            functionToExecute={handleQuitAllCourses}
            status="warning"
          />
        )}
      </div>
      {!trail ? (
        <PageLoading />
      ) : (
        <div className="space-y-6">
          {trail.runs.map((run: any) => (
            <TrailCourseElement
              key={run.course.course_uuid}
              run={run}
              course={run.course}
              orgslug={orgslug}
            />
          ))}
        </div>
      )}
    </GeneralWrapperStyled>
  );
}

export default Trail;
