'use client';

import { CourseOverviewTop } from '@components/Dashboard/Misc/CourseOverviewTop';
import EditCourseAccess from '@components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess';
import EditCourseContributors from '@components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors';
import EditCourseGeneral from '@components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral';
import EditCourseStructure from '@components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure';
import { getUriWithOrg } from '@services/config/config';
import { motion } from 'framer-motion';
import { GalleryVerticalEnd, Globe, Info, UserPen } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { use } from 'react';

import { CourseProvider } from '../../../../../../../../components/Contexts/CourseContext';

export interface CourseOverviewParams {
  orgslug: string;
  courseuuid: string;
  subpage: string;
}

function CourseOverviewPage(props: { params: Promise<CourseOverviewParams> }) {
  const t = useTranslations('DashPage.Courses.CoursePage');
  const params = use(props.params);
  function getEntireCourseUUID(courseuuid: string) {
    return `course_${courseuuid}`;
  }

  return (
    <div className="grid h-screen w-full grid-rows-[auto_1fr] bg-[#f8f8f8]">
      <CourseProvider
        courseuuid={getEntireCourseUUID(params.courseuuid)}
        withUnpublishedActivities
      >
        <div className="soft-shadow z-10 bg-[#fcfbfc] pl-10 pr-10 text-sm tracking-tight">
          <CourseOverviewTop params={params} />
          <div className="flex space-x-3 text-sm font-bold">
            <Link href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/general`}>
              <div
                className={`border-primary flex w-fit space-x-4 py-2 text-center transition-all ease-linear ${
                  params.subpage.toString() === 'general' ? 'border-b-4' : 'opacity-50'
                } cursor-pointer`}
              >
                <div className="mx-2 flex items-center space-x-2.5">
                  <Info size={16} />
                  <div>{t('general')}</div>
                </div>
              </div>
            </Link>

            <Link href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/content`}>
              <div
                className={`border-primary flex w-fit space-x-4 py-2 text-center transition-all ease-linear ${
                  params.subpage.toString() === 'content' ? 'border-b-4' : 'opacity-50'
                } cursor-pointer`}
              >
                <div className="mx-2 flex items-center space-x-2.5">
                  <GalleryVerticalEnd size={16} />
                  <div>{t('content')}</div>
                </div>
              </div>
            </Link>
            <Link href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/access`}>
              <div
                className={`border-primary flex w-fit space-x-4 py-2 text-center transition-all ease-linear ${
                  params.subpage.toString() === 'access' ? 'border-b-4' : 'opacity-50'
                } cursor-pointer`}
              >
                <div className="mx-2 flex items-center space-x-2.5">
                  <Globe size={16} />
                  <div>{t('access')}</div>
                </div>
              </div>
            </Link>
            <Link href={`${getUriWithOrg(params.orgslug, '')}/dash/courses/course/${params.courseuuid}/contributors`}>
              <div
                className={`border-primary flex w-fit space-x-4 py-2 text-center transition-all ease-linear ${
                  params.subpage.toString() === 'contributors' ? 'border-b-4' : 'opacity-50'
                } cursor-pointer`}
              >
                <div className="mx-2 flex items-center space-x-2.5">
                  <UserPen size={16} />
                  <div>{t('contributors')}</div>
                </div>
              </div>
            </Link>
          </div>
        </div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
          className="relative h-full overflow-y-auto"
        >
          <div className="absolute inset-0">
            {params.subpage === 'content' ? <EditCourseStructure orgslug={params.orgslug} /> : ''}
            {params.subpage === 'general' ? <EditCourseGeneral orgslug={params.orgslug} /> : ''}
            {params.subpage === 'access' ? <EditCourseAccess orgslug={params.orgslug} /> : ''}
            {params.subpage === 'contributors' ? <EditCourseContributors orgslug={params.orgslug} /> : ''}
          </div>
        </motion.div>
      </CourseProvider>
    </div>
  );
}

export default CourseOverviewPage;
