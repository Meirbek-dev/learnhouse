'use client';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { createCertification, deleteCertification, updateCertification } from '@services/courses/certifications';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Controller, FormProvider, useForm, useWatch } from 'react-hook-form';
import { SectionHeader } from '@components/Dashboard/Courses/SectionHeader';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertTriangle, Award, FileText, Sparkles } from 'lucide-react';
import { Field, FieldError, FieldLabel } from '@/components/ui/field';
import { useSyncDirtySection } from '@/hooks/useSyncDirtySection';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useCourse } from '@components/Contexts/CourseContext';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { useSaveSection } from '@/hooks/useSaveSection';
import { Separator } from '@/components/ui/separator';
import CertificatePreview from './CertificatePreview';
import { Textarea } from '@/components/ui/textarea';
import { Spinner } from '@components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import * as v from 'valibot';

const CERTIFICATE_PATTERNS = [
  { value: 'royal', icon: '👑' },
  { value: 'tech', icon: '💻' },
  { value: 'nature', icon: '🌿' },
  { value: 'geometric', icon: '◆' },
  { value: 'vintage', icon: '📜' },
  { value: 'waves', icon: '🌊' },
  { value: 'minimal', icon: '⚪' },
  { value: 'professional', icon: '💼' },
  { value: 'academic', icon: '🎓' },
  { value: 'modern', icon: '✨' },
] as const;

// Module-level type-only schema (no translated messages needed for type inference)
const _certFormSchemaForTypes = v.object({
  enable_certification: v.boolean(),
  certification_name: v.string(),
  certification_description: v.string(),
  certification_type: v.picklist([
    'completion',
    'achievement',
    'assessment',
    'participation',
    'mastery',
    'professional',
    'continuing',
    'workshop',
    'specialization',
  ] as const),
  certificate_pattern: v.picklist([
    'royal',
    'tech',
    'nature',
    'geometric',
    'vintage',
    'waves',
    'minimal',
    'professional',
    'academic',
    'modern',
  ] as const),
  certificate_instructor: v.optional(v.string()),
});

type FormValues = v.InferOutput<typeof _certFormSchemaForTypes>;

