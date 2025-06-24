import { Book, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { getUriWithOrg } from '@services/config/config';

interface CourseBreadcrumbsProps {
  course: any;
  orgslug: string;
}

export default function CourseBreadcrumbs({ course, orgslug }: CourseBreadcrumbsProps) {
  const t = useTranslations('CourseBreadcrumbs');
  return (
    <div className="flex space-x-1 pt-2 text-sm font-medium tracking-tight text-gray-400">
      <div className="flex items-center space-x-1">
        <div className="flex items-center space-x-2">
          <Book
            className="text-gray"
            size={14}
          />
          <Link href={`${getUriWithOrg(orgslug, '')}/courses`}>{t('courses')}</Link>
        </div>
        <ChevronRight size={14} />
        <div className="first-letter:uppercase">{course.name}</div>
      </div>
    </div>
  );
}
