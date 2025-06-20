import { getUriWithOrg } from '@services/config/config';
import { Book, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';

interface ActivityBreadcrumbsProps {
  course: any;
  activity: any;
  orgslug: string;
}

export default function ActivityBreadcrumbs({ course, activity, orgslug }: ActivityBreadcrumbsProps) {
  const cleanCourseUuid = course.course_uuid?.replace('course_', '');
  const t = useTranslations('General');

  return (
    <div className="mb-4 flex space-x-1 text-sm font-medium tracking-tight text-gray-400">
      <div className="flex items-center space-x-1">
        <div className="flex items-center space-x-2">
          <Book
            className="text-gray"
            size={14}
          />
          <Link href={`${getUriWithOrg(orgslug, '')}/courses`}>{t('courses')}</Link>
        </div>
        <ChevronRight size={14} />
        <Link href={`${getUriWithOrg(orgslug, '')}/course/${cleanCourseUuid}`}>{course.name}</Link>
        <ChevronRight size={14} />
        <div className="first-letter:uppercase">{activity.name}</div>
      </div>
    </div>
  );
}
