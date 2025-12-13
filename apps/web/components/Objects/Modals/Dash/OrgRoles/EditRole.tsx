'use client';
import {
  Activity,
  BookOpen,
  Building,
  CheckSquare,
  FileText,
  FolderOpen,
  Monitor,
  Shield,
  Square,
  UserCheck,
  Users,
} from 'lucide-react';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { getAPIUrl } from '@services/config/config';
import { Textarea } from '@components/ui/textarea';
import { updateRole } from '@services/roles/roles';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Label } from '@/components/ui/label';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { mutate } from 'swr';
import React from 'react';
import * as z from 'zod';

interface EditRoleProps {
  role: {
    id: number;
    name: string;
    description: string;
    rights: any;
  };
  setEditRoleModal: any;
}

interface Rights {
  courses: {
    action_create: boolean;
    action_read: boolean;
    action_read_own: boolean;
    action_update: boolean;
    action_update_own: boolean;
    action_delete: boolean;
    action_delete_own: boolean;
  };
  users: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  usergroups: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  collections: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  organizations: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  coursechapters: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  activities: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  roles: {
    action_create: boolean;
    action_read: boolean;
    action_update: boolean;
    action_delete: boolean;
  };
  dashboard: {
    action_access: boolean;
  };
}

// PermissionSection Component - moved outside to avoid recreation on each render
interface PermissionSectionProps {
  title: string;
  icon: any;
  section: keyof Rights;
  permissions: string[];
  rights: Rights;
  handleRightChange: (section: keyof Rights, action: string, value: boolean) => void;
  handleSelectAll: (section: keyof Rights, value: boolean) => void;
  getPermissionLabel: (permission: string) => string;
  t: (key: string) => string;
}

const PermissionSection = ({
  title,
  icon: Icon,
  section,
  permissions,
  rights,
  handleRightChange,
  handleSelectAll,
  getPermissionLabel,
  t,
}: PermissionSectionProps) => {
  const sectionRights = rights[section] as any;
  const allSelected = permissions.every((perm) => sectionRights[perm]);
  const someSelected = permissions.some((perm) => sectionRights[perm]) && !allSelected;

  return (
    <div className="mb-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center space-x-2">
          <Icon className="h-4 w-4 text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-800 sm:text-base">{title}</h3>
        </div>
        <button
          type="button"
          onClick={() => handleSelectAll(section, !allSelected)}
          className="flex items-center space-x-2 self-start text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 sm:self-auto"
        >
          {allSelected ? (
            <CheckSquare className="h-4 w-4" />
          ) : someSelected ? (
            <Square className="h-4 w-4" />
          ) : (
            <Square className="h-4 w-4" />
          )}
          <span className="hidden sm:inline">{allSelected ? t('deselectAll') : t('selectAll')}</span>
          <span className="sm:hidden">{allSelected ? t('deselect') : t('select')}</span>
        </button>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {permissions.map((permission) => (
          <Label
            key={permission}
            className="flex cursor-pointer items-center space-x-2 rounded-md p-2 transition-colors hover:bg-gray-50"
          >
            <input
              type="checkbox"
              checked={rights[section]?.[permission as keyof (typeof rights)[typeof section]]}
              onChange={(e) => handleRightChange(section, permission, e.target.checked)}
              className="rounded border-gray-300 text-blue-600 focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-sm text-gray-700 capitalize">{getPermissionLabel(permission)}</span>
          </Label>
        ))}
      </div>
    </div>
  );
};

// Zod schema for form validation
const createRoleFormSchema = (t: (key: string, values?: any) => string) =>
  z.object({
    name: z
      .string()
      .min(2, t('nameMinLength', { length: 2 }))
      .nonempty(t('roleNameRequired')),
    description: z
      .string()
      .min(10, t('descriptionMinLength', { length: 10 }))
      .nonempty(t('descriptionRequired')),
    org_id: z.number(),
    rights: z.object({
      courses: z.object({
        action_create: z.boolean(),
        action_read: z.boolean(),
        action_read_own: z.boolean(),
        action_update: z.boolean(),
        action_update_own: z.boolean(),
        action_delete: z.boolean(),
        action_delete_own: z.boolean(),
      }),
      users: z.object({
        action_create: z.boolean(),
        action_read: z.boolean(),
        action_update: z.boolean(),
        action_delete: z.boolean(),
      }),
      usergroups: z.object({
        action_create: z.boolean(),
        action_read: z.boolean(),
        action_update: z.boolean(),
        action_delete: z.boolean(),
      }),
      collections: z.object({
        action_create: z.boolean(),
        action_read: z.boolean(),
        action_update: z.boolean(),
        action_delete: z.boolean(),
      }),
      organizations: z.object({
        action_create: z.boolean(),
        action_read: z.boolean(),
        action_update: z.boolean(),
        action_delete: z.boolean(),
      }),
      coursechapters: z.object({
        action_create: z.boolean(),
        action_read: z.boolean(),
        action_update: z.boolean(),
        action_delete: z.boolean(),
      }),
      activities: z.object({
        action_create: z.boolean(),
        action_read: z.boolean(),
        action_update: z.boolean(),
        action_delete: z.boolean(),
      }),
      roles: z.object({
        action_create: z.boolean(),
        action_read: z.boolean(),
        action_update: z.boolean(),
        action_delete: z.boolean(),
      }),
      dashboard: z.object({
        action_access: z.boolean(),
      }),
    }),
  });

