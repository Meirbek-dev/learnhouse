import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';
import { getUriWithOrg } from '@services/config/config';
import { getTranslations } from 'next-intl/server';
import Link from '@components/ui/ServerLink';
import { Book } from 'lucide-react';

interface ActivityBreadcrumbsProps {
  course: any;
  activity: any;
  orgslug: string;
}

export default async function ActivityBreadcrumbs({ course, activity, orgslug }: ActivityBreadcrumbsProps) {
  const cleanCourseUuid = course.course_uuid?.replace('course_', '');
  const t = await getTranslations('General');

  return (
    <div className="mb-4">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link
                href={`${getUriWithOrg(orgslug, '')}/courses`}
                className="flex items-center space-x-2"
              >
                <Book
                  className="text-gray"
                  size={14}
                />
                <span>{t('courses')}</span>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`${getUriWithOrg(orgslug, '')}/course/${cleanCourseUuid}`}>{course.name}</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="first-letter:uppercase">{activity.name}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
