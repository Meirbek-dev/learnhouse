'use client';

import { buildCourseCreationPath } from '@/lib/course-management';
import NewCourseButton from '@/components/Objects/Elements/Buttons/NewCourseButton';
import { Actions, PermissionGuard, Resources, Scopes } from '@/components/Security';
import AppLink from '@/components/ui/AppLink';

interface CreateCourseTriggerProps {
  orgslug: string;
  org_id: number;
}

export default function CreateCourseTrigger({ orgslug, org_id: _org_id }: CreateCourseTriggerProps) {
  return (
    <PermissionGuard
      action={Actions.CREATE}
      resource={Resources.COURSE}
      scope={Scopes.ORG}
      fallback={null}
    >
      <NewCourseButton render={<AppLink href={buildCourseCreationPath(orgslug)} />} />
    </PermissionGuard>
  );
}
