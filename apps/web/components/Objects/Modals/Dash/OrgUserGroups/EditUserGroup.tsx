'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { mutate } from 'swr';
import { z } from 'zod';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { Button } from '@components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { Input } from '@components/ui/input';
import { getAPIUrl } from '@services/config/config';
import { updateUserGroup } from '@services/usergroups/usergroups';

interface EditUserGroupProps {
  usergroup: {
    id: number;
    name: string;
    description: string;
  };
}

const createValidationSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('nameRequiredError')),
    description: z.string().optional(),
  });

type UserGroupFormValues = z.infer<ReturnType<typeof createValidationSchema>>;

function EditUserGroup(props: EditUserGroupProps) {
  const t = useTranslations('Components.EditUserGroup');
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const validationSchema = createValidationSchema(t);

  const form = useForm<UserGroupFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: props.usergroup.name,
      description: props.usergroup.description,
    },
  });

  const handleSubmit = async (values: UserGroupFormValues) => {
    const res = await updateUserGroup(props.usergroup.id, access_token, values);

    if (res.status === 200) {
      toast.success(t('toastSuccess'));
      mutate(`${getAPIUrl()}usergroups/org/${org.id}`);
    } else {
      toast.error(t('toastError'));
    }
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
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? t('loadingButton') : t('saveButton')}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default EditUserGroup;
