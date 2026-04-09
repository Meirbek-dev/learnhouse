'use client';

import { useForm, useStore } from '@tanstack/react-form';
import { apiFetch } from '@/lib/api-client';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Field, FieldDescription, FieldLabel } from '@/components/ui/field';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { swrFetcher } from '@services/utils/ts/requests';
import WhitelistManagement from './WhitelistManagement';
import { Separator } from '@/components/ui/separator';
import { getAPIUrl } from '@services/config/config';
import { useEffect } from 'react';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import * as v from 'valibot';
import useSWR from 'swr';

const createValidationSchema = (
  limits = {
    time_limit: { min: 1, max: 180 },
    attempt_limit: { min: 1, max: 5 },
    question_limit: { min: 1 },
    violation_threshold: { min: 1, max: 10 },
  },
) =>
  v.object({
    time_limit: v.nullable(
      v.optional(v.pipe(v.number(), v.minValue(limits.time_limit.min), v.maxValue(limits.time_limit.max))),
    ),
    attempt_limit: v.nullable(
      v.optional(v.pipe(v.number(), v.minValue(limits.attempt_limit.min), v.maxValue(limits.attempt_limit.max))),
    ),
    shuffle_questions: v.boolean(),
    // shuffle_answers is always true (enforced server-side)
    question_limit: v.nullable(v.optional(v.pipe(v.number(), v.minValue(limits.question_limit.min)))),
    access_mode: v.picklist(['NO_ACCESS', 'WHITELIST', 'ALL_ENROLLED']),
    allow_result_review: v.boolean(),
    show_correct_answers: v.boolean(),
    copy_paste_protection: v.boolean(),
    tab_switch_detection: v.boolean(),
    devtools_detection: v.boolean(),
    right_click_disable: v.boolean(),
    fullscreen_enforcement: v.boolean(),
    violation_threshold: v.nullable(
      v.optional(
        v.pipe(v.number(), v.minValue(limits.violation_threshold.min), v.maxValue(limits.violation_threshold.max)),
      ),
    ),
  });

interface ExamSettingsProps {
  exam: any;
  courseUuid: string;
  onSettingsUpdated: () => void;
}

