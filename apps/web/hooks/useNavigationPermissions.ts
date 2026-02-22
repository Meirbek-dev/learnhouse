import {
  canAccessDashboard,
  canSeeAdmin,
  canSeeAssignments,
  canSeeCourses,
  canSeeOrg,
  canSeePayments,
  canSeeUsers,
} from '@/lib/rbac/navigation-policy';
import { usePermissions } from '@/components/Security';
import { usePaymentsEnabled } from '@components/Hooks/usePaymentsEnabled';

export function useNavigationPermissions() {
  const { can } = usePermissions();
  const { isEnabled: arePaymentsEnabled } = usePaymentsEnabled();

  const hasOrgAccess = canSeeOrg(can);
  const hasCoursesAccess = canSeeCourses(can);
  const hasAssignmentsAccess = canSeeAssignments(can);
  const hasUsersAccess = canSeeUsers(can);
  const hasAdminAccess = canSeeAdmin(can);
  const hasPaymentsAccess = arePaymentsEnabled && canSeePayments(can);
  const hasDashboardAccess = canAccessDashboard(can);

  return {
    canSeeOrg: hasOrgAccess,
    canSeeCourses: hasCoursesAccess,
    canSeeAssignments: hasAssignmentsAccess,
    canSeeUsers: hasUsersAccess,
    canSeeAdmin: hasAdminAccess,
    canSeePayments: hasPaymentsAccess,
    canAccessDashboard: hasDashboardAccess,
  };
}
