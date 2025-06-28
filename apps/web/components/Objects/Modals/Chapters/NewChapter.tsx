'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { z } from 'zod';

import { Button } from '@/components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';

const validationSchema = z.object({
  name: z.string().min(1, 'Chapter name is required'),
  description: z.string().min(1, 'Chapter description is required'),
});

interface FormValues {
  name: string;
  description: string;
}

function NewChapterModal({ submitChapter, closeModal, course }: any) {
  const t = useTranslations('Components.NewChapterModal');

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    const chapter_object = {
      name: values.name,
      description: values.description,
      thumbnail_image: '',
      course_id: course.id,
      org_id: course.org_id,
    };
    await submitChapter(chapter_object);
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
              <FormLabel>{t('chapterName')}</FormLabel>
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
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('chapterDescription')}</FormLabel>
              <FormControl>
                <Textarea {...field} />
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
              t('createChapter')
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default NewChapterModal;
