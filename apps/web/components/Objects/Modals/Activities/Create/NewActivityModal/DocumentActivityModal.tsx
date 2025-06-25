'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import BarLoader from 'react-spinners/BarLoader';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { constructAcceptValue } from '@/lib/constants';

const SUPPORTED_FILES = constructAcceptValue(['pdf']);

const validationSchema = z.object({
  name: z.string().min(1, 'Document name is required'),
  file: z.instanceof(File, { message: 'Please select a PDF file' }),
});

type FormValues = {
  name: string;
  file: File;
};

function DocumentPdfModal({ submitFileActivity, chapterId, course }: any) {
  const t = useTranslations('Components.DocumentPdfModal');

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: '',
      file: undefined as any,
    },
  });

  const onSubmit = async (values: FormValues) => {
    await submitFileActivity(
      values.file,
      'documentpdf',
      {
        name: values.name,
        chapter_id: chapterId,
        activity_type: 'TYPE_DOCUMENT',
        activity_sub_type: 'SUBTYPE_DOCUMENT_PDF',
        published_version: 1,
        version: 1,
        course_id: course.id,
      },
      chapterId,
    );
  };

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
      >
        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('pdfDocumentName')}</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  type="text"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="file"
          render={({ field: { onChange, value, ...field } }) => (
            <FormItem>
              <FormLabel>{t('pdfDocumentFile')}</FormLabel>
              <FormControl>
                <input
                  {...field}
                  type="file"
                  accept={SUPPORTED_FILES}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      onChange(file);
                    }
                  }}
                  className="border-input bg-background ring-offset-background placeholder:text-muted-foreground focus-visible:ring-ring flex h-10 w-full rounded-md border px-3 py-2 text-sm file:border-0 file:bg-transparent file:text-sm file:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
              t('createActivity')
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default DocumentPdfModal;
