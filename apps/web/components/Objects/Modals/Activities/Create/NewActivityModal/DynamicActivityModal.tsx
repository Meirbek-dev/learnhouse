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
  name: z.string().min(1, 'Activity name is required'),
  description: z.string().min(1, 'Activity description is required'),
});

interface FormValues {
  name: string;
  description: string;
}

function DynamicCanvaModal({ submitActivity, chapterId, course }: any) {
  const t = useTranslations('Components.DynamicCanvaModal');

  const form = useForm<FormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: '',
      description: '',
    },
  });

  const onSubmit = async (values: FormValues) => {
    await submitActivity({
      name: values.name,
      chapter_id: chapterId,
      activity_type: 'TYPE_DYNAMIC',
      activity_sub_type: 'SUBTYPE_DYNAMIC_PAGE',
      published_version: 1,
      version: 1,
      course_id: course.id,
    });
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
              <FormLabel>{t('activityName')}</FormLabel>
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
              <FormLabel>{t('activityDescription')}</FormLabel>
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
              t('createActivity')
            )}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default DynamicCanvaModal;
