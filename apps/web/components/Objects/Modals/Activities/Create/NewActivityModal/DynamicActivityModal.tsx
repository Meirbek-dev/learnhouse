'use client';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { Controller, FormProvider, useForm } from 'react-hook-form';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { useTransition } from 'react';
import * as v from 'valibot';

const createValidationSchema = (t: (key: string) => string) =>
  v.object({
    name: v.pipe(v.string(), v.minLength(1, t('activityNameRequired'))),
    description: v.pipe(v.string(), v.minLength(1, t('activityDescriptionRequired'))),
  });

interface FormValues {
  name: string;
  description: string;
}

const DynamicCanvaModal = ({ submitActivity, chapterId, course }: any) => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Components.DynamicCanvaModal');
  const validationSchema = createValidationSchema(validationT);

  const form = useForm<FormValues>({
    resolver: valibotResolver(validationSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const onSubmit = (values: FormValues) => {
    startTransition(() => {
      void (async () => {
        await submitActivity({
          name: values.name,
          chapter_id: chapterId,
          activity_type: 'TYPE_DYNAMIC',
          activity_sub_type: 'SUBTYPE_DYNAMIC_PAGE',
        });
      })();
    });
  };

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <Controller
          control={form.control}
          name="name"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>{t('activityName')}</FieldLabel>
              <Input
                id={field.name}
                type="text"
                {...field}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="description"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel htmlFor={field.name}>{t('activityDescription')}</FieldLabel>
              <Textarea
                id={field.name}
                {...field}
              />
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="mt-6 flex justify-end">
          <Button
            type="submit"
            className="mt-2.5"
            disabled={isPending || form.formState.isSubmitting}
          >
            {isPending || form.formState.isSubmitting ? (
              <BarLoader
                cssOverride={{ borderRadius: 60 }}
                width={60}
                color="#ffffff"
              />
            ) : (
              t('createActivity')
            )}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
};

export default DynamicCanvaModal;