interface RoleFormValues {
  name: string;
  description: string;
  org_id: number;
  rights: Rights;
}

const predefinedRoles = (t: (key: string) => string) => ({
  'Admin': {
    name: t('predefinedRoles.admin.name'),
    description: t('predefinedRoles.admin.description'),
    rights: {
      courses: {
        action_create: true,
        action_read: true,
        action_read_own: true,
        action_update: true,
        action_update_own: true,
        action_delete: true,
        action_delete_own: true,
      },
      users: { action_create: true, action_read: true, action_update: true, action_delete: true },
      usergroups: { action_create: true, action_read: true, action_update: true, action_delete: true },
      collections: { action_create: true, action_read: true, action_update: true, action_delete: true },
      organizations: { action_create: true, action_read: true, action_update: true, action_delete: true },
      coursechapters: { action_create: true, action_read: true, action_update: true, action_delete: true },
      activities: { action_create: true, action_read: true, action_update: true, action_delete: true },
      roles: { action_create: true, action_read: true, action_update: true, action_delete: true },
      dashboard: { action_access: true },
    },
  },
  'Course Manager': {
    name: t('predefinedRoles.courseManager.name'),
    description: t('predefinedRoles.courseManager.description'),
    rights: {
      courses: {
        action_create: true,
        action_read: true,
        action_read_own: true,
        action_update: true,
        action_update_own: true,
        action_delete: false,
        action_delete_own: true,
      },
      users: { action_create: false, action_read: true, action_update: false, action_delete: false },
      usergroups: { action_create: false, action_read: true, action_update: false, action_delete: false },
      collections: { action_create: true, action_read: true, action_update: true, action_delete: false },
      organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
      coursechapters: { action_create: true, action_read: true, action_update: true, action_delete: false },
      activities: { action_create: true, action_read: true, action_update: true, action_delete: false },
      roles: { action_create: false, action_read: false, action_update: false, action_delete: false },
      dashboard: { action_access: true },
    },
  },
  'Instructor': {
    name: t('predefinedRoles.instructor.name'),
    description: t('predefinedRoles.instructor.description'),
    rights: {
      courses: {
        action_create: true,
        action_read: true,
        action_read_own: true,
        action_update: false,
        action_update_own: true,
        action_delete: false,
        action_delete_own: true,
      },
      users: { action_create: false, action_read: false, action_update: false, action_delete: false },
      usergroups: { action_create: false, action_read: false, action_update: false, action_delete: false },
      collections: { action_create: false, action_read: true, action_update: false, action_delete: false },
      organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
      coursechapters: { action_create: true, action_read: true, action_update: false, action_delete: false },
      activities: { action_create: true, action_read: true, action_update: false, action_delete: false },
      roles: { action_create: false, action_read: false, action_update: false, action_delete: false },
      dashboard: { action_access: true },
    },
  },
  'Viewer': {
    name: t('predefinedRoles.viewer.name'),
    description: t('predefinedRoles.viewer.description'),
    rights: {
      courses: {
        action_create: false,
        action_read: true,
        action_read_own: true,
        action_update: false,
        action_update_own: false,
        action_delete: false,
        action_delete_own: false,
      },
      users: { action_create: false, action_read: false, action_update: false, action_delete: false },
      usergroups: { action_create: false, action_read: false, action_update: false, action_delete: false },
      collections: { action_create: false, action_read: true, action_update: false, action_delete: false },
      organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
      coursechapters: { action_create: false, action_read: true, action_update: false, action_delete: false },
      activities: { action_create: false, action_read: true, action_update: false, action_delete: false },
      roles: { action_create: false, action_read: false, action_update: false, action_delete: false },
      dashboard: { action_access: true },
    },
  },
  'Content Creator': {
    name: t('predefinedRoles.contentCreator.name'),
    description: t('predefinedRoles.contentCreator.description'),
    rights: {
      courses: {
        action_create: true,
        action_read: true,
        action_read_own: true,
        action_update: true,
        action_update_own: true,
        action_delete: false,
        action_delete_own: false,
      },
      users: { action_create: false, action_read: false, action_update: false, action_delete: false },
      usergroups: { action_create: false, action_read: false, action_update: false, action_delete: false },
      collections: { action_create: true, action_read: true, action_update: true, action_delete: false },
      organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
      coursechapters: { action_create: true, action_read: true, action_update: true, action_delete: false },
      activities: { action_create: true, action_read: true, action_update: true, action_delete: false },
      roles: { action_create: false, action_read: false, action_update: false, action_delete: false },
      dashboard: { action_access: true },
    },
  },
  'User Manager': {
    name: t('predefinedRoles.userManager.name'),
    description: t('predefinedRoles.userManager.description'),
    rights: {
      courses: {
        action_create: false,
        action_read: true,
        action_read_own: true,
        action_update: false,
        action_update_own: false,
        action_delete: false,
        action_delete_own: false,
      },
      users: { action_create: true, action_read: true, action_update: true, action_delete: true },
      usergroups: { action_create: true, action_read: true, action_update: true, action_delete: true },
      collections: { action_create: false, action_read: true, action_update: false, action_delete: false },
      organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
      coursechapters: { action_create: false, action_read: true, action_update: false, action_delete: false },
      activities: { action_create: false, action_read: true, action_update: false, action_delete: false },
      roles: { action_create: false, action_read: true, action_update: false, action_delete: false },
      dashboard: { action_access: true },
    },
  },
  'Moderator': {
    name: t('predefinedRoles.moderator.name'),
    description: t('predefinedRoles.moderator.description'),
    rights: {
      courses: {
        action_create: false,
        action_read: true,
        action_read_own: true,
        action_update: false,
        action_update_own: false,
        action_delete: false,
        action_delete_own: false,
      },
      users: { action_create: false, action_read: true, action_update: false, action_delete: false },
      usergroups: { action_create: false, action_read: true, action_update: false, action_delete: false },
      collections: { action_create: false, action_read: true, action_update: true, action_delete: false },
      organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
      coursechapters: { action_create: false, action_read: true, action_update: true, action_delete: false },
      activities: { action_create: false, action_read: true, action_update: true, action_delete: false },
      roles: { action_create: false, action_read: false, action_update: false, action_delete: false },
      dashboard: { action_access: true },
    },
  },
  'Analyst': {
    name: t('predefinedRoles.analyst.name'),
    description: t('predefinedRoles.analyst.description'),
    rights: {
      courses: {
        action_create: false,
        action_read: true,
        action_read_own: true,
        action_update: false,
        action_update_own: false,
        action_delete: false,
        action_delete_own: false,
      },
      users: { action_create: false, action_read: true, action_update: false, action_delete: false },
      usergroups: { action_create: false, action_read: true, action_update: false, action_delete: false },
      collections: { action_create: false, action_read: true, action_update: false, action_delete: false },
      organizations: { action_create: false, action_read: true, action_update: false, action_delete: false },
      coursechapters: { action_create: false, action_read: true, action_update: false, action_delete: false },
      activities: { action_create: false, action_read: true, action_update: false, action_delete: false },
      roles: { action_create: false, action_read: true, action_update: false, action_delete: false },
      dashboard: { action_access: true },
    },
  },
  'Guest': {
    name: t('predefinedRoles.guest.name'),
    description: t('predefinedRoles.guest.description'),
    rights: {
      courses: {
        action_create: false,
        action_read: true,
        action_read_own: false,
        action_update: false,
        action_update_own: false,
        action_delete: false,
        action_delete_own: false,
      },
      users: { action_create: false, action_read: false, action_update: false, action_delete: false },
      usergroups: { action_create: false, action_read: false, action_update: false, action_delete: false },
      collections: { action_create: false, action_read: true, action_update: false, action_delete: false },
      organizations: { action_create: false, action_read: false, action_update: false, action_delete: false },
      coursechapters: { action_create: false, action_read: true, action_update: false, action_delete: false },
      activities: { action_create: false, action_read: true, action_update: false, action_delete: false },
      roles: { action_create: false, action_read: false, action_update: false, action_delete: false },
      dashboard: { action_access: false },
    },
  },
});

