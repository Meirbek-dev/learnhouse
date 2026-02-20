import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { createCertification, deleteCertification } from '@services/courses/certifications';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { AlertTriangle, Award, FileText, Loader2, Sparkles } from 'lucide-react';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { zodResolver } from '@hookform/resolvers/zod';
import CertificatePreview from './CertificatePreview';
import { Textarea } from '@/components/ui/textarea';
import { getAPIUrl } from '@services/config/config';
import { useForm, useWatch } from 'react-hook-form';
import { Spinner } from '@components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import * as z from 'zod';
import useSWR from 'swr';

interface EditCourseCertificationProps {
  orgslug: string;
  course_uuid?: string;
}

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

const EditCourseCertification = (_props: EditCourseCertificationProps) => {
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [hasInitialized, setHasInitialized] = useState(false);

  const course = useCourse();
  const dispatchCourse = useCourseDispatch();
  const { isLoading, courseStructure } = course as any;
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('Certificates.EditCourseCertification');

  // Form schema
  const formSchema = z
    .object({
      enable_certification: z.boolean(),
      certification_name: z.string().max(100, t('maxCharacters100')),
      certification_description: z.string().max(500, t('maxCharacters500')),
      certification_type: z.enum([
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
      certificate_pattern: z.enum([
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
      certificate_instructor: z.string().optional(),
    })
    .refine(
      (data) => {
        if (data.enable_certification) {
          return data.certification_name?.trim() && data.certification_description?.trim();
        }
        return true;
      },
      {
        message: t('validationRequiredFields'),
      },
    );

  type FormValues = z.infer<typeof formSchema>;

  // Fetch certifications
  const {
    data: certifications,
    error: certificationsError,
    mutate: mutateCertifications,
  } = useSWR(
    courseStructure?.course_uuid && access_token ? `certifications/course/${courseStructure.course_uuid}` : null,
    async () => {
      if (!(courseStructure?.course_uuid && access_token)) return null;
      const result = await fetch(`${getAPIUrl()}certifications/course/${courseStructure.course_uuid}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${access_token}`,
        },
        credentials: 'include',
      });
      const response = await result.json();
      return {
        success: result.status === 200,
        data: response,
        status: result.status,
        HTTPmessage: result.statusText,
      };
    },
  );

  const existingCertification = certifications?.data?.[0];
  const hasExistingCertification = Boolean(existingCertification);

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      enable_certification: false,
      certification_name: '',
      certification_description: '',
      certification_type: 'completion',
      certificate_pattern: 'professional',
      certificate_instructor: '',
    },
  });

  const certificationTypes = [
    'completion',
    'achievement',
    'assessment',
    'participation',
    'mastery',
    'professional',
    'continuing',
    'workshop',
    'specialization',
  ] as const;

  const certificationTypeItems = certificationTypes.map((type) => ({
    value: type,
    label: t(`certificationTypes.${type}`),
  }));

  // Handle toggle
  const handleCertificationToggle = useCallback(
    async (enabled: boolean) => {
      if (enabled && !hasExistingCertification) {
        setIsCreating(true);
        setError('');

        try {
          const formValues = form.getValues();
          const config = {
            certification_name: formValues.certification_name || courseStructure?.name || '',
            certification_description: formValues.certification_description || courseStructure?.description || '',
            certification_type: formValues.certification_type || 'completion',
            certificate_pattern: formValues.certificate_pattern || 'professional',
            certificate_instructor: formValues.certificate_instructor || '',
          };

          const result = await createCertification(courseStructure.id, config, access_token);

          if (result) {
            toast.success(t('certificationCreated'));
            await mutateCertifications();
            form.setValue('enable_certification', true);
          } else {
            throw new Error('Failed to create certification');
          }
        } catch {
          setError(t('certificationError'));
          toast.error(t('certificationError'));
          form.setValue('enable_certification', false);
        } finally {
          setIsCreating(false);
        }
      } else if (!enabled && hasExistingCertification) {
        try {
          const result = await deleteCertification(existingCertification.certification_uuid, access_token);

          if (result) {
            toast.success(t('certificationRemoved'));
            await mutateCertifications();
            form.setValue('enable_certification', false);
          } else {
            throw new Error('Failed to delete certification');
          }
        } catch {
          setError(t('certificationRemoveError'));
          toast.error(t('certificationRemoveError'));
          form.setValue('enable_certification', true);
        }
      } else {
        form.setValue('enable_certification', enabled);
      }
    },
    [hasExistingCertification, form, courseStructure, access_token, existingCertification, mutateCertifications, t],
  );

  // Initialize form
  useEffect(() => {
    if (certifications && !isLoading && !hasInitialized) {
      const getInstructorName = () => {
        if (courseStructure?.authors?.length > 0) {
          const author = courseStructure.authors[0];
          const firstName = author.first_name || '';
          const lastName = author.last_name || '';
          if (firstName || lastName) {
            return `${firstName} ${lastName}`.trim();
          }
        }
        return '';
      };

      const config = existingCertification?.config || {};
      const newValues = {
        enable_certification: hasExistingCertification,
        certification_name: config.certification_name || courseStructure?.name || '',
        certification_description: config.certification_description || courseStructure?.description || '',
        certification_type: (config.certification_type as FormValues['certification_type']) || 'completion',
        certificate_pattern: (config.certificate_pattern as FormValues['certificate_pattern']) || 'professional',
        certificate_instructor: config.certificate_instructor || getInstructorName(),
      };

      form.reset(newValues);
      setHasInitialized(true);
    }
  }, [
    certifications,
    isLoading,
    hasInitialized,
    form,
    existingCertification,
    hasExistingCertification,
    courseStructure,
  ]);

  // Debounced update - subscribe only to specific fields to avoid full-form subscription re-renders
  const isEnabled = useWatch({ control: form.control, name: 'enable_certification' });
  const certificationName = useWatch({ control: form.control, name: 'certification_name' });
  const certificationDescription = useWatch({ control: form.control, name: 'certification_description' });
  const certificationType = useWatch({ control: form.control, name: 'certification_type' });
  const certificatePattern = useWatch({ control: form.control, name: 'certificate_pattern' });
  const certificateInstructor = useWatch({ control: form.control, name: 'certificate_instructor' });

  const watchedValuesRef = useRef({
    certification_name: certificationName,
    certification_description: certificationDescription,
    certification_type: certificationType,
    certificate_pattern: certificatePattern,
    certificate_instructor: certificateInstructor,
  });

  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoading && hasExistingCertification && hasInitialized) {
      const currentValues = {
        certification_name: certificationName,
        certification_description: certificationDescription,
        certification_type: certificationType,
        certificate_pattern: certificatePattern,
        certificate_instructor: certificateInstructor,
      };

      const prev = watchedValuesRef.current;
      const hasChanged = JSON.stringify(prev) !== JSON.stringify(currentValues);
      if (!hasChanged) return;

      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      debounceTimeoutRef.current = setTimeout(() => {
        watchedValuesRef.current = currentValues;
        dispatchCourse({ type: 'setIsNotSaved' });

        const updatedCourse = {
          ...courseStructure,
          _certificationData: {
            certification_uuid: existingCertification.certification_uuid,
            config: {
              certification_name: currentValues.certification_name,
              certification_description: currentValues.certification_description,
              certification_type: currentValues.certification_type,
              certificate_pattern: currentValues.certificate_pattern,
              certificate_instructor: currentValues.certificate_instructor,
            },
          },
        };

        dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse });
      }, 300);

      return () => {
        if (debounceTimeoutRef.current) {
          clearTimeout(debounceTimeoutRef.current);
        }
      };
    }
    return;
  }, [
    certificationName,
    certificationDescription,
    certificationType,
    certificatePattern,
    certificateInstructor,
    isLoading,
    hasExistingCertification,
    hasInitialized,
    existingCertification?.certification_uuid,
    dispatchCourse,
    courseStructure,
  ]);

  // Loading state
  if (isLoading || !courseStructure || (courseStructure.course_uuid && access_token && certifications === undefined)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-muted-foreground flex items-center gap-2">
          <Spinner className="size-6" />
          <span>{t('loading')}</span>
        </div>
      </div>
    );
  }

  // Error state
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
    <div className="space-y-6 py-6">
      <div className="mx-4 sm:mx-10">
        <Card>
          <CardHeader className="space-y-1">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <CardTitle className="text-2xl">{t('courseCertification')}</CardTitle>
                <CardDescription>{t('enableCertification')}</CardDescription>
              </div>
              <div className="flex items-center gap-3">
                <Label
                  htmlFor="cert-toggle"
                  className="cursor-pointer"
                >
                  <Switch
                    id="cert-toggle"
                    checked={isEnabled}
                    onCheckedChange={handleCertificationToggle}
                    disabled={isCreating}
                  />
                </Label>
                {isCreating && <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />}
              </div>
            </div>
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

            {/* Enabled State with Configuration */}
            {isEnabled && hasExistingCertification && (
              <Form {...form}>
                <form className="space-y-8">
                  <div className="grid gap-8 lg:grid-cols-5">
                    {/* Configuration Section */}
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
                          <FormField
                            control={form.control}
                            name="certification_name"
                            render={({ field }) => (
                              <FormItem className="sm:col-span-2">
                                <FormLabel>{t('certificationName')}</FormLabel>
                                <FormControl>
                                  <Input
                                    {...field}
                                    placeholder={t('certificationNamePlaceholder')}
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="certification_type"
                            render={({ field }) => (
                              <FormItem className="sm:col-span-2">
                                <FormLabel>{t('certificationType')}</FormLabel>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                  items={certificationTypeItems}
                                >
                                  <FormControl>
                                    <SelectTrigger>
                                      <SelectValue>{t(`certificationTypes.${field.value}`)}</SelectValue>
                                    </SelectTrigger>
                                  </FormControl>
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
                                <FormMessage />
                              </FormItem>
                            )}
                          />

                          <FormField
                            control={form.control}
                            name="certification_description"
                            render={({ field }) => (
                              <FormItem className="sm:col-span-2">
                                <FormLabel>{t('certificationDescription')}</FormLabel>
                                <FormControl>
                                  <Textarea
                                    {...field}
                                    placeholder={t('certificationDescriptionPlaceholder')}
                                    className="min-h-[120px] resize-none"
                                  />
                                </FormControl>
                                <FormMessage />
                              </FormItem>
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

                        <FormField
                          control={form.control}
                          name="certificate_pattern"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('certificatePattern')}</FormLabel>
                              <FormControl>
                                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
                                  {CERTIFICATE_PATTERNS.map((pattern) => (
                                    <button
                                      key={pattern.value}
                                      type="button"
                                      onClick={() => field.onChange(pattern.value)}
                                      className={`hover:border-primary/50 relative flex flex-col items-center gap-2 rounded-lg border-2 p-4 transition-all ${
                                        field.value === pattern.value ? 'border-primary bg-primary/5' : 'border-border'
                                      }`}
                                    >
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
                                    </button>
                                  ))}
                                </div>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        <FormField
                          control={form.control}
                          name="certificate_instructor"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('certificateInstructor')}</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  placeholder={t('certificateInstructorPlaceholder')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>
                    </div>

                    {/* Preview Section */}
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
              </Form>
            )}

            {/* Disabled State */}
            {!isEnabled && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="bg-muted mb-4 rounded-full p-6">
                  <Award className="text-muted-foreground h-12 w-12" />
                </div>
                <h3 className="mb-2 text-lg font-semibold">{t('noCertificationConfigured')}</h3>
                <p className="text-muted-foreground mb-6 max-w-sm text-sm">{t('noCertificationDescription')}</p>
                <button
                  type="button"
                  onClick={() => handleCertificationToggle(true)}
                  disabled={isCreating}
                  className="bg-primary text-primary-foreground hover:bg-primary/90 focus:ring-primary inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Award className="h-4 w-4" />
                  {t('enableCertificationButton')}
                </button>
              </div>
            )}

            {/* Creating State */}
            {isEnabled && !hasExistingCertification && isCreating && (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Loader2 className="text-primary mb-4 h-12 w-12 animate-spin" />
                <h3 className="mb-2 text-lg font-semibold">{t('creatingCertification')}</h3>
                <p className="text-muted-foreground max-w-sm text-sm">{t('creatingCertificationDescription')}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default EditCourseCertification;