export default function ExamSettings({ exam, courseUuid, onSettingsUpdated }: ExamSettingsProps) {
  const t = useTranslations('Components.ExamSettings');

  const settings = exam.settings || {};

  const { data: limits, error: limitsError } = useSWR(`${getAPIUrl()}exams/config`, swrFetcher);

  // show a soft error; allow editing with default bounds
  if (limitsError) {
    console.error('Failed to load exam config limits', limitsError);
  }

  const validationSchema = createValidationSchema(limits);

  const form = useForm({
    defaultValues: {
      time_limit: settings.time_limit || null,
      attempt_limit: settings.attempt_limit || null,
      shuffle_questions: settings.shuffle_questions ?? true,
      question_limit: settings.question_limit || null,
      access_mode: settings.access_mode || 'NO_ACCESS',
      allow_result_review: settings.allow_result_review ?? true,
      show_correct_answers: settings.show_correct_answers ?? true,
      copy_paste_protection: settings.copy_paste_protection ?? true,
      tab_switch_detection: settings.tab_switch_detection ?? true,
      devtools_detection: settings.devtools_detection ?? true,
      right_click_disable: settings.right_click_disable ?? true,
      fullscreen_enforcement: settings.fullscreen_enforcement ?? true,
      violation_threshold: settings.violation_threshold || null,
    },
    validators: {
      onChange: validationSchema,
      onSubmit: validationSchema,
    },
    onSubmit: async ({ value }) => {
      const toastLoading = toast.loading(t('savingSettings'));
      try {
        const payload = { ...value, shuffle_answers: true };
        const response = await apiFetch(`exams/${exam.exam_uuid}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ settings: payload }),
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.detail || 'Failed to update settings');
        }

        toast.success(t('settingsUpdated'), { id: toastLoading });
        onSettingsUpdated();
      } catch (error: unknown) {
        console.error('Error updating settings:', error);
        toast.error((error instanceof Error ? error.message : undefined) || t('errorUpdatingSettings'), { id: toastLoading });
      }
    },
  });

  // If limits arrive after initial render, we could reset the form to clamp values to new defaults
  useEffect(() => {
    if (!limits) return;
    // clamp currently set values to the allowed ranges
    const clamp = (v: number | null | undefined, min?: number, max?: number) => {
      if (v === null || v === undefined) return null;
      if (min !== undefined && v < min) return min;
      if (max !== undefined && v > max) return max;
      return v;
    };

    const current = form.state.values;
    const newValues = {
      ...current,
      time_limit: clamp(current.time_limit, limits?.time_limit?.min, limits?.time_limit?.max),
      attempt_limit: clamp(current.attempt_limit, limits?.attempt_limit?.min, limits?.attempt_limit?.max),
      question_limit: clamp(current.question_limit, limits?.question_limit?.min),
      violation_threshold: clamp(
        current.violation_threshold,
        limits?.violation_threshold?.min,
        limits?.violation_threshold?.max,
      ),
    };

    form.reset(newValues);
  }, [limits, form]);

  // Reset to sane defaults (uses server-provided limits when available)
  const resetToDefaults = () => {
    const defaults = {
      time_limit: limits?.time_limit?.min ?? 60,
      attempt_limit: null,
      shuffle_questions: true,
      question_limit: null,
      access_mode: 'NO_ACCESS',
      allow_result_review: true,
      show_correct_answers: true,
      copy_paste_protection: true,
      tab_switch_detection: true,
      devtools_detection: true,
      right_click_disable: true,
      fullscreen_enforcement: true,
      violation_threshold: null,
    } as const;

    form.reset(defaults);
    toast.success(t('settingsReset'));
  };

  const values = useStore(form.store, (state) => state.values);
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  const hasTimeLimit = values.time_limit !== null;
  const hasAttemptLimit = values.attempt_limit !== null;
  const hasQuestionLimit = values.question_limit !== null;
  const hasViolationThreshold = values.violation_threshold !== null;
  const anyAntiCheatEnabled =
    values.copy_paste_protection ||
    values.tab_switch_detection ||
    values.devtools_detection ||
    values.right_click_disable ||
    values.fullscreen_enforcement;

  const initialAccessMode = settings.access_mode || 'NO_ACCESS';

  const accessModes = [
    { value: 'NO_ACCESS', label: t('accessModeNoAccess') },
    { value: 'WHITELIST', label: t('accessModeWhitelist') },
    { value: 'ALL_ENROLLED', label: t('accessModeAllEnrolled') },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('examSettings')}</CardTitle>
        <CardDescription>{t('configureExamBehavior')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            event.stopPropagation();
            void form.handleSubmit();
          }}
          className="space-y-8"
        >
          {/* Time & Attempts */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t('timeAndAttempts')}</h3>
              <p className="text-muted-foreground text-sm">{t('timeAndAttemptsDescription')}</p>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>{t('enableTimeLimit')}</Label>
                  <p className="text-muted-foreground text-sm">{t('timeLimitDescription')}</p>
                </div>
                <Switch
                  checked={hasTimeLimit}
                  onCheckedChange={(checked) => {
                    form.setFieldValue('time_limit', checked ? 60 : null);
                  }}
                />
              </div>

              {hasTimeLimit && (
                <form.Field name="time_limit">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>{t('timeLimitMinutes')}</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={limits?.time_limit?.min ?? 1}
                        max={limits?.time_limit?.max ?? 180}
                        value={field.state.value || ''}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value ? Number.parseInt(e.target.value) : null)}
                      />
                      <FieldDescription>{t('timeLimitMinutesDescription')}</FieldDescription>
                    </Field>
                  )}
                </form.Field>
              )}

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>{t('enableAttemptLimit')}</Label>
                  <p className="text-muted-foreground text-sm">{t('attemptLimitDescription')}</p>
                </div>
                <Switch
                  checked={hasAttemptLimit}
                  onCheckedChange={(checked) => {
                    form.setFieldValue('attempt_limit', checked ? 1 : null);
                  }}
                />
              </div>

              {hasAttemptLimit && (
                <form.Field name="attempt_limit">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>{t('attemptLimit')}</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={limits?.attempt_limit?.min ?? 1}
                        max={limits?.attempt_limit?.max ?? 5}
                        value={field.state.value || ''}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value ? Number.parseInt(e.target.value) : null)}
                      />
                      <FieldDescription>{t('attemptLimitInputDescription')}</FieldDescription>
                    </Field>
                  )}
                </form.Field>
              )}
            </div>
          </div>

          <Separator />

          {/* Question Behavior */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t('questionBehavior')}</h3>
              <p className="text-muted-foreground text-sm">{t('questionBehaviorDescription')}</p>
            </div>

            <div className="space-y-4">
              <form.Field name="shuffle_questions">
                {(field) => (
                  <Field
                    orientation="horizontal"
                    className="justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-0.5">
                      <FieldLabel>{t('shuffleQuestions')}</FieldLabel>
                      <FieldDescription>{t('shuffleQuestionsDescription')}</FieldDescription>
                    </div>
                    <Switch
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                  </Field>
                )}
              </form.Field>

              <div className="flex items-center justify-between rounded-lg border p-4 opacity-50">
                <div className="space-y-0.5">
                  <Label>{t('shuffleAnswers')}</Label>
                  <p className="text-muted-foreground text-sm">{t('shuffleAnswersDescription')}</p>
                </div>
                <Switch
                  checked
                  disabled
                />
              </div>

              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>{t('enableQuestionLimit')}</Label>
                  <p className="text-muted-foreground text-sm">{t('questionLimitDescription')}</p>
                </div>
                <Switch
                  checked={hasQuestionLimit}
                  onCheckedChange={(checked) => {
                    form.setFieldValue('question_limit', checked ? 10 : null);
                  }}
                />
              </div>

              {hasQuestionLimit && (
                <form.Field name="question_limit">
                  {(field) => (
                    <Field>
                      <FieldLabel htmlFor={field.name}>{t('questionLimit')}</FieldLabel>
                      <Input
                        id={field.name}
                        name={field.name}
                        type="number"
                        min={limits?.question_limit?.min ?? 1}
                        value={field.state.value || ''}
                        onBlur={field.handleBlur}
                        onChange={(e) => field.handleChange(e.target.value ? Number.parseInt(e.target.value) : null)}
                      />
                      <FieldDescription>{t('questionLimitInputDescription')}</FieldDescription>
                    </Field>
                  )}
                </form.Field>
              )}
            </div>
          </div>

          <Separator />

          {/* Access Control */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t('accessControl')}</h3>
              <p className="text-muted-foreground text-sm">{t('accessControlDescription')}</p>
            </div>

            <form.Field name="access_mode">
              {(field) => (
                <Field>
                  <FieldLabel>{t('accessMode')}</FieldLabel>
                  <Select
                    onValueChange={field.handleChange}
                    value={field.state.value ?? 'NO_ACCESS'}
                    items={accessModes}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('selectAccessMode')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {accessModes.map((item) => (
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
                  <FieldDescription>{t('accessModeDescription')}</FieldDescription>
                </Field>
              )}
            </form.Field>

            {/* Warning if switching away from whitelist - stored list will remain but be ignored */}
            {initialAccessMode === 'WHITELIST' && values.access_mode !== 'WHITELIST' && (
              <Alert>
                <AlertTitle>{t('whitelistWillBeIgnored')}</AlertTitle>
                <AlertDescription>{t('whitelistWillBeIgnoredDescription')}</AlertDescription>
              </Alert>
            )}

            {/* Whitelist Management - Only show when access mode is WHITELIST */}
            {values.access_mode === 'WHITELIST' && (
              <WhitelistManagement
                examUuid={exam.exam_uuid}
                courseUuid={courseUuid}
                currentWhitelist={settings.whitelist_user_ids || []}
                onWhitelistUpdated={onSettingsUpdated}
              />
            )}
          </div>

          <Separator />

          {/* Result Visibility */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t('resultVisibility')}</h3>
              <p className="text-muted-foreground text-sm">{t('resultVisibilityDescription')}</p>
            </div>

            <div className="space-y-4">
              <form.Field name="allow_result_review">
                {(field) => (
                  <Field
                    orientation="horizontal"
                    className="justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-0.5">
                      <FieldLabel>{t('allowResultReview')}</FieldLabel>
                      <FieldDescription>{t('allowResultReviewDescription')}</FieldDescription>
                    </div>
                    <Switch
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                  </Field>
                )}
              </form.Field>

              {values.allow_result_review && (
                <form.Field name="show_correct_answers">
                  {(field) => (
                    <Field
                      orientation="horizontal"
                      className="ml-6 justify-between rounded-lg border p-4"
                    >
                      <div className="space-y-0.5">
                        <FieldLabel>{t('showCorrectAnswers')}</FieldLabel>
                        <FieldDescription>{t('showCorrectAnswersDescription')}</FieldDescription>
                      </div>
                      <Switch
                        checked={field.state.value}
                        onCheckedChange={field.handleChange}
                      />
                    </Field>
                  )}
                </form.Field>
              )}
            </div>
          </div>

          <Separator />

          {/* Anti-Cheating */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold">{t('antiCheating')}</h3>
              <p className="text-muted-foreground text-sm">{t('antiCheatingDescription')}</p>
            </div>

            <div className="space-y-4">
              <form.Field name="copy_paste_protection">
                {(field) => (
                  <Field
                    orientation="horizontal"
                    className="justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-0.5">
                      <FieldLabel>{t('copyPasteProtection')}</FieldLabel>
                      <FieldDescription>{t('copyPasteProtectionDescription')}</FieldDescription>
                    </div>
                    <Switch
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="tab_switch_detection">
                {(field) => (
                  <Field
                    orientation="horizontal"
                    className="justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-0.5">
                      <FieldLabel>{t('tabSwitchDetection')}</FieldLabel>
                      <FieldDescription>{t('tabSwitchDetectionDescription')}</FieldDescription>
                    </div>
                    <Switch
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="devtools_detection">
                {(field) => (
                  <Field
                    orientation="horizontal"
                    className="justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-0.5">
                      <FieldLabel>{t('devtoolsDetection')}</FieldLabel>
                      <FieldDescription>{t('devtoolsDetectionDescription')}</FieldDescription>
                    </div>
                    <Switch
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="right_click_disable">
                {(field) => (
                  <Field
                    orientation="horizontal"
                    className="justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-0.5">
                      <FieldLabel>{t('rightClickDisable')}</FieldLabel>
                      <FieldDescription>{t('rightClickDisableDescription')}</FieldDescription>
                    </div>
                    <Switch
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                  </Field>
                )}
              </form.Field>

              <form.Field name="fullscreen_enforcement">
                {(field) => (
                  <Field
                    orientation="horizontal"
                    className="justify-between rounded-lg border p-4"
                  >
                    <div className="space-y-0.5">
                      <FieldLabel>{t('fullscreenEnforcement')}</FieldLabel>
                      <FieldDescription>{t('fullscreenEnforcementDescription')}</FieldDescription>
                    </div>
                    <Switch
                      checked={field.state.value}
                      onCheckedChange={field.handleChange}
                    />
                  </Field>
                )}
              </form.Field>

              {anyAntiCheatEnabled && (
                <>
                  <div className="flex items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <Label>{t('enableViolationThreshold')}</Label>
                      <p className="text-muted-foreground text-sm">{t('violationThresholdDescription')}</p>
                    </div>
                    <Switch
                      checked={hasViolationThreshold}
                      onCheckedChange={(checked) => {
                        form.setFieldValue('violation_threshold', checked ? 3 : null);
                      }}
                    />
                  </div>

                  {hasViolationThreshold && (
                    <form.Field name="violation_threshold">
                      {(field) => (
                        <Field>
                          <FieldLabel htmlFor={field.name}>{t('violationThreshold')}</FieldLabel>
                          <Input
                            id={field.name}
                            name={field.name}
                            type="number"
                            min={limits?.violation_threshold?.min ?? 1}
                            max={limits?.violation_threshold?.max ?? 10}
                            value={field.state.value || ''}
                            onBlur={field.handleBlur}
                            onChange={(e) =>
                              field.handleChange(e.target.value ? Number.parseInt(e.target.value) : null)
                            }
                          />
                          <FieldDescription>{t('violationThresholdInputDescription')}</FieldDescription>
                        </Field>
                      )}
                    </form.Field>
                  )}
                </>
              )}
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              type="button"
              onClick={resetToDefaults}
            >
              {t('resetDefaults')}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('saving') : t('saveSettings')}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