function EditRole(props: EditRoleProps) {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Components.OrgRoles.EditRole');
  const org = useOrg() as any;
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [rights, setRights] = React.useState<Rights>(props.role.rights || {});
  const roleFormSchema = createRoleFormSchema(validationT);
  const predefinedRolesData = predefinedRoles(t);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: props.role.name,
      description: props.role.description,
      org_id: org?.id || 0,
      rights: props.role.rights || {},
    },
  });

  const handleSubmit = async (values: RoleFormValues) => {
    const toastID = toast.loading(t('updating'));
    setIsSubmitting(true);

    // Ensure rights object is properly structured
    const formattedRights = {
      courses: {
        action_create: rights.courses?.action_create,
        action_read: rights.courses?.action_read,
        action_read_own: rights.courses?.action_read_own,
        action_update: rights.courses?.action_update,
        action_update_own: rights.courses?.action_update_own,
        action_delete: rights.courses?.action_delete,
        action_delete_own: rights.courses?.action_delete_own,
      },
      users: {
        action_create: rights.users?.action_create,
        action_read: rights.users?.action_read,
        action_update: rights.users?.action_update,
        action_delete: rights.users?.action_delete,
      },
      usergroups: {
        action_create: rights.usergroups?.action_create,
        action_read: rights.usergroups?.action_read,
        action_update: rights.usergroups?.action_update,
        action_delete: rights.usergroups?.action_delete,
      },
      collections: {
        action_create: rights.collections?.action_create,
        action_read: rights.collections?.action_read,
        action_update: rights.collections?.action_update,
        action_delete: rights.collections?.action_delete,
      },
      organizations: {
        action_create: rights.organizations?.action_create,
        action_read: rights.organizations?.action_read,
        action_update: rights.organizations?.action_update,
        action_delete: rights.organizations?.action_delete,
      },
      coursechapters: {
        action_create: rights.coursechapters?.action_create,
        action_read: rights.coursechapters?.action_read,
        action_update: rights.coursechapters?.action_update,
        action_delete: rights.coursechapters?.action_delete,
      },
      activities: {
        action_create: rights.activities?.action_create,
        action_read: rights.activities?.action_read,
        action_update: rights.activities?.action_update,
        action_delete: rights.activities?.action_delete,
      },
      roles: {
        action_create: rights.roles?.action_create,
        action_read: rights.roles?.action_read,
        action_update: rights.roles?.action_update,
        action_delete: rights.roles?.action_delete,
      },
      dashboard: {
        action_access: rights.dashboard?.action_access,
      },
    };

    const res = await updateRole(
      props.role.id,
      {
        name: values.name,
        description: values.description,
        org_id: values.org_id,
        rights: formattedRights,
      },
      access_token,
    );
    if (res.status === 200) {
      setIsSubmitting(false);
      mutate(`${getAPIUrl()}roles/org/${org.id}`);
      props.setEditRoleModal(false);
      toast.success(t('updatedRole'), { id: toastID });
    } else {
      setIsSubmitting(false);
      toast.error(t('couldntUpdateRole'), { id: toastID });
    }
  };

  const handleRightChange = (section: keyof Rights, action: string, value: boolean) => {
    setRights((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [action]: value,
      } as any,
    }));
  };

  const handleSelectAll = (section: keyof Rights, value: boolean) => {
    setRights((prev) => ({
      ...prev,
      [section]: Object.keys(prev[section]).reduce(
        (acc, key) => ({
          ...acc,
          [key]: value,
        }),
        {} as any,
      ),
    }));
  };

  const handlePredefinedRole = (roleKey: string) => {
    const role = predefinedRolesData[roleKey as keyof typeof predefinedRolesData];
    if (role) {
      form.setValue('name', role.name);
      form.setValue('description', role.description);
      setRights(role.rights as Rights);
    }
  };

  const getPermissionLabel = (permission: string): string => {
    const permissionMap: { [key: string]: string } = {
      action_create: t('permissions.create'),
      action_read: t('permissions.read'),
      action_read_own: t('permissions.readOwn'),
      action_update: t('permissions.update'),
      action_update_own: t('permissions.updateOwn'),
      action_delete: t('permissions.delete'),
      action_delete_own: t('permissions.deleteOwn'),
      action_access: t('permissions.access'),
    };
    return permissionMap[permission] || permission.replace('action_', '').replace('_', ' ');
  };

  return (
    <div className="mx-auto max-w-6xl px-2 py-3 sm:px-0">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:gap-6 xl:grid-cols-2">
            <div className="space-y-4 sm:space-y-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('roleName')}</FormLabel>
                    <FormControl>
                      <Input
                        placeholder={t('roleNamePlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('description')}</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder={t('descriptionPlaceholder')}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="mt-6">
                <h3 className="mb-4 text-lg font-semibold text-gray-800">{t('predefinedRights')}</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(predefinedRolesData).map(([roleKey, role]) => (
                    <button
                      key={roleKey}
                      type="button"
                      onClick={() => handlePredefinedRole(roleKey)}
                      className="rounded-lg border border-gray-200 bg-white p-3 text-left shadow-sm transition-all duration-200 hover:border-blue-300 hover:bg-blue-50 hover:shadow-md"
                    >
                      <div className="text-sm font-medium text-gray-900 sm:text-base">{role.name}</div>
                      <div className="mt-1 text-xs text-gray-500 sm:text-sm">{role.description}</div>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="mb-4 text-lg font-semibold text-gray-800">{t('permissionsTitle')}</h3>

              <PermissionSection
                title={t('sections.courses')}
                icon={BookOpen}
                section="courses"
                permissions={[
                  'action_create',
                  'action_read',
                  'action_read_own',
                  'action_update',
                  'action_update_own',
                  'action_delete',
                  'action_delete_own',
                ]}
                rights={rights}
                handleRightChange={handleRightChange}
                handleSelectAll={handleSelectAll}
                getPermissionLabel={getPermissionLabel}
                t={t}
              />

              <PermissionSection
                title={t('sections.users')}
                icon={Users}
                section="users"
                permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                rights={rights}
                handleRightChange={handleRightChange}
                handleSelectAll={handleSelectAll}
                getPermissionLabel={getPermissionLabel}
                t={t}
              />

              <PermissionSection
                title={t('sections.userGroups')}
                icon={UserCheck}
                section="usergroups"
                permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                rights={rights}
                handleRightChange={handleRightChange}
                handleSelectAll={handleSelectAll}
                getPermissionLabel={getPermissionLabel}
                t={t}
              />

              <PermissionSection
                title={t('sections.collections')}
                icon={FolderOpen}
                section="collections"
                permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                rights={rights}
                handleRightChange={handleRightChange}
                handleSelectAll={handleSelectAll}
                getPermissionLabel={getPermissionLabel}
                t={t}
              />

              <PermissionSection
                title={t('sections.organizations')}
                icon={Building}
                section="organizations"
                permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                rights={rights}
                handleRightChange={handleRightChange}
                handleSelectAll={handleSelectAll}
                getPermissionLabel={getPermissionLabel}
                t={t}
              />

              <PermissionSection
                title={t('sections.courseChapters')}
                icon={FileText}
                section="coursechapters"
                permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                rights={rights}
                handleRightChange={handleRightChange}
                handleSelectAll={handleSelectAll}
                getPermissionLabel={getPermissionLabel}
                t={t}
              />

              <PermissionSection
                title={t('sections.activities')}
                icon={Activity}
                section="activities"
                permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                rights={rights}
                handleRightChange={handleRightChange}
                handleSelectAll={handleSelectAll}
                getPermissionLabel={getPermissionLabel}
                t={t}
              />

              <PermissionSection
                title={t('sections.roles')}
                icon={Shield}
                section="roles"
                permissions={['action_create', 'action_read', 'action_update', 'action_delete']}
                rights={rights}
                handleRightChange={handleRightChange}
                handleSelectAll={handleSelectAll}
                getPermissionLabel={getPermissionLabel}
                t={t}
              />

              <PermissionSection
                title={t('sections.dashboard')}
                icon={Monitor}
                section="dashboard"
                permissions={['action_access']}
                rights={rights}
                handleRightChange={handleRightChange}
                handleSelectAll={handleSelectAll}
                getPermissionLabel={getPermissionLabel}
                t={t}
              />
            </div>
          </div>

          <div className="mt-6 flex flex-col justify-end space-y-2 border-t border-gray-200 pt-6 sm:flex-row sm:space-y-0 sm:space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => props.setEditRoleModal(false)}
              className="w-full sm:w-auto"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full sm:w-auto"
            >
              {isSubmitting ? t('updating') : t('updateRole')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default EditRole;
