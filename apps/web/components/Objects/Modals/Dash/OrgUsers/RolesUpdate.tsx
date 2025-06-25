'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { mutate } from 'swr';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { getAPIUrl } from '@services/config/config';
import { updateUserRole } from '@services/organizations/orgs';

interface Props {
  user: any;
  setRolesModal: any;
  alreadyAssignedRole: string;
}

const validationSchema = z.object({
  role: z.string().min(1, 'Role is required'),
});

type FormValues = {
  role: string;
};

function RolesUpdate(props: Props) {
  const t = useTranslations('Components.RolesUpdate');
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      role: props.alreadyAssignedRole,
    },
  });

  const onSubmit = async (values: FormValues) => {
    const toastId = toast.loading(t('toastLoading'));
    try {
      const res = await updateUserRole(org.id, props.user.user.id, values.role, access_token);
      if (res.status === 200) {
        await mutate(`${getAPIUrl()}orgs/${org.id}/users`);
        props.setRolesModal(false);
        toast.success(t('toastSuccess'), { id: toastId });
      } else {
        const errorDetail = res.data?.detail || 'Unknown error';
        form.setError('root', { message: t('updateErrorDetail', { error: errorDetail }) });
        toast.error(t('toastError'), { id: toastId });
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'An unexpected error occurred';
      form.setError('root', { message: t('updateErrorDetail', { error: errorMessage }) });
      toast.error(t('toastError'), { id: toastId });
    }
  };

  return (
    <div>
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4"
        >
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('rolesLabel')}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectRolePlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="role_global_admin">{t('adminRole')}</SelectItem>
                    <SelectItem value="role_global_maintainer">{t('maintainerRole')}</SelectItem>
                    <SelectItem value="role_global_user">{t('userRole')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          {form.formState.errors.root && (
            <div className="mb-2 rounded-md bg-red-100 px-3 py-2 text-xs font-bold text-red-500">
              {form.formState.errors.root.message}
            </div>
          )}

          <div className="mt-6 flex justify-end">
            <Button
              type="submit"
              className="mt-2.5"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <BarLoader
                  cssOverride={{ borderRadius: 60 }}
                  width={60}
                  color="#ffffff"
                />
              ) : (
                t('updateButton')
              )}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

export default RolesUpdate;
