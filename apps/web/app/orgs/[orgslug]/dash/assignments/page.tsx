'use client';

import { EllipsisVertical, GalleryVerticalEnd, Info, Layers2, UserRoundPen } from 'lucide-react';
import { getAssignmentsFromACourse } from '@services/courses/assignments';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { getAPIUrl, getUriWithOrg } from '@services/config/config';
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { useCallback, useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import useSWR from 'swr';

const AssignmentsHome = () => {
  const t = useTranslations('DashPage.Assignments.HomePage');
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;
  const [courseAssignments, setCourseAssignments] = useState<any[]>([]);

  const { data: courses } = useSWR(`${getAPIUrl()}courses/org_slug/${org?.slug}/page/1/limit/128`, (url) =>
    swrFetcher(url, access_token),
  );

  const getAvailableAssignmentsForCourse = useCallback(
    async (course_uuid: string) => {
      const res = await getAssignmentsFromACourse(course_uuid, access_token);
      return res.data;
    },
    [access_token],
  );

  function removeAssignmentPrefix(assignment_uuid: string) {
    return assignment_uuid.replace('assignment_', '');
  }

  function removeCoursePrefix(course_uuid: string) {
    return course_uuid.replace('course_', '');
  }

  useEffect(() => {
    if (courses) {
      const course_uuids = courses.map((course: any) => course.course_uuid);
      const courseAssignmentsPromises = course_uuids.map((course_uuid: string) =>
        getAvailableAssignmentsForCourse(course_uuid),
      );
      Promise.all(courseAssignmentsPromises).then((results) => {
        setCourseAssignments(results);
      });
    }
  }, [courses, getAvailableAssignmentsForCourse]);

  return (
    <div className="flex min-h-screen w-full">
      <div className="mr-4 flex min-h-full w-full flex-col space-y-5 pl-4 tracking-tighter sm:mr-10 sm:pl-10">
        <div className="flex flex-col space-y-2">
          <BreadCrumbs type="assignments" />
          <h1 className="flex pt-3 text-4xl font-bold">{t('assignments')}</h1>
        </div>
        <div className="flex w-full flex-col space-y-3 pb-8">
          {courseAssignments.map((assignments: any, index: number) => (
            <div
              key={index}
              className="soft-shadow flex w-full flex-col space-y-2 rounded-xl bg-white p-3 sm:p-4"
            >
              <div>
                <div className="flex w-full flex-col items-start justify-between space-y-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                  <div className="flex items-center space-x-2">
                    <MiniThumbnail course={courses[index]} />
                    <div className="flex flex-col text-lg font-bold">
                      <p className="w-fit rounded-full bg-gray-200 px-2 py-0.5 text-xs text-gray-700">{t('course')}</p>
                      <p>{courses[index].name}</p>
                    </div>
                  </div>
                  <Link
                    href={{
                      pathname: getUriWithOrg(
                        org.slug,
                        `/dash/courses/course/${removeCoursePrefix(courses[index].course_uuid)}/content`,
                      ),
                      query: { subpage: 'editor' },
                    }}
                    prefetch
                    className="soft-shadow bg-primary flex items-center space-x-1.5 rounded-md px-3 py-1 text-sm font-semibold text-zinc-100"
                  >
                    <GalleryVerticalEnd size={15} />
                    <p>{t('courseEditor')}</p>
                  </Link>
                </div>

                {assignments?.map((assignment: any) => (
                  <div
                    key={assignment.assignment_uuid}
                    className="subtle-shadow mt-3 flex w-full flex-col items-start justify-between space-y-2 rounded bg-gray-50 p-2 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2 sm:p-3"
                  >
                    <div className="flex flex-col items-start space-y-1 sm:flex-row sm:items-center sm:space-y-0 sm:space-x-2">
                      <div className="flex h-fit rounded-full bg-gray-200 px-2 py-0.5 text-xs font-bold text-gray-700">
                        <p>{t('assignment')}</p>
                      </div>
                      <div className="flex text-lg font-semibold">{assignment.title}</div>
                      <div className="flex rounded px-2 py-0.5 font-semibold text-gray-600 outline outline-gray-200/70">
                        {assignment.description}
                      </div>
                    </div>
                    <div className="flex items-center space-x-2 text-sm font-bold">
                      <EllipsisVertical
                        className="text-gray-500"
                        size={17}
                      />
                      <Link
                        href={{
                          pathname: getUriWithOrg(
                            org.slug,
                            `/dash/assignments/${removeAssignmentPrefix(assignment.assignment_uuid)}`,
                          ),
                          query: { subpage: 'editor' },
                        }}
                        prefetch
                        className="soft-shadow flex items-center space-x-2 rounded-full bg-white px-3 py-0.5"
                      >
                        <Layers2 size={15} />
                        <p>{t('editor')}</p>
                      </Link>
                      <Link
                        href={{
                          pathname: getUriWithOrg(
                            org.slug,
                            `/dash/assignments/${removeAssignmentPrefix(assignment.assignment_uuid)}`,
                          ),
                          query: { subpage: 'submissions' },
                        }}
                        prefetch
                        className="soft-shadow flex items-center space-x-2 rounded-full bg-white px-3 py-0.5"
                      >
                        <UserRoundPen size={15} />
                        <p>{t('submissions')}</p>
                      </Link>
                    </div>
                  </div>
                ))}

                {assignments.length === 0 && (
                  <div className="mx-auto mt-3 flex items-center space-x-2 font-semibold text-gray-600">
                    <Info size={20} />
                    <p>{t('noAssignments')}</p>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const MiniThumbnail = (props: { course: any }) => {
  const org = useOrg() as any;

  function removeCoursePrefix(course_uuid: string) {
    return course_uuid.replace('course_', '');
  }

  return (
    <Link href={getUriWithOrg(org.orgslug, `/course/${removeCoursePrefix(props.course.course_uuid)}`)}>
      {props.course.thumbnail_image ? (
        <div
          className="inset-0 h-[40px] w-[70px] rounded-lg bg-cover shadow-xl ring-1 ring-black/10 ring-inset"
          style={{
            backgroundImage: `url(${getCourseThumbnailMediaDirectory(
              org?.org_uuid,
              props.course.course_uuid,
              props.course.thumbnail_image,
            )})`,
          }}
        />
      ) : (
        <div
          className="inset-0 h-[40px] w-[70px] rounded-lg bg-cover shadow-xl ring-1 ring-black/10 ring-inset"
          style={{
            backgroundImage: `url('../empty_thumbnail.webp')`,
            backgroundSize: 'contain',
          }}
        />
      )}
    </Link>
  );
};

export default AssignmentsHome;
