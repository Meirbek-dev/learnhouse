'use client';

import EditCourseCertification from '@components/Dashboard/Pages/Course/EditCourseCertification/EditCourseCertification';
import EditCourseContributors from '@components/Dashboard/Pages/Course/EditCourseContributors/EditCourseContributors';
import EditCourseStructure from '@components/Dashboard/Pages/Course/EditCourseStructure/EditCourseStructure';
import EditCourseGeneral from '@components/Dashboard/Pages/Course/EditCourseGeneral/EditCourseGeneral';
import EditCourseAccess from '@components/Dashboard/Pages/Course/EditCourseAccess/EditCourseAccess';
import { Award, GalleryVerticalEnd, Globe, Info, Loader2, Lock, UserPen } from 'lucide-react';
import { CourseProvider } from '../../../../../../../../components/Contexts/CourseContext';
import { CourseOverviewTop } from '@components/Dashboard/Misc/CourseOverviewTop';
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip';
import { Actions, ResourceTypes } from '@/types/permissions';
import { usePermissions } from '@/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { use, useEffect } from 'react';
import { motion } from 'motion/react';

export interface CourseOverviewParams {
  orgslug: string;
  courseuuid: string;
  subpage: string;
}

const CourseOverviewPage = (props: { params: Promise<CourseOverviewParams> }) => {
  const t = useTranslations('DashPage.Courses.CoursePage');
  const params = use(props.params);
  const router = useRouter();
  const courseuuid = `course_${params.courseuuid}`;
  const { can, loading: rightsLoading } = usePermissions();

  // Define tab configurations with their required permissions
  const tabs = [
    {
      key: 'general',
      label: t('general'),
      icon: Info,
      href: `/dash/courses/course/${params.courseuuid}/general`,
      requiredAction: Actions.UPDATE,
    },
    {
      key: 'content',
      label: t('content'),
      icon: GalleryVerticalEnd,
      href: `/dash/courses/course/${params.courseuuid}/content`,
      requiredAction: Actions.UPDATE,
    },
    {
      key: 'access',
      label: t('access'),
      icon: Globe,
      href: `/dash/courses/course/${params.courseuuid}/access`,
      requiredAction: Actions.MANAGE,
    },
    {
      key: 'contributors',
      label: t('contributors'),
      icon: UserPen,
      href: `/dash/courses/course/${params.courseuuid}/contributors`,
      requiredAction: Actions.MANAGE,
      context: 'contributors' as const,
    },
    {
      key: 'certification',
      label: t('certification'),
      icon: Award,
      href: `/dash/courses/course/${params.courseuuid}/certification`,
      requiredAction: Actions.CREATE,
      context: 'certifications' as const,
    },
  ];

  // Filter tabs based on permissions
  const visibleTabs = tabs.filter((tab) => can(tab.requiredAction, ResourceTypes.COURSE));

  // Check if current subpage is accessible
  const currentTab = tabs.find((tab) => tab.key === params.subpage);
  const hasAccessToCurrentPage = currentTab ? can(currentTab.requiredAction, ResourceTypes.COURSE) : false;

  // Redirect to first available tab if current page is not accessible
  useEffect(() => {
    if (!(rightsLoading || hasAccessToCurrentPage) && visibleTabs.length > 0) {
      const firstAvailableTab = visibleTabs[0];
      if (firstAvailableTab) {
        router.replace(`/orgs/${params.orgslug}${firstAvailableTab.href}`);
      }
    }
  }, [rightsLoading, hasAccessToCurrentPage, visibleTabs, router, params.orgslug]);

  // Show loading state while rights are being fetched
  if (rightsLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f8f8f8]">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Show access denied if no tabs are available
  if (!rightsLoading && visibleTabs.length === 0) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#f8f8f8]">
        <div className="text-center">
          <Lock className="mx-auto mb-4 h-12 w-12 text-gray-400" />
          <h3 className="mb-2 text-lg font-medium text-gray-900">{t('accessDenied')}</h3>
          <p className="text-gray-500">{t('noPermissionToAccess')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="grid h-screen w-full grid-rows-[auto_1fr] bg-[#f8f8f8]">
      <CourseProvider
        courseuuid={courseuuid}
        withUnpublishedActivities
      >
        <div className="soft-shadow bg-background z-10 pr-10 pl-10 text-sm tracking-tight">
          <CourseOverviewTop params={params} />
          <div className="flex space-x-3 text-sm font-bold">
            {tabs.map((tab) => {
              const IconComponent = tab.icon;
              const isActive = params.subpage.toString() === tab.key;
              const hasAccess = can(tab.requiredAction, ResourceTypes.COURSE);

              if (!hasAccess) {
                return (
                  <Tooltip key={tab.key}>
                    <TooltipTrigger
                      render={
                        <div className="border-primary flex w-fit cursor-not-allowed space-x-4 py-2 text-center opacity-30 transition-all ease-linear" />
                      }
                    >
                      <div className="mx-2 flex items-center space-x-2.5">
                        <IconComponent size={16} />
                        <div>{tab.label}</div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent
                      side="bottom"
                      sideOffset={8}
                      className="max-w-60 text-wrap"
                    >
                      <div className="text-center">
                        <div className="font-medium text-gray-900">{t('accessRestricted')}</div>
                        <div className="text-xs text-gray-100/90">
                          {t('noPermissionToAccessTab', { tabName: tab.label })}
                        </div>
                      </div>
                    </TooltipContent>
                  </Tooltip>
                );
              }

              return (
                <Link
                  key={tab.key}
                  href={`/orgs/${params.orgslug}${tab.href}`}
                >
                  <div
                    className={`border-primary flex w-fit space-x-4 py-2 text-center transition-all ease-linear ${
                      isActive ? 'border-b-4' : 'opacity-50 hover:opacity-75'
                    } cursor-pointer`}
                  >
                    <div className="mx-2 flex items-center space-x-2.5">
                      <IconComponent size={16} />
                      <div>{tab.label}</div>
                    </div>
                  </div>
                </Link>
              );
            })}
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
            {params.subpage === 'content' && can(Actions.UPDATE, ResourceTypes.COURSE) ? (
              <EditCourseStructure orgslug={params.orgslug} />
            ) : null}
            {params.subpage === 'general' && can(Actions.UPDATE, ResourceTypes.COURSE) ? (
              <EditCourseGeneral orgslug={params.orgslug} />
            ) : null}
            {params.subpage === 'access' && can(Actions.MANAGE, ResourceTypes.COURSE) ? (
              <EditCourseAccess orgslug={params.orgslug} />
            ) : null}
            {params.subpage === 'contributors' && can(Actions.MANAGE, ResourceTypes.COURSE) ? (
              <EditCourseContributors orgslug={params.orgslug} />
            ) : null}
            {params.subpage === 'certification' && can(Actions.CREATE, ResourceTypes.CERTIFICATE) ? (
              <EditCourseCertification orgslug={params.orgslug} />
            ) : null}
          </div>
        </motion.div>
      </CourseProvider>
    </div>
  );
};

export default CourseOverviewPage;
