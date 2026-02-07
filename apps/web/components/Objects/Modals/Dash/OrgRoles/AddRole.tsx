'use client';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { createRole } from '@/services/rbac';
import { useOrg } from '@components/Contexts/OrgContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { getAPIUrl } from '@services/config/config';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { mutate } from 'swr';
import React from 'react';
import * as z from 'zod';

interface AddRoleProps {
  setCreateRoleModal: (open: boolean) => void;
}

const createRoleFormSchema = (t: (key: string, values?: Record<string, number>) => string) =>
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
  });

interface RoleFormValues {
  name: string;
  description: string;
  org_id: number;
}

function AddRole(props: AddRoleProps) {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Components.OrgRoles.AddRole');
  const org = useOrg();
  const session = usePlatformSession();
  const access_token = session?.data?.tokens?.access_token;
  const [isPending, startTransition] = React.useTransition();
  const [_error, setError] = React.useState('');
  const roleFormSchema = createRoleFormSchema(validationT);

  const form = useForm<RoleFormValues>({
    resolver: zodResolver(roleFormSchema),
    defaultValues: {
      name: '',
      description: '',
      org_id: org?.id || 0,
    },
  });

  const handleSubmit = async (values: RoleFormValues) => {
    const toastID = toast.loading(t('creating'));
    setError('');

    startTransition(async () => {
      try {
        await createRole(access_token ?? '', org?.id ?? 0, {
          name: values.name,
          slug: values.name.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, ''),
          description: values.description,
        });
        mutate(`${getAPIUrl()}roles/org/${org?.id}`);
        props.setCreateRoleModal(false);
        toast.success(t('createdNewRole'), { id: toastID });
      } catch (error: unknown) {
        toast.error(t('couldntCreateNewRole'), { id: toastID });
        setError((error as Error)?.message || t('unknownError'));
      }
    });
  };

  return (
    <div className="mx-auto max-w-2xl px-2 py-3 sm:px-0">
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-6"
        >
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

            <p className="text-muted-foreground text-sm">{t('permissionsNote')}</p>
          </div>

          <div className="mt-6 flex flex-col justify-end space-y-2 border-t border-gray-200 pt-6 sm:flex-row sm:space-y-0 sm:space-x-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => props.setCreateRoleModal(false)}
              className="w-full sm:w-auto"
            >
              {t('cancel')}
            </Button>
            <Button
              type="submit"
              disabled={isPending}
              className="w-full sm:w-auto"
            >
              {isPending ? t('creating') : t('createRole')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default AddRole;
