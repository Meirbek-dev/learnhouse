'use client';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { useForm } from '@tanstack/react-form';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { constructAcceptValue } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import * as v from 'valibot';

const SUPPORTED_FILES = constructAcceptValue(['pdf']);

const createValidationSchema = (t: (key: string) => string) =>
  v.object({
    name: v.pipe(v.string(), v.minLength(1, t('documentNameRequired'))),
    file: v.instance(File, t('pdfFileRequired')),
  });

interface FormValues {
  name: string;
  file: File | null;
}

const DocumentPdfModal = ({ submitFileActivity, chapterId, course }: any) => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Components.DocumentPdfModal');
  const validationSchema = createValidationSchema(validationT);
  const defaultValues: FormValues = {
    name: '',
    file: null,
  };

  const form = useForm({
    defaultValues,
    validators: {
      onChange: validationSchema,
      onSubmit: validationSchema,
    },
    onSubmit: async ({ value }) => {
      await submitFileActivity({
        file: value.file,
        type: 'documentpdf',
        activity: {
          name: value.name,
          chapter_id: chapterId,
          activity_type: 'TYPE_DOCUMENT',
          activity_sub_type: 'SUBTYPE_DOCUMENT_PDF',
        },
        chapterId,
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
            <FieldLabel htmlFor={field.name}>{t('pdfDocumentName')}</FieldLabel>
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

      <form.Field name="file">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>{t('pdfDocumentFile')}</FieldLabel>
            <div className="relative">
              <input
                id={field.name}
                name={field.name}
                type="file"
                accept={SUPPORTED_FILES}
                onBlur={field.handleBlur}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (file) {
                    field.handleChange(file);
                  }
                }}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                aria-label={t('ariaLabel')}
              />
              <div className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full cursor-pointer items-center justify-between rounded-md border px-3 py-2 text-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-50">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="-ml-3"
                  onClick={() => {}}
                >
                  {t('selectFile')}
                </Button>
                <span className="text-muted-foreground">
                  {field.state.value ? field.state.value.name : t('noFileSelected')}
                </span>
              </div>
            </div>
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

export default DocumentPdfModal;
