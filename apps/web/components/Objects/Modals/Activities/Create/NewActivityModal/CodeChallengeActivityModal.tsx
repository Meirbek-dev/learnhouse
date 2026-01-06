'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Code2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectPositioner, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const createValidationSchema = (t: (key: string) => string) =>
  z.object({
    name: z.string().min(1, t('challengeNameRequired')),
    description: z.string().min(1, t('challengeDescriptionRequired')),
    difficulty: z.enum(['easy', 'medium', 'hard']),
    subtype: z.enum(['general', 'competitive']),
  });

interface FormValues {
  name: string;
  description: string;
  difficulty: 'easy' | 'medium' | 'hard';
  subtype: 'general' | 'competitive';
}

interface CodeChallengeActivityModalProps {
  submitActivity: (data: any) => Promise<void>;
  chapterId: number;
  course: any;
  closeModal?: () => void;
  orgslug: string;
}

export default function CodeChallengeActivityModal({
  submitActivity,
  chapterId,
  course,
  closeModal,
  orgslug,
}: CodeChallengeActivityModalProps) {
  const t = useTranslations('Components.NewActivity.CodeChallenge');

  const validationSchema = createValidationSchema(t);
  type ValidationSchema = z.infer<typeof validationSchema>;

  const form = useForm<ValidationSchema>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: '',
      description: '',
      difficulty: 'medium',
      subtype: 'general',
    },
  });

  const handleSubmit = async (values: FormValues) => {
    const activityData = {
      name: values.name,
      activity_type: 'TYPE_CODE_CHALLENGE',
      activity_sub_type: values.subtype === 'competitive' ? 'SUBTYPE_CODE_COMPETITIVE' : 'SUBTYPE_CODE_GENERAL',
      chapter_id: chapterId,
      course_id: course.id,
      published: false,
      content: {
        description: values.description,
        difficulty: values.difficulty,
      },
    };

    await submitActivity(activityData);
    closeModal?.();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
          <Code2 className="text-primary h-5 w-5" />
        </div>
        <div>
          <h3 className="text-lg font-semibold">{t('title')}</h3>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
      </div>

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
                <FormLabel>{t('name')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('namePlaceholder')}
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
                <FormLabel>{t('description')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t('descriptionPlaceholder')}
                    className="min-h-24"
                    {...field}
                  />
                </FormControl>
                <FormDescription>{t('descriptionHint')}</FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="grid gap-4 md:grid-cols-2">
            <FormField
              control={form.control}
              name="difficulty"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('difficulty')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectDifficulty')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectPositioner>
                      <SelectContent>
                        <SelectItem value="easy">{t('difficultyEasy')}</SelectItem>
                        <SelectItem value="medium">{t('difficultyMedium')}</SelectItem>
                        <SelectItem value="hard">{t('difficultyHard')}</SelectItem>
                      </SelectContent>
                    </SelectPositioner>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="subtype"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('type')}</FormLabel>
                  <Select
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectType')} />
                      </SelectTrigger>
                    </FormControl>
                    <SelectPositioner>
                      <SelectContent>
                        <SelectItem value="general">{t('typeGeneral')}</SelectItem>
                        <SelectItem value="competitive">{t('typeCompetitive')}</SelectItem>
                      </SelectContent>
                    </SelectPositioner>
                  </Select>
                  <FormDescription>
                    {field.value === 'competitive' ? t('typeCompetitiveHint') : t('typeGeneralHint')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            {closeModal && (
              <Button
                type="button"
                variant="outline"
                onClick={closeModal}
              >
                {t('cancel')}
              </Button>
            )}
            <Button
              type="submit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('create')}
            </Button>
          </div>
        </form>
      </Form>
    </div>
  );
}
