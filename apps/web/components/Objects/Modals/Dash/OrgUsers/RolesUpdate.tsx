'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { updateUserRole } from '@services/organizations/orgs';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { zodResolver } from '@hookform/resolvers/zod';
import { getAPIUrl } from '@services/config/config';
import { Button } from '@components/ui/button';
import { Alert, AlertDescription } from '@components/ui/alert';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import useSWR, { mutate } from 'swr';
import toast from 'react-hot-toast';
import React from 'react';
import { z } from 'zod';

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

const RolesUpdate = (props: Props) => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Components.RolesUpdate');
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const validationSchema = createValidationSchema(validationT);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState(null) as any;

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
    setIsSubmitting(true);
    setError(null);

    const res = await updateUserRole(org.id, props.user.user.id, values.role, access_token);
    const toastId = toast.loading('Updating role...');

    if (res.status === 200) {
      await mutate(`${getAPIUrl()}orgs/${org.id}/users`);
      props.setRolesModal(false);
      toast.success(t('toastSuccess'), { id: toastId });
    } else {
      setIsSubmitting(false);
      setError('Error ' + res.status + ': ' + res.data.detail);
      toast.error(t('toastError'), { id: toastId });
    }
  };

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>Error {error.split(':')[0]}: </strong>
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
              disabled={isSubmitting || !roles || rolesError}
              className="min-w-[100px]"
            >
              {isSubmitting ? (
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
