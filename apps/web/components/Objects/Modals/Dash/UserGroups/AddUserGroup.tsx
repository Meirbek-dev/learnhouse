'use client';

import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { Field, FieldError, FieldLabel } from '@components/ui/field';
import { createUserGroup } from '@services/usergroups/usergroups';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { getAPIUrl } from '@services/config/config';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { useTransition } from 'react';
import { toast } from 'sonner';
import * as v from 'valibot';
import { mutate } from 'swr';

interface AddUserGroupProps {
  setCreateUserGroupModal: any;
}

const createValidationSchema = (t: (key: string) => string) =>
  v.object({
    name: v.pipe(v.string(), v.minLength(1, t('nameRequiredError'))),
    description: v.optional(v.string()),
  });

type UserGroupFormValues = v.InferOutput<ReturnType<typeof createValidationSchema>>;

const AddUserGroup = (props: AddUserGroupProps) => {
  const t = useTranslations('Components.AddUserGroup');
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const validationSchema = createValidationSchema(t);

  const form = useForm<UserGroupFormValues>({
    resolver: valibotResolver(validationSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });
  const {
    register,
    handleSubmit: submitWithValidation,
    formState: { errors, isSubmitting },
  } = form;

  const [isPending, startTransition] = useTransition();

  const handleSubmit = (values: UserGroupFormValues) => {
    const toastID = toast.loading(t('toastLoading'));
    startTransition(() => {
      void (async () => {
        const res = await createUserGroup(values, access_token);
        if (res.status === 200) {
          mutate(`${getAPIUrl()}usergroups`);
          props.setCreateUserGroupModal(false);
          toast.success(t('toastSuccess'), { id: toastID });
        } else {
          toast.error(t('toastError'), { id: toastID });
        }
      })();
    });
  };

  return (
    <form
      onSubmit={submitWithValidation(handleSubmit)}
      className="space-y-4"
    >
      <Field>
        <FieldLabel htmlFor="name">{t('nameLabel')}</FieldLabel>
        <Input
          id="name"
          type="text"
          {...register('name')}
        />
        <FieldError errors={[errors.name]} />
      </Field>

      <Field>
        <FieldLabel htmlFor="description">{t('descriptionLabel')}</FieldLabel>
        <Input
          id="description"
          type="text"
          {...register('description')}
        />
        <FieldError errors={[errors.description]} />
      </Field>

      <div className="flex py-4">
        <Button
          type="submit"
          className="w-full rounded-md p-2 text-center font-bold shadow-md hover:cursor-pointer"
          disabled={isPending || isSubmitting}
        >
          {isPending || isSubmitting ? t('loadingButton') : t('createButton')}
        </Button>
      </div>
    </form>
  );
};

export default AddUserGroup;