const EditCourseCertification = () => {
  const [error, setError] = useState('');

  const course = useCourse();
  const { isLoading, courseStructure, editorData } = course;
  const session = usePlatformSession();
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('Certificates.EditCourseCertification');
  const tCommon = useTranslations('Common');

  const formSchema = useMemo(
    () =>
      v.pipe(
        v.object({
          enable_certification: v.boolean(),
          certification_name: v.pipe(v.string(), v.maxLength(100, t('maxCharacters100'))),
          certification_description: v.pipe(v.string(), v.maxLength(700, t('maxCharacters500'))),
          certification_type: v.picklist([
            'completion',
            'achievement',
            'assessment',
            'participation',
            'mastery',
            'professional',
            'continuing',
            'workshop',
            'specialization',
          ]),
          certificate_pattern: v.picklist([
            'royal',
            'tech',
            'nature',
            'geometric',
            'vintage',
            'waves',
            'minimal',
            'professional',
            'academic',
            'modern',
          ]),
          certificate_instructor: v.optional(v.string()),
        }),
        v.check((data) => {
          if (data.enable_certification) {
            return Boolean(data.certification_name?.trim() && data.certification_description?.trim());
          }
          return true;
        }, t('validationRequiredFields')),
      ),
    [t],
  );

  const certifications = editorData.certifications.data ?? [];
  const certificationsError = editorData.certifications.error;
  const [existingCertification] = certifications;
  const hasExistingCertification = Boolean(existingCertification);

  const form = useForm<FormValues>({
    resolver: valibotResolver(formSchema),
    defaultValues: {
      enable_certification: false,
      certification_name: '',
      certification_description: '',
      certification_type: 'completion',
      certificate_pattern: 'professional',
      certificate_instructor: '',
    },
  });

  const certificationTypeItems = (
    [
      'completion',
      'achievement',
      'assessment',
      'participation',
      'mastery',
      'professional',
      'continuing',
      'workshop',
      'specialization',
    ] as const
  ).map((type) => ({ value: type, label: t(`certificationTypes.${type}`) }));

  const getInitialValues = useCallback((): FormValues => {
    const getInstructorName = () => {
      if (courseStructure?.authors?.length > 0) {
        const [author] = courseStructure.authors;
        const firstName = author.user?.first_name || '';
        const lastName = author.user?.last_name || '';
        if (firstName || lastName) return `${firstName} ${lastName}`.trim();
      }
      return '';
    };

    const config = existingCertification?.config || {};
    return {
      enable_certification: hasExistingCertification,
      certification_name: config.certification_name || courseStructure?.name || '',
      certification_description: config.certification_description || courseStructure?.description || '',
      certification_type: (config.certification_type as FormValues['certification_type']) || 'completion',
      certificate_pattern: (config.certificate_pattern as FormValues['certificate_pattern']) || 'professional',
      certificate_instructor: config.certificate_instructor || getInstructorName(),
    };
  }, [courseStructure, existingCertification, hasExistingCertification]);

  const serverValues = useMemo(() => {
    if (editorData.certifications.data === null || isLoading) {
      return null;
    }
    return getInitialValues();
  }, [editorData.certifications.data, getInitialValues, isLoading]);

  const { isDirty } = form.formState;
  useSyncDirtySection('certification', isDirty);

  const handleDiscard = () => {
    if (serverValues) form.reset(serverValues);
    setError('');
  };

  const { isSaving, saveWithEditorRefresh } = useSaveSection({
    section: 'certification',
    errorMessage: t('certificationError'),
    onError: setError,
  });

  // Hydrate form from server data on load / when server data changes.
  useEffect(() => {
    if (!serverValues) return;
    form.reset(serverValues, { keepDirtyValues: true });
  }, [serverValues, form]);

  // Subscribe to individual watched fields to avoid over-rendering
  const isEnabled = useWatch({ control: form.control, name: 'enable_certification' });
  const certificationName = useWatch({ control: form.control, name: 'certification_name' });
  const certificationDescription = useWatch({
    control: form.control,
    name: 'certification_description',
  });
  const certificationType = useWatch({ control: form.control, name: 'certification_type' });
  const certificatePattern = useWatch({ control: form.control, name: 'certificate_pattern' });
  const certificateInstructor = useWatch({ control: form.control, name: 'certificate_instructor' });

  const handleSaveCertification = form.handleSubmit(async (values) => {
    if (!(access_token && courseStructure) || !isDirty) return;

    const config = {
      certification_name: values.certification_name,
      certification_description: values.certification_description,
      certification_type: values.certification_type,
      certificate_pattern: values.certificate_pattern,
      certificate_instructor: values.certificate_instructor,
    };

    setError('');

    await saveWithEditorRefresh(
      async () => {
        if (values.enable_certification) {
          if (existingCertification) {
            return updateCertification({
              certification_uuid: existingCertification.certification_uuid,
              config,
              access_token,
              options: {
                courseUuid: courseStructure.course_uuid,
                lastKnownUpdateDate: courseStructure.update_date,
              },
            });
          }

          return createCertification({
            course_id: courseStructure.id,
            config,
            access_token,
            options: {
              courseUuid: courseStructure.course_uuid,
              lastKnownUpdateDate: courseStructure.update_date,
            },
          });
        }

        if (existingCertification) {
          return deleteCertification(existingCertification.certification_uuid, access_token, {
            courseUuid: courseStructure.course_uuid,
            lastKnownUpdateDate: courseStructure.update_date,
          });
        }

        return { success: true };
      },
      {
        successMessage: values.enable_certification
          ? hasExistingCertification
            ? tCommon('saved')
            : t('certificationCreated')
          : t('certificationRemoved'),
        onSuccess: () => {
          form.reset(values);
          setError('');
        },
      },
    );
  });

  if (isLoading || !courseStructure || (course.isEditorDataLoading && editorData.certifications.data === null)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2">
          <Spinner className="size-6" />
          <span>{t('loading')}</span>
        </div>
      </div>
    );
  }

  if (certificationsError) {
    return (
      <Alert
        variant="destructive"
        className="mx-4 mt-8 sm:mx-10"
      >
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>{t('errorLoadingCertifications')}</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Card>
          <CardHeader className="space-y-1">
            <SectionHeader
              title={t('courseCertification')}
              description={t('enableCertification')}
              isDirty={isDirty}
              isSaving={isSaving}
              onSave={handleSaveCertification}
              onDiscard={handleDiscard}
            >
              <Label
                htmlFor="cert-toggle"
                className="cursor-pointer"
              >
                <Switch
                  id="cert-toggle"
                  checked={isEnabled}
                  onCheckedChange={(checked) => {
                    form.setValue('enable_certification', checked, { shouldDirty: true });
                  }}
                  disabled={isSaving}
                />
              </Label>
            </SectionHeader>
          </CardHeader>

          <CardContent>
            {error && (
              <Alert
                variant="destructive"
                className="mb-6"
              >
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {isEnabled && (
              <FormProvider {...form}>
                <form className="space-y-8">
                  <div className="grid gap-8 lg:grid-cols-5">
                    {/* Configuration */}
                    <div className="space-y-8 lg:col-span-3">
                      {/* Basic Information */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <FileText className="text-muted-foreground h-5 w-5" />
                          <h3 className="text-lg font-semibold">{t('basicInfo')}</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">{t('basicInfoDesc')}</p>
                        <Separator />

                        <div className="grid gap-4 sm:grid-cols-2">
                          <Controller
                            control={form.control}
                            name="certification_name"
                            render={({ field, fieldState }) => (
                              <Field className="sm:col-span-2">
                                <FieldLabel htmlFor={field.name}>{t('certificationName')}</FieldLabel>
                                <Input
                                  id={field.name}
                                  {...field}
                                  placeholder={t('certificationNamePlaceholder')}
                                />
                                <FieldError errors={[fieldState.error]} />
                              </Field>
                            )}
                          />

                          <Controller
                            control={form.control}
                            name="certification_type"
                            render={({ field, fieldState }) => (
                              <Field className="sm:col-span-2">
                                <FieldLabel>{t('certificationType')}</FieldLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  items={certificationTypeItems}
                                >
                                  <SelectTrigger>
                                    <SelectValue>{t(`certificationTypes.${field.value}`)}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectGroup>
                                      {certificationTypeItems.map((item) => (
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
                                <FieldError errors={[fieldState.error]} />
                              </Field>
                            )}
                          />

                          <Controller
                            control={form.control}
                            name="certification_description"
                            render={({ field, fieldState }) => (
                              <Field className="sm:col-span-2">
                                <FieldLabel htmlFor={field.name}>{t('certificationDescription')}</FieldLabel>
                                <Textarea
                                  id={field.name}
                                  {...field}
                                  placeholder={t('certificationDescriptionPlaceholder')}
                                  className="min-h-[120px] resize-none"
                                />
                                <FieldError errors={[fieldState.error]} />
                              </Field>
                            )}
                          />
                        </div>
                      </div>

                      {/* Design Section */}
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <Sparkles className="text-muted-foreground h-5 w-5" />
                          <h3 className="text-lg font-semibold">{t('certificateDesign')}</h3>
                        </div>
                        <p className="text-muted-foreground text-sm">{t('certificateDesignDesc')}</p>
                        <Separator />

                        <Controller
                          control={form.control}
                          name="certificate_pattern"
                          render={({ field, fieldState }) => (
                            <Field>
                              <FieldLabel>{t('certificatePattern')}</FieldLabel>
                              <RadioGroup
                                value={field.value}
                                onValueChange={field.onChange}
                                className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
                              >
                                {CERTIFICATE_PATTERNS.map((pattern) => (
                                  <Label
                                    key={pattern.value}
                                    htmlFor={`pattern-${pattern.value}`}
                                    className={`hover:border-primary/50 relative flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                                      field.value === pattern.value ? 'border-primary bg-primary/5' : 'border-border'
                                    }`}
                                  >
                                    <RadioGroupItem
                                      value={pattern.value}
                                      id={`pattern-${pattern.value}`}
                                      className="sr-only"
                                    />
                                    <span className="text-2xl">{pattern.icon}</span>
                                    <span className="text-xs font-medium">
                                      {t(`certificatePatterns.${pattern.value}`)}
                                    </span>
                                    {field.value === pattern.value && (
                                      <Badge
                                        variant="secondary"
                                        className="absolute -top-2 -right-2"
                                      >
                                        ✓
                                      </Badge>
                                    )}
                                  </Label>
                                ))}
                              </RadioGroup>
                              <FieldError errors={[fieldState.error]} />
                            </Field>
                          )}
                        />

                        <Controller
                          control={form.control}
                          name="certificate_instructor"
                          render={({ field, fieldState }) => (
                            <Field>
                              <FieldLabel htmlFor={field.name}>{t('certificateInstructor')}</FieldLabel>
                              <Input
                                id={field.name}
                                {...field}
                                placeholder={t('certificateInstructorPlaceholder')}
                              />
                              <FieldError errors={[fieldState.error]} />
                            </Field>
                          )}
                        />
                      </div>
                    </div>

                    {/* Preview */}
                    <div className="lg:col-span-2">
                      <div className="sticky top-6">
                        <Card>
                          <CardHeader>
                            <CardTitle className="flex items-center gap-2 text-base">
                              <Award className="h-4 w-4" />
                              {t('previewCertificate')}
                            </CardTitle>
                            <CardDescription>{t('livePreviewCertificate')}</CardDescription>
                          </CardHeader>
                          <CardContent>
                            <CertificatePreview
                              certificationName={certificationName || ''}
                              certificationDescription={certificationDescription || ''}
                              certificationType={certificationType || 'completion'}
                              certificatePattern={certificatePattern || 'professional'}
                              certificateInstructor={certificateInstructor}
                            />
                          </CardContent>
                        </Card>
                      </div>
                    </div>
                  </div>
                </form>
              </FormProvider>
            )}

            {!isEnabled && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-muted mb-4 rounded-full p-6">
                  <Award className="text-muted-foreground h-12 w-12" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{t('noCertificationConfigured')}</h3>
                <p className="text-muted-foreground mb-6 max-w-sm text-sm">{t('noCertificationDescription')}</p>
                <Button
                  type="button"
                  onClick={() => {
                    form.setValue('enable_certification', true, { shouldDirty: true });
                  }}
                  disabled={isSaving}
                >
                  <Award className="h-4 w-4" />
                  {t('enableCertificationButton')}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditCourseCertification;
