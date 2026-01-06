'use client';

import { useFieldArray, useForm, type SubmitHandler } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Grip, Plus, Trash2 } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useCallback } from 'react';
import { z } from 'zod';

import { Select, SelectContent, SelectItem, SelectPositioner, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Field, FieldLabel, FieldDescription, FieldContent, FieldError } from '@/components/ui/field';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Controller, FormProvider } from 'react-hook-form';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';

import { JUDGE0_LANGUAGES } from './LanguageSelector';
import { generateUUID } from '@/lib/utils';
import { CodeEditor } from './CodeEditor';

// Form schema
const testCaseSchema = z.object({
  id: z.string(),
  input: z.string(),
  expected_output: z.string().min(1, 'Expected output is required'),
  description: z.string().optional(),
  is_visible: z.boolean().default(true),
  points: z.number().min(0).default(10),
});

const codeChallengeFormSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional(),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  time_limit_ms: z.number().min(100).max(30_000).default(2000),
  memory_limit_kb: z.number().min(1024).max(512_000).default(128_000),
  max_submissions: z.number().min(0).optional(),
  grading_strategy: z.enum(['all_or_nothing', 'partial', 'weighted']),
  allowed_languages: z.array(z.number()).min(1, 'At least one language is required'),
  test_cases: z.array(testCaseSchema).min(1, 'At least one test case is required'),
  enable_hints: z.boolean().default(false),
  hints: z
    .array(
      z.object({
        text: z.string(),
        penalty_percent: z.number().min(0).max(100).default(10),
      }),
    )
    .optional(),
  starter_code: z.record(z.string(), z.string()).optional(),
  solution_code: z.record(z.string(), z.string()).optional(),
});

// Use Zod's input (pre-parse) type for form interactions and the inferred output type for the
// canonical, parsed form data we pass to the parent on submit.
type CodeChallengeFormInput = z.input<typeof codeChallengeFormSchema>;
type CodeChallengeFormData = z.infer<typeof codeChallengeFormSchema>;

interface CodeChallengeFormProps {
  activityUuid: string;
  // Accept partial input values (or parsed data — parsed data is assignable to input)
  initialData?: Partial<CodeChallengeFormInput>;
  onSubmit: (data: CodeChallengeFormData) => Promise<void>;
  onCancel?: () => void;
}

