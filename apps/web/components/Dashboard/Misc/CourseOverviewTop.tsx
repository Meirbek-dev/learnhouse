import type { CourseOverviewParams } from 'app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { useCourse } from '@components/Contexts/CourseContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUriWithOrg } from '@services/config/config';
import { Button } from '@/components/ui/button';
import Link from '@components/ui/ServerLink';
import { useTranslations } from 'next-intl';
import { BookOpen } from 'lucide-react';
import { useEffect } from 'react';
import Image from 'next/image';

import EmptyThumbnailImage from '../../../public/empty_thumbnail.webp';

import BreadCrumbs from './BreadCrumbs';
import SaveState from './SaveState';

export const CourseOverviewTop = ({ params }: { params: CourseOverviewParams }) => {
  const course = useCourse();
  const org = useOrg() as any;
  const t = useTranslations('DashPage.CourseOverview');

  useEffect(() => {}, []);

  return (
    <>
      <BreadCrumbs
        type="courses"
        last_breadcrumb={course.courseStructure.name}
      />
      <div className="flex">
        <div className="flex grow items-center py-3">
          <Link
            prefetch={false}
            href={`${getUriWithOrg(org?.slug, '')}/course/${params.courseuuid}`}
          >
            {course?.courseStructure?.thumbnail_image ? (
              <img
                className="h-[57px] w-[100px] rounded-md drop-shadow-md"
                src={`${getCourseThumbnailMediaDirectory(
                  org?.org_uuid,
                  `course_${params.courseuuid}`,
                  course.courseStructure.thumbnail_image,
                )}`}
                alt=""
              />
            ) : (
              <Image
                width={100}
                className="size-auto h-[57px] rounded-md drop-shadow-md"
                src={EmptyThumbnailImage}
                alt=""
              />
            )}
          </Link>
          <div className="course_metadata flex flex-col justify-center pl-5">
            <div className="text-sm font-semibold text-gray-400">{t('courseLabel')}</div>
            <div className="-mt-1 text-xl font-bold text-black first-letter:uppercase">
              {course.courseStructure.name}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Button
            asChild
            size="sm"
          >
            <a
              href="https://tou.edu.kz/ru/component/docs/?id_n=466"
              className="gap-2"
            >
              <BookOpen className="size-4" />
              <span>Скачать требования к разработке МООК</span>
            </a>
          </Button>
          <Button
            asChild
            size="sm"
          >
            <Link
              prefetch={false}
              href={getUriWithOrg(org?.slug, '/dash/documentation/rights')}
              className="gap-2"
            >
              <BookOpen className="size-4" />
              <span>{t('rightsGuide')}</span>
            </Link>
          </Button>
          <SaveState orgslug={params.orgslug} />
        </div>
      </div>
    </>
  );
};
