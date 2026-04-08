'use client';

import { useForm } from '@tanstack/react-form';
import { Code2, Loader2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import * as v from 'valibot';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FieldDescription, FieldError, FieldLabel } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toFieldErrors } from '@/lib/tanstack-form';

const createValidationSchema = (t: (key: string) => string) =>
  v.object({
    name: v.pipe(v.string(), v.minLength(1, t('challengeNameRequired'))),
    description: v.pipe(v.string(), v.minLength(1, t('challengeDescriptionRequired'))),
    difficulty: v.picklist(['easy', 'medium', 'hard']),
    subtype: v.picklist(['general', 'competitive']),
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
}

export default function CodeChallengeActivityModal({
  submitActivity,
  chapterId,
  course,
  closeModal,
}: CodeChallengeActivityModalProps) {
  const t = useTranslations('Components.NewActivity.CodeChallenge');

  const validationSchema = createValidationSchema(t);

  const form = useForm({
    defaultValues: {
      name: '',
      description: '',
      difficulty: 'medium',
      subtype: 'general',
    },
    validators: {
      onChange: validationSchema,
      onSubmit: validationSchema,
    },
    onSubmit: async ({ value }) => {
      const activityData = {
        name: value.name,
        activity_type: 'TYPE_CODE_CHALLENGE',
        activity_sub_type: value.subtype === 'competitive' ? 'SUBTYPE_CODE_COMPETITIVE' : 'SUBTYPE_CODE_GENERAL',
        chapter_id: chapterId,
        published: false,
        content: {
          description: value.description,
          difficulty: value.difficulty,
        },
      };

      await submitActivity(activityData);
      closeModal?.();
    },
  });

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
              <FieldLabel htmlFor={field.name}>{t('name')}</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                placeholder={t('namePlaceholder')}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <FieldError errors={toFieldErrors(field.state.meta.errors)} />
            </Field>
          )}
        </form.Field>

        <form.Field name="description">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>{t('description')}</FieldLabel>
              <Textarea
                id={field.name}
                name={field.name}
                placeholder={t('descriptionPlaceholder')}
                className="min-h-24"
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <FieldDescription>{t('descriptionHint')}</FieldDescription>
              <FieldError errors={toFieldErrors(field.state.meta.errors)} />
            </Field>
          )}
        </form.Field>

        <div className="grid gap-4 md:grid-cols-2">
          <form.Field name="difficulty">
            {(field) => {
              const difficultyItems = [
                { value: 'easy', label: t('difficultyEasy') },
                { value: 'medium', label: t('difficultyMedium') },
                { value: 'hard', label: t('difficultyHard') },
              ];

              return (
                <Field>
                  <FieldLabel>{t('difficulty')}</FieldLabel>
                  <Select
                    items={difficultyItems}
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value as FormValues['difficulty'])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectDifficulty')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {difficultyItems.map((item) => (
                          <SelectItem
                            key={item.value}
                            value={item.value}
                          >
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError errors={toFieldErrors(field.state.meta.errors)} />
                </Field>
              );
            }}
          </form.Field>

          <form.Field name="subtype">
            {(field) => {
              const subtypeItems = [
                { value: 'general', label: t('typeGeneral') },
                { value: 'competitive', label: t('typeCompetitive') },
              ];

              return (
                <Field>
                  <FieldLabel>{t('type')}</FieldLabel>
                  <Select
                    items={subtypeItems}
                    value={field.state.value}
                    onValueChange={(value) => field.handleChange(value as FormValues['subtype'])}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectType')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {subtypeItems.map((item) => (
                          <SelectItem
                            key={item.value}
                            value={item.value}
                          >
                            {item.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldDescription>
                    {field.state.value === 'competitive' ? t('typeCompetitiveHint') : t('typeGeneralHint')}
                  </FieldDescription>
                  <FieldError errors={toFieldErrors(field.state.meta.errors)} />
                </Field>
              );
            }}
          </form.Field>
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
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting}
              >
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t('create')}
              </Button>
            )}
          />
        </div>
      </form>
    </div>
  );
}
