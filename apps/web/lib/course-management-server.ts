import { Actions, Resources, Scopes } from '@/types/permissions';
import { requireAuth, sessionCan } from '@/lib/server-auth';

export interface CourseWorkspaceCapabilities {
  canViewWorkspace: boolean;
  canCreateCourse: boolean;
  canEditDetails: boolean;
  canEditCurriculum: boolean;
  canManageAccess: boolean;
  canManageCollaboration: boolean;
  canManageCertificate: boolean;
  canReviewCourse: boolean;
  canDeleteCourse: boolean;
}

function hasCoursePermission(
  session: any,
  action: typeof Actions.UPDATE | typeof Actions.MANAGE | typeof Actions.DELETE,
) {
  return (
    sessionCan(session, Resources.COURSE, action, Scopes.ORG) ||
    sessionCan(session, Resources.COURSE, action, Scopes.OWN)
  );
}

export async function getCourseWorkspaceCapabilitiesForOrg(orgslug: string): Promise<CourseWorkspaceCapabilities> {
  const session = await requireAuth(orgslug);

  const canEdit = hasCoursePermission(session, Actions.UPDATE);
  const canManage = hasCoursePermission(session, Actions.MANAGE);
  const canDelete = hasCoursePermission(session, Actions.DELETE);
  const canCreateCourse = sessionCan(session, Resources.COURSE, Actions.CREATE, Scopes.ORG);
  const canManageCertificate = sessionCan(session, Resources.CERTIFICATE, Actions.CREATE, Scopes.ORG);

  return {
    canViewWorkspace: canEdit || canManage || canManageCertificate,
    canCreateCourse,
    canEditDetails: canEdit,
    canEditCurriculum: canEdit,
    canManageAccess: canManage,
    canManageCollaboration: canManage,
    canManageCertificate,
    canReviewCourse: canEdit || canManage || canManageCertificate,
    canDeleteCourse: canDelete,
  };
}