export function CodeChallengeForm({ activityUuid, initialData, onSubmit, onCancel }: CodeChallengeFormProps) {
  const t = useTranslations('Activities.CodeChallenges');

  const form = useForm<CodeChallengeFormInput>({
    resolver: zodResolver(codeChallengeFormSchema),
    defaultValues: {
      title: '',
      description: '',
      difficulty: 'medium',
      time_limit_ms: 2000,
      memory_limit_kb: 128_000,
      grading_strategy: 'partial',
      allowed_languages: [71], // Python by default
      test_cases: [
        {
          id: generateUUID(),
          input: '',
          expected_output: '',
          description: '',
          is_visible: true,
          points: 10,
        },
      ],
      enable_hints: false,
      hints: [],
      starter_code: {},
      solution_code: {},
      ...initialData,
    },
  });

  const {
    fields: testCaseFields,
    append: appendTestCase,
    remove: removeTestCase,
    move: moveTestCase,
  } = useFieldArray({
    control: form.control,
    name: 'test_cases',
  });

  const {
    fields: hintFields,
    append: appendHint,
    remove: removeHint,
  } = useFieldArray({
    control: form.control,
    name: 'hints',
  });

  const watchAllowedLanguages = form.watch('allowed_languages');
  const watchEnableHints = form.watch('enable_hints');
  const watchGradingStrategy = form.watch('grading_strategy');

  // Compute a safe default language id for the language Tabs (avoid undefined access)
  const defaultLanguageId = Number(watchAllowedLanguages?.[0] ?? JUDGE0_LANGUAGES?.[0]?.id ?? 71);

  const handleFormSubmit: SubmitHandler<CodeChallengeFormInput> = async (data) => {
    try {
      // Parse the raw input into the canonical, fully-populated output type
      const parsed: CodeChallengeFormData = codeChallengeFormSchema.parse(data);
      await onSubmit(parsed);
      toast.success(t('challengeSaved'));
    } catch (err) {
      // If something unexpected fails, show an error.
      toast.error(t('saveFailed'));
      throw err;
    }
  };

  const addTestCase = useCallback(() => {
    appendTestCase({
      id: generateUUID(),
      input: '',
      expected_output: '',
      description: '',
      is_visible: true,
      points: 10,
    });
  }, [appendTestCase]);

  const addHint = useCallback(() => {
    appendHint({
      text: '',
      penalty_percent: 10,
    });
  }, [appendHint]);

  // Popular languages for quick selection
  const popularLanguageIds = [71, 62, 63, 54, 51, 60, 68, 73, 74, 78];

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(handleFormSubmit)}
        className="space-y-6"
      >
        <Tabs
          defaultValue="basic"
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="basic">{t('form.basicInfo')}</TabsTrigger>
            <TabsTrigger value="testcases">{t('form.testCases')}</TabsTrigger>
            <TabsTrigger value="languages">{t('form.languages')}</TabsTrigger>
            <TabsTrigger value="advanced">{t('form.advanced')}</TabsTrigger>
          </TabsList>

          {/* Basic Info Tab */}
          <TabsContent
            value="basic"
            className="space-y-4 pt-4"
          >
            <Controller
              control={form.control}
              name="title"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>{t('form.title')}</FieldLabel>
                  <FieldContent>
                    <Input
                      placeholder={t('form.titlePlaceholder')}
                      {...field}
                    />
                  </FieldContent>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Controller
              control={form.control}
              name="description"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>{t('form.description')}</FieldLabel>
                  <FieldContent>
                    <Textarea
                      placeholder={t('form.descriptionPlaceholder')}
                      className="min-h-32"
                      {...field}
                    />
                  </FieldContent>
                  <FieldDescription>{t('form.descriptionHint')}</FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                control={form.control}
                name="difficulty"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>{t('form.difficulty')}</FieldLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FieldContent>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.selectDifficulty')} />
                        </SelectTrigger>
                      </FieldContent>
                      <SelectPositioner>
                        <SelectContent>
                          <SelectItem value="easy">
                            <span className="flex items-center gap-2">
                              <Badge variant="success">{t('difficulty.easy')}</Badge>
                            </span>
                          </SelectItem>
                          <SelectItem value="medium">
                            <span className="flex items-center gap-2">
                              <Badge variant="warning">{t('difficulty.medium')}</Badge>
                            </span>
                          </SelectItem>
                          <SelectItem value="hard">
                            <span className="flex items-center gap-2">
                              <Badge variant="destructive">{t('difficulty.hard')}</Badge>
                            </span>
                          </SelectItem>
                        </SelectContent>
                      </SelectPositioner>
                    </Select>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="grading_strategy"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>{t('form.gradingStrategy')}</FieldLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FieldContent>
                        <SelectTrigger>
                          <SelectValue placeholder={t('form.selectGradingStrategy')} />
                        </SelectTrigger>
                      </FieldContent>
                      <SelectPositioner>
                        <SelectContent>
                          <SelectItem value="all_or_nothing">{t('gradingStrategy.allOrNothing')}</SelectItem>
                          <SelectItem value="partial">{t('gradingStrategy.partial')}</SelectItem>
                          <SelectItem value="weighted">{t('gradingStrategy.weighted')}</SelectItem>
                        </SelectContent>
                      </SelectPositioner>
                    </Select>
                    <FieldDescription>{t(`gradingStrategy.${field.value}Hint`)}</FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <Controller
                control={form.control}
                name="time_limit_ms"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>{t('form.timeLimit')}</FieldLabel>
                    <FieldContent>
                      <Input
                        type="number"
                        min={100}
                        max={30_000}
                        {...field}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 2000)}
                      />
                    </FieldContent>
                    <FieldDescription>{t('form.timeLimitHint')}</FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />

              <Controller
                control={form.control}
                name="memory_limit_kb"
                render={({ field, fieldState }) => (
                  <Field>
                    <FieldLabel>{t('form.memoryLimit')}</FieldLabel>
                    <FieldContent>
                      <Input
                        type="number"
                        min={1024}
                        max={512_000}
                        {...field}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 128_000)}
                      />
                    </FieldContent>
                    <FieldDescription>{t('form.memoryLimitHint')}</FieldDescription>
                    <FieldError errors={[fieldState.error]} />
                  </Field>
                )}
              />
            </div>
          </TabsContent>

          {/* Test Cases Tab */}
          <TabsContent
            value="testcases"
            className="space-y-4 pt-4"
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-medium">{t('form.testCases')}</h3>
                <p className="text-muted-foreground text-sm">{t('form.testCasesDescription')}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={addTestCase}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('form.addTestCase')}
              </Button>
            </div>

            <div className="space-y-4">
              {testCaseFields.map((field, index) => (
                <Card key={field.id}>
                  <CardHeader className="pb-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Grip className="text-muted-foreground h-4 w-4 cursor-move" />
                        <CardTitle className="text-sm">
                          {t('testCase')} #{index + 1}
                        </CardTitle>
                      </div>
                      <div className="flex items-center gap-2">
                        <Controller
                          control={form.control}
                          name={`test_cases.${index}.is_visible`}
                          render={({ field }) => (
                            <Field className="flex items-center gap-2 space-y-0">
                              <FieldContent>
                                <Switch
                                  checked={field.value}
                                  onCheckedChange={field.onChange}
                                />
                              </FieldContent>
                              <FieldLabel className="text-xs font-normal">{t('form.visible')}</FieldLabel>
                            </Field>
                          )}
                        />
                        {testCaseFields.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeTestCase(index)}
                          >
                            <Trash2 className="text-destructive h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Controller
                      control={form.control}
                      name={`test_cases.${index}.description`}
                      render={({ field, fieldState }) => (
                        <Field>
                          <FieldLabel>{t('form.testDescription')}</FieldLabel>
                          <FieldContent>
                            <Input
                              placeholder={t('form.testDescriptionPlaceholder')}
                              {...field}
                            />
                          </FieldContent>
                          <FieldError errors={[fieldState.error]} />
                        </Field>
                      )}
                    />

                    <div className="grid gap-4 md:grid-cols-2">
                      <Controller
                        control={form.control}
                        name={`test_cases.${index}.input`}
                        render={({ field, fieldState }) => (
                          <Field>
                            <FieldLabel>{t('input')}</FieldLabel>
                            <FieldContent>
                              <Textarea
                                placeholder={t('form.inputPlaceholder')}
                                className="min-h-24 font-mono text-sm"
                                {...field}
                              />
                            </FieldContent>
                            <FieldError errors={[fieldState.error]} />
                          </Field>
                        )}
                      />

                      <Controller
                        control={form.control}
                        name={`test_cases.${index}.expected_output`}
                        render={({ field, fieldState }) => (
                          <Field>
                            <FieldLabel>{t('expectedOutput')}</FieldLabel>
                            <FieldContent>
                              <Textarea
                                placeholder={t('form.expectedOutputPlaceholder')}
                                className="min-h-24 font-mono text-sm"
                                {...field}
                              />
                            </FieldContent>
                            <FieldError errors={[fieldState.error]} />
                          </Field>
                        )}
                      />
                    </div>

                    {watchGradingStrategy === 'weighted' && (
                      <Controller
                        control={form.control}
                        name={`test_cases.${index}.points`}
                        render={({ field, fieldState }) => (
                          <Field className="max-w-32">
                            <FieldLabel>{t('form.points')}</FieldLabel>
                            <FieldContent>
                              <Input
                                type="number"
                                min={0}
                                {...field}
                                onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 0)}
                              />
                            </FieldContent>
                            <FieldError errors={[fieldState.error]} />
                          </Field>
                        )}
                      />
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          {/* Languages Tab */}
          <TabsContent
            value="languages"
            className="space-y-4 pt-4"
          >
            <Controller
              control={form.control}
              name="allowed_languages"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>{t('form.allowedLanguages')}</FieldLabel>
                  <FieldDescription>{t('form.allowedLanguagesHint')}</FieldDescription>

                  {/* Quick selection for popular languages */}
                  <div className="mb-4">
                    <h4 className="mb-2 text-sm font-medium">{t('popularLanguages')}</h4>
                    <div className="flex flex-wrap gap-2">
                      {popularLanguageIds.map((langId) => {
                        const lang = JUDGE0_LANGUAGES.find((l) => l.id === langId);
                        if (!lang) return null;
                        const isSelected = field.value.includes(langId);
                        return (
                          <Badge
                            key={langId}
                            variant={isSelected ? 'default' : 'outline'}
                            className="cursor-pointer"
                            onClick={() => {
                              if (isSelected) {
                                field.onChange(field.value.filter((id) => id !== langId));
                              } else {
                                field.onChange([...field.value, langId]);
                              }
                            }}
                          >
                            {lang.name}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <Separator />

                  {/* All languages */}
                  <div className="mt-4 max-h-64 overflow-y-auto">
                    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
                      {JUDGE0_LANGUAGES.map((lang) => {
                        const isSelected = field.value.includes(lang.id);
                        return (
                          <div
                            key={lang.id}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`lang-${lang.id}`}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked) {
                                  field.onChange([...field.value, lang.id]);
                                } else {
                                  field.onChange(field.value.filter((id) => id !== lang.id));
                                }
                              }}
                            />
                            <label
                              htmlFor={`lang-${lang.id}`}
                              className="text-sm leading-none font-medium peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                            >
                              {lang.name}
                            </label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            {/* Starter code per language */}
            {watchAllowedLanguages.length > 0 && (
              <div className="space-y-4 pt-4">
                <Separator />
                <div>
                  <h3 className="text-lg font-medium">{t('form.starterCode')}</h3>
                  <p className="text-muted-foreground text-sm">{t('form.starterCodeHint')}</p>
                </div>
                <Tabs defaultValue={defaultLanguageId.toString()}>
                  <TabsList className="flex-wrap">
                    {watchAllowedLanguages.map((langId) => {
                      const lang = JUDGE0_LANGUAGES.find((l) => l.id === langId);
                      return (
                        <TabsTrigger
                          key={langId}
                          value={langId.toString()}
                        >
                          {lang?.name ?? `Language ${langId}`}
                        </TabsTrigger>
                      );
                    })}
                  </TabsList>
                  {watchAllowedLanguages.map((langId) => (
                    <TabsContent
                      key={langId}
                      value={langId.toString()}
                    >
                      <Controller
                        control={form.control}
                        name={`starter_code.${langId}`}
                        render={({ field, fieldState }) => (
                          <Field>
                            <FieldContent>
                              <div className="h-48 overflow-hidden rounded border">
                                <CodeEditor
                                  value={field.value ?? ''}
                                  onChange={field.onChange}
                                  languageId={langId}
                                />
                              </div>
                            </FieldContent>
                            <FieldError errors={[fieldState.error]} />
                          </Field>
                        )}
                      />
                    </TabsContent>
                  ))}
                </Tabs>
              </div>
            )}
          </TabsContent>

          {/* Advanced Tab */}
          <TabsContent
            value="advanced"
            className="space-y-4 pt-4"
          >
            <Controller
              control={form.control}
              name="max_submissions"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>{t('form.maxSubmissions')}</FieldLabel>
                  <FieldContent>
                    <Input
                      type="number"
                      min={0}
                      placeholder={t('form.unlimitedSubmissions')}
                      {...field}
                      value={field.value ?? ''}
                      onChange={(e) => field.onChange(e.target.value ? Number.parseInt(e.target.value) : undefined)}
                    />
                  </FieldContent>
                  <FieldDescription>{t('form.maxSubmissionsHint')}</FieldDescription>
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />

            <Separator />

            {/* Hints Section */}
            <Controller
              control={form.control}
              name="enable_hints"
              render={({ field }) => (
                <Field className="flex items-center justify-between rounded-lg border p-4">
                  <div className="space-y-0.5">
                    <FieldLabel className="text-base">{t('form.enableHints')}</FieldLabel>
                    <FieldDescription>{t('form.enableHintsDescription')}</FieldDescription>
                  </div>
                  <FieldContent>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FieldContent>
                </Field>
              )}
            />

            {watchEnableHints && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">{t('form.hints')}</h4>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addHint}
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    {t('form.addHint')}
                  </Button>
                </div>
                {hintFields.map((field, index) => (
                  <Card key={field.id}>
                    <CardContent className="pt-4">
                      <div className="flex gap-4">
                        <div className="flex-1">
                          <Controller
                            control={form.control}
                            name={`hints.${index}.text`}
                            render={({ field, fieldState }) => (
                              <Field>
                                <FieldLabel>
                                  {t('form.hint')} #{index + 1}
                                </FieldLabel>
                                <FieldContent>
                                  <Textarea
                                    placeholder={t('form.hintPlaceholder')}
                                    {...field}
                                  />
                                </FieldContent>
                                <FieldError errors={[fieldState.error]} />
                              </Field>
                            )}
                          />
                        </div>
                        <div className="w-32">
                          <Controller
                            control={form.control}
                            name={`hints.${index}.penalty_percent`}
                            render={({ field, fieldState }) => (
                              <Field>
                                <FieldLabel>{t('form.penalty')}</FieldLabel>
                                <FieldContent>
                                  <Input
                                    type="number"
                                    min={0}
                                    max={100}
                                    {...field}
                                    onChange={(e) => field.onChange(Number.parseInt(e.target.value) || 0)}
                                  />
                                </FieldContent>
                                <FieldDescription>%</FieldDescription>
                                <FieldError errors={[fieldState.error]} />
                              </Field>
                            )}
                          />
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="mt-8"
                          onClick={() => removeHint(index)}
                        >
                          <Trash2 className="text-destructive h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Form Actions */}
        <div className="flex justify-end gap-4 pt-4">
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
            >
              {t('form.cancel')}
            </Button>
          )}
          <Button
            type="submit"
            disabled={form.formState.isSubmitting}
          >
            {form.formState.isSubmitting ? t('form.saving') : t('form.save')}
          </Button>
        </div>
      </form>
    </FormProvider>
  );
}

export default CodeChallengeForm;
