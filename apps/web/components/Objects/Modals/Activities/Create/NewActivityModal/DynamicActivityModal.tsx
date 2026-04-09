'use client';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { useForm } from '@tanstack/react-form';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
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

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
    },
    validators: {
      onChange: validationSchema,
      onSubmit: validationSchema,
    },
    onSubmit: async ({ value }) => {
      await submitActivity({
        name: value.name,
        chapter_id: chapterId,
        activity_type: 'TYPE_DYNAMIC',
        activity_sub_type: 'SUBTYPE_DYNAMIC_PAGE',
      });
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="name">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>{t('activityName')}</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              type="text"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>{t('activityDescription')}</FieldLabel>
            <Textarea
              id={field.name}
              name={field.name}
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <div className="mt-6 flex justify-end">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              className="mt-2.5"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? (
                <BarLoader
                  cssOverride={{ borderRadius: 60 }}
                  width={60}
                  color="#ffffff"
                />
              ) : (
                t('createActivity')
              )}
            </Button>
          )}
        />
      </div>
    </form>
  );
};

export default DynamicCanvaModal;
