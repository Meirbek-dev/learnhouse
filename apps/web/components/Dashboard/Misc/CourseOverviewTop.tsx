import type { CourseOverviewParams } from 'app/orgs/[orgslug]/dash/courses/course/[courseuuid]/[subpage]/page';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import EmptyThumbnailImage from '../../../public/empty_thumbnail.png';
import { useCourse } from '@components/Contexts/CourseContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUriWithOrg } from '@services/config/config';
import { useTranslations } from 'next-intl';
import BreadCrumbs from './BreadCrumbs';
import SaveState from './SaveState';
import { useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

export function CourseOverviewTop({ params }: { params: CourseOverviewParams }) {
  const course = useCourse() as any;
  const org = useOrg() as any;
  const t = useTranslations('DashPage.CourseOverview');

  useEffect(() => {}, [course, org]);

  return (
    <>
      <BreadCrumbs
        type="courses"
        last_breadcrumb={course.courseStructure.name}
      />
      <div className="flex">
        <div className="flex grow items-center py-3">
          <Link href={`${getUriWithOrg(org?.slug, '')}/course/${params.courseuuid}`}>
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
                className="h-[57px] rounded-md drop-shadow-md"
                src={EmptyThumbnailImage}
                alt=""
                style={{ width: 'auto', height: 'auto' }}
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
        <div className="flex items-center">
          <SaveState orgslug={params.orgslug} />
        </div>
      </div>
    </>
  );
}
