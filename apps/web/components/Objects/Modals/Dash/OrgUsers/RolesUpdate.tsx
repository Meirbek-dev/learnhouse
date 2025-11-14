'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { Alert, AlertDescription } from '@components/ui/alert';
import { updateUserRole } from '@services/organizations/orgs';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { zodResolver } from '@hookform/resolvers/zod';
import { getAPIUrl } from '@services/config/config';
import { useState, useTransition } from 'react';
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import useSWR, { mutate } from 'swr';
import toast from 'react-hot-toast';
import type { FC } from 'react';
import * as z from 'zod';

interface Props {
  user: any;
  setRolesModal: any;
  alreadyAssignedRole: string;
}
const createValidationSchema = (t: (key: string) => string) =>
  z.object({
    role: z.string().min(1, t('roleRequired')),
  });

interface FormData {
  role: string;
}

const RolesUpdate: FC<Props> = (props) => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Components.RolesUpdate');
  const org = useOrg() as any;
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const validationSchema = createValidationSchema(validationT);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<any>(null);

  const form = useForm<FormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      role: props.alreadyAssignedRole,
    },
  });

  // Fetch available roles for the organization
  const { data: roles, error: rolesError } = useSWR(org ? `${getAPIUrl()}roles/org/${org.id}` : null, (url) =>
    swrFetcher(url, access_token),
  );

  const handleSubmit = async (values: FormData) => {
    setError(null);

    startTransition(async () => {
      const toastId = toast.loading(t('toastLoading'));
      const res = await updateUserRole(org.id, props.user.user.id, values.role, access_token);

      if (res.status === 200) {
        await mutate(`${getAPIUrl()}orgs/${org.id}/users`);
        props.setRolesModal(false);
        toast.success(t('toastSuccess'), { id: toastId });
      } else {
        setError(`Error ${res.status}: ${res.data.detail}`);
        toast.error(t('toastError'), { id: toastId });
      }
    });
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>
              {t('errorPrefix')} {error.split(':')[0]}:{' '}
            </strong>
            {error.split(':').slice(1).join(':')}
          </AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
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
                  disabled={!roles || rolesError}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectRolePlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {!roles || rolesError ? (
                      <SelectItem
                        value="loading"
                        disabled
                      >
                        {t('loadingRoles')}
                      </SelectItem>
                    ) : (
                      roles.map((role: any) => (
                        <SelectItem
                          key={role.id}
                          value={role.role_uuid || role.id.toString()}
                        >
                          {role.name}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              disabled={isPending || !roles || rolesError}
              className="min-w-[100px]"
            >
              {isPending ? (
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
};

export default RolesUpdate;
