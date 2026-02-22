import type { Action, Resource, Scope } from '@/types/permissions';
import { Actions, Resources, Scopes } from '@/types/permissions';

type CanCheck = (action: Action, resource: Resource, scope: Scope) => boolean;

export function canSeeOrg(can: CanCheck): boolean {
  return (
    can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN) ||
    can(Actions.UPDATE, Resources.ORGANIZATION, Scopes.OWN) ||
    can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.ORG) ||
    can(Actions.UPDATE, Resources.ORGANIZATION, Scopes.ORG)
  );
}

export function canSeeCourses(can: CanCheck): boolean {
  return (
    can(Actions.CREATE, Resources.COURSE, Scopes.ORG) ||
    can(Actions.UPDATE, Resources.COURSE, Scopes.ORG) ||
    can(Actions.MANAGE, Resources.COURSE, Scopes.ORG)
  );
}

export function canSeeAssignments(can: CanCheck): boolean {
  return (
    can(Actions.CREATE, Resources.COURSE, Scopes.ORG) ||
    can(Actions.UPDATE, Resources.COURSE, Scopes.ORG) ||
    can(Actions.UPDATE, Resources.COURSE, Scopes.OWN) ||
    can(Actions.GRADE, Resources.ASSIGNMENT, Scopes.ORG) ||
    can(Actions.CREATE, Resources.ASSIGNMENT, Scopes.ORG)
  );
}

export function canSeeUsers(can: CanCheck): boolean {
  return (
    can(Actions.UPDATE, Resources.USER, Scopes.ORG) ||
    can(Actions.READ, Resources.USER, Scopes.ORG) ||
    can(Actions.MANAGE, Resources.USERGROUP, Scopes.ORG)
  );
}

export function canSeeAdmin(can: CanCheck): boolean {
  return (
    can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN) ||
    can(Actions.UPDATE, Resources.ORGANIZATION, Scopes.OWN) ||
    can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.ORG) ||
    can(Actions.UPDATE, Resources.ORGANIZATION, Scopes.ORG) ||
    can(Actions.UPDATE, Resources.ROLE, Scopes.ORG) ||
    can(Actions.READ, Resources.ROLE, Scopes.ORG)
  );
}

export function canSeePayments(can: CanCheck): boolean {
  return can(Actions.MANAGE, Resources.PAYMENT, Scopes.ORG) || can(Actions.MANAGE, Resources.ORGANIZATION, Scopes.OWN);
}

export function canAccessDashboard(can: CanCheck): boolean {
  return (
    canSeeOrg(can) ||
    canSeeCourses(can) ||
    canSeeAssignments(can) ||
    canSeeUsers(can) ||
    canSeeAdmin(can) ||
    canSeePayments(can)
  );
}
