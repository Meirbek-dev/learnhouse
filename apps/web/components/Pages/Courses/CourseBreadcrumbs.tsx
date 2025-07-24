import { getUriWithOrg } from '@services/config/config';
import { Book } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
  BreadcrumbPage,
} from '@/components/ui/breadcrumb';

interface CourseBreadcrumbsProps {
  course: any;
  orgslug: string;
}

export default function CourseBreadcrumbs({ course, orgslug }: CourseBreadcrumbsProps) {
  const t = useTranslations('CourseBreadcrumbs');
  return (
    <div className="pt-2">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link href={`${getUriWithOrg(orgslug, '')}/courses`} className="flex items-center space-x-2">
                <Book className="text-gray" size={14} />
                <span>{t('courses')}</span>
              </Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="first-letter:uppercase">
              {course.name}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>
    </div>
  );
}
