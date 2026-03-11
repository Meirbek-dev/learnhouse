'use client';

import { buildCourseCreationPath } from '@/lib/course-management';
import { Actions, PermissionGuard, Resources, Scopes } from '@/components/Security';
import { Button } from '@/components/ui/button';
import AppLink from '@/components/ui/AppLink';
import { useTranslations } from 'next-intl';

interface CreateCourseTriggerProps {
  orgslug: string;
}

export default function CreateCourseTrigger({ orgslug }: CreateCourseTriggerProps) {
  const t = useTranslations('Components.Button');

  return (
    <PermissionGuard
      action={Actions.CREATE}
      resource={Resources.COURSE}
      scope={Scopes.ORG}
      fallback={null}
    >
      <Button
        nativeButton={false}
        render={<AppLink href={buildCourseCreationPath(orgslug)} />}
        className="my-auto gap-2 rounded-lg px-4 py-2 font-semibold"
      >
        <span>{t('newCourse')}</span>
        <span className="rounded-full border border-current/15 px-1.5 text-xs font-medium leading-5">+</span>
      </Button>
    </PermissionGuard>
  );
}
