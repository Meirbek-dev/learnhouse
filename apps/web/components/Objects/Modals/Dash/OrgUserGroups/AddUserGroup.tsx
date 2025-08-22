'use client';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { createUserGroup } from '@services/usergroups/usergroups';
import { useOrg } from '@components/Contexts/OrgContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { getAPIUrl } from '@services/config/config';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { useTransition } from 'react';
import { mutate } from 'swr';
import { z } from 'zod';

interface AddUserGroupProps {
  setCreateUserGroupModal: any;
}

const createValidationSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('nameRequiredError')),
    description: z.string().optional(),
    org_id: z.number(),
  });

type UserGroupFormValues = z.infer<ReturnType<typeof createValidationSchema>>;

const AddUserGroup = (props: AddUserGroupProps) => {
  const t = useTranslations('Components.AddUserGroup');
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const validationSchema = createValidationSchema(t);

  const form = useForm<UserGroupFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: '',
      description: '',
      org_id: org.id,
    },
  });

  const [isPending, startTransition] = useTransition();

  const handleSubmit = (values: UserGroupFormValues) => {
    const toastID = toast.loading(t('toastLoading'));
    startTransition(() => {
      void (async () => {
        const res = await createUserGroup(values, access_token);
        if (res.status === 200) {
          mutate(`${getAPIUrl()}usergroups/org/${org.id}`);
          props.setCreateUserGroupModal(false);
          toast.success(t('toastSuccess'), { id: toastID });
        } else {
          toast.error(t('toastError'), { id: toastID });
        }
      })();
    });
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('nameLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="text"
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
              <FormLabel>{t('descriptionLabel')}</FormLabel>
              <FormControl>
                <Input
                  type="text"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex py-4">
          <Button
            type="submit"
            className="w-full rounded-md p-2 text-center font-bold shadow-md hover:cursor-pointer"
            disabled={isPending || form.formState.isSubmitting}
          >
            {isPending || form.formState.isSubmitting ? t('loadingButton') : t('createButton')}
          </Button>
        </div>
      </form>
    </Form>
  );
};

export default AddUserGroup;
