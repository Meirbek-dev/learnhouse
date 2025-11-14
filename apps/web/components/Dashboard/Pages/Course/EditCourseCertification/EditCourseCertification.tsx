import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { createCertification, deleteCertification } from '@services/courses/certifications';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { AlertTriangle, Award, FileText, Loader2, Settings } from 'lucide-react';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { useEffect, useState, useTransition } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import CertificatePreview from './CertificatePreview';
import { Textarea } from '@/components/ui/textarea';
import { getAPIUrl } from '@services/config/config';
import { Input } from '@/components/ui/input';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import * as z from 'zod';
import useSWR from 'swr';

interface EditCourseCertificationProps {
  orgslug: string;
  course_uuid?: string;
}

const EditCourseCertification = (_props: EditCourseCertificationProps) => {
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [_isPending, startTransition] = useTransition();
  const [hasInitialized, setHasInitialized] = useState(false);
  const course = useCourse();
  const dispatchCourse = useCourseDispatch();
  const { isLoading, courseStructure } = course as any;
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('Certificates.EditCourseCertification');

  // Zod schema for form validation with localized messages
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
        // Custom validation for conditional required fields
        if (data.enable_certification) {
          if (!data.certification_name || data.certification_name.trim() === '') {
            return false;
          }
          if (!data.certification_description || data.certification_description.trim() === '') {
            return false;
          }
        }
        return true;
      },
      {
        message: t('validationRequiredFields'),
      },
    );

  type FormValues = z.infer<typeof formSchema>;

  // Fetch existing certifications
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

  const existingCertification = certifications?.data?.[0]; // Assuming one certification per course
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

  // Handle enabling/disabling certification
  const handleCertificationToggle = async (enabled: boolean) => {
    if (enabled && !hasExistingCertification) {
      // Create new certification
      startTransition(() => setIsCreating(true));
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

        // createCertification uses errorHandling which returns JSON directly on success
        if (result) {
          toast.success(t('certificationCreated'));
          mutateCertifications();
          form.setValue('enable_certification', true);
        } else {
          throw new Error('Failed to create certification');
        }
      } catch {
        setError(t('certificationError'));
        toast.error(t('certificationError'));
        form.setValue('enable_certification', false);
      } finally {
        startTransition(() => setIsCreating(false));
      }
    } else if (!enabled && hasExistingCertification) {
      // Delete existing certification
      try {
        const result = await deleteCertification(existingCertification.certification_uuid, access_token);

        // deleteCertification uses errorHandling which returns JSON directly on success
        if (result) {
          toast.success(t('certificationRemoved'));
          mutateCertifications();
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
  };

  // Reset form when certifications data changes (only on initial load)
  useEffect(() => {
    if (certifications && !isLoading && !hasInitialized) {
      // Helper function to get instructor name from authors
      const getInstructorName = () => {
        if (courseStructure?.authors && courseStructure.authors.length > 0) {
          const author = courseStructure.authors[0];
          const firstName = author.first_name || '';
          const lastName = author.last_name || '';

          // Only return if at least one name exists
          if (firstName || lastName) {
            return `${firstName} ${lastName}`.trim();
          }
        }
        return '';
      };

      // Use existing certification data if available, otherwise fall back to course data
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

  // Watch form values and update course state (debounced)
  const watchedValues = form.watch();
  const [debounceTimeout, setDebounceTimeout] = useState<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!isLoading && hasExistingCertification && hasInitialized && watchedValues) {
      // Clear previous timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }

      // Set new timeout to debounce updates
      const timeout = setTimeout(() => {
        dispatchCourse({ type: 'setIsNotSaved' });

        // Store certification data in course context so it gets saved with the main save button
        const updatedCourse = {
          ...courseStructure,
          // Store certification data for the main save functionality
          _certificationData: {
            certification_uuid: existingCertification.certification_uuid,
            config: {
              certification_name: watchedValues.certification_name,
              certification_description: watchedValues.certification_description,
              certification_type: watchedValues.certification_type,
              certificate_pattern: watchedValues.certificate_pattern,
              certificate_instructor: watchedValues.certificate_instructor,
            },
          },
        };
        dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse });
      }, 300); // 300ms debounce

      setDebounceTimeout(timeout);

      // Cleanup function
      return () => {
        if (timeout) {
          clearTimeout(timeout);
        }
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    watchedValues.certification_name,
    watchedValues.certification_description,
    watchedValues.certification_type,
    watchedValues.certificate_pattern,
    watchedValues.certificate_instructor,
    isLoading,
    hasExistingCertification,
    hasInitialized,
    existingCertification?.certification_uuid,
    dispatchCourse,
    courseStructure?.id,
  ]);

  const onSubmit = (_values: FormValues) => {
    // This is no longer used - saving is handled by the main Save button
  };

  if (isLoading || !courseStructure || (courseStructure.course_uuid && access_token && certifications === undefined)) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex animate-pulse items-center rounded-md bg-slate-100 px-4 py-2 text-sm font-medium text-gray-600">
          <Loader2
            size={16}
            className="mr-2 animate-spin"
          />
          <span>{t('loading')}</span>
        </div>
      </div>
    );
  }

  if (certificationsError) {
    return <div>{t('errorLoadingCertifications')}</div>;
  }

  return (
    <div>
      {courseStructure ? (
        <div>
          <div className="h-6" />
          <div className="mx-4 rounded-xl bg-white px-4 py-4 shadow-xs sm:mx-10">
            {/* Header Section */}
            <div className="mb-3 flex items-center justify-between rounded-md bg-gray-50 px-3 py-3 sm:px-5">
              <div className="flex flex-col -space-y-1">
                <h1 className="text-lg font-bold text-gray-800 sm:text-xl">{t('courseCertification')}</h1>
                <h2 className="text-xs text-gray-500 sm:text-sm">{t('enableCertification')}</h2>
              </div>
              <div className="flex items-center space-x-3">
                <label className="relative inline-flex cursor-pointer items-center">
                  <input
                    type="checkbox"
                    className="peer sr-only"
                    checked={form.watch('enable_certification')}
                    onChange={(e) => handleCertificationToggle(e.target.checked)}
                    disabled={isCreating}
                  />
                  <div className="peer h-6 w-11 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-focus:ring-4 peer-focus:ring-blue-300 peer-focus:outline-none after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-gray-300 after:bg-white after:transition-all after:content-[''] peer-checked:after:translate-x-full peer-checked:after:border-white" />
                </label>
                {isCreating ? (
                  <div className="animate-spin">
                    <Settings size={16} />
                  </div>
                ) : null}
              </div>
            </div>

            {error ? (
              <div className="mb-6 flex items-center justify-center space-x-2 rounded-md bg-red-200 p-4 text-red-950 shadow-xs transition-all">
                <AlertTriangle size={18} />
                <div className="text-sm font-bold">{error}</div>
              </div>
            ) : null}

            {/* Certification Configuration - Only show if enabled and has existing certification */}
            {form.watch('enable_certification') && hasExistingCertification ? (
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
                {/* Form Section */}
                <div className="lg:col-span-3">
                  <Form {...form}>
                    <form
                      onSubmit={form.handleSubmit(onSubmit)}
                      className="space-y-6"
                    >
                      {/* Basic Information Section */}
                      <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-3 py-3 sm:px-5">
                        <h3 className="flex items-center gap-2 text-base font-bold text-gray-800">
                          <FileText size={16} />
                          {t('basicInfo')}
                        </h3>
                        <p className="text-xs text-gray-500 sm:text-sm">{t('basicInfoDesc')}</p>
                      </div>

                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Certification Name */}
                        <FormField
                          control={form.control}
                          name="certification_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('certificationName')}</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  style={{ backgroundColor: 'white' }}
                                  placeholder={t('certificationNamePlaceholder')}
                                />
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />

                        {/* Certification Type */}
                        <FormField
                          control={form.control}
                          name="certification_type"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>{t('certificationType')}</FormLabel>
                              <FormControl>
                                <Select
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <SelectTrigger className="w-full bg-white">
                                    <SelectValue>{t(`certificationTypes.${field.value}`)}</SelectValue>
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="completion">{t('certificationTypes.completion')}</SelectItem>
                                    <SelectItem value="achievement">{t('certificationTypes.achievement')}</SelectItem>
                                    <SelectItem value="assessment">{t('certificationTypes.assessment')}</SelectItem>
                                    <SelectItem value="participation">
                                      {t('certificationTypes.participation')}
                                    </SelectItem>
                                    <SelectItem value="mastery">{t('certificationTypes.mastery')}</SelectItem>
                                    <SelectItem value="professional">{t('certificationTypes.professional')}</SelectItem>
                                    <SelectItem value="continuing">{t('certificationTypes.continuing')}</SelectItem>
                                    <SelectItem value="workshop">{t('certificationTypes.workshop')}</SelectItem>
                                    <SelectItem value="specialization">
                                      {t('certificationTypes.specialization')}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </FormControl>
                              <FormMessage />
                            </FormItem>
                          )}
                        />
                      </div>

                      {/* Certification Description */}
                      <FormField
                        control={form.control}
                        name="certification_description"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('certificationDescription')}</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                style={{ backgroundColor: 'white', height: '120px', minHeight: '120px' }}
                                placeholder={t('certificationDescriptionPlaceholder')}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Certificate Design Section */}
                      <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-3 py-3 sm:px-5">
                        <h3 className="flex items-center gap-2 text-base font-bold text-gray-800">
                          <Award size={16} />
                          {t('certificateDesign')}
                        </h3>
                        <p className="text-xs text-gray-500 sm:text-sm">{t('certificateDesignDesc')}</p>
                      </div>

                      {/* Pattern Selection */}
                      <FormField
                        control={form.control}
                        name="certificate_pattern"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('certificatePattern')}</FormLabel>
                            <FormControl>
                              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                                {[
                                  {
                                    value: 'royal',
                                    name: t('certificatePatterns.royal'),
                                    description: t('certificatePatternDescriptions.royal'),
                                  },
                                  {
                                    value: 'tech',
                                    name: t('certificatePatterns.tech'),
                                    description: t('certificatePatternDescriptions.tech'),
                                  },
                                  {
                                    value: 'nature',
                                    name: t('certificatePatterns.nature'),
                                    description: t('certificatePatternDescriptions.nature'),
                                  },
                                  {
                                    value: 'geometric',
                                    name: t('certificatePatterns.geometric'),
                                    description: t('certificatePatternDescriptions.geometric'),
                                  },
                                  {
                                    value: 'vintage',
                                    name: t('certificatePatterns.vintage'),
                                    description: t('certificatePatternDescriptions.vintage'),
                                  },
                                  {
                                    value: 'waves',
                                    name: t('certificatePatterns.waves'),
                                    description: t('certificatePatternDescriptions.waves'),
                                  },
                                  {
                                    value: 'minimal',
                                    name: t('certificatePatterns.minimal'),
                                    description: t('certificatePatternDescriptions.minimal'),
                                  },
                                  {
                                    value: 'professional',
                                    name: t('certificatePatterns.professional'),
                                    description: t('certificatePatternDescriptions.professional'),
                                  },
                                  {
                                    value: 'academic',
                                    name: t('certificatePatterns.academic'),
                                    description: t('certificatePatternDescriptions.academic'),
                                  },
                                  {
                                    value: 'modern',
                                    name: t('certificatePatterns.modern'),
                                    description: t('certificatePatternDescriptions.modern'),
                                  },
                                ].map((pattern) => (
                                  <div
                                    key={pattern.value}
                                    className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                                      field.value === pattern.value
                                        ? 'border-primary bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                    onClick={() => {
                                      field.onChange(pattern.value);
                                    }}
                                  >
                                    <div className="text-center">
                                      <div className="text-sm font-medium text-gray-900">{pattern.name}</div>
                                      <div className="mt-1 text-xs text-gray-500">{pattern.description}</div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Custom Instructor */}
                      <FormField
                        control={form.control}
                        name="certificate_instructor"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>{t('certificateInstructor')}</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                style={{ backgroundColor: 'white' }}
                                placeholder={t('certificateInstructorPlaceholder')}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </form>
                  </Form>
                </div>

                {/* Preview Section */}
                <div className="lg:col-span-2">
                  <div className="sticky top-6 min-h-[320px] rounded-xl border border-gray-200 bg-white shadow-xs">
                    <div className="mb-3 flex flex-col -space-y-1 rounded-t-xl bg-gray-50 px-3 py-3 sm:px-5">
                      <h3 className="flex items-center gap-2 text-base font-bold text-gray-800">
                        <Award size={16} />
                        {t('previewCertificate')}
                      </h3>
                      <p className="text-xs text-gray-500 sm:text-sm">{t('livePreviewCertificate')}</p>
                    </div>

                    <div className="p-4">
                      <CertificatePreview
                        certificationName={form.watch('certification_name') || ''}
                        certificationDescription={form.watch('certification_description') || ''}
                        certificationType={form.watch('certification_type') || 'completion'}
                        certificatePattern={form.watch('certificate_pattern') || 'professional'}
                        certificateInstructor={form.watch('certificate_instructor')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {/* Disabled State */}
            {!form.watch('enable_certification') && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <Award className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                <h3 className="mb-2 font-medium text-gray-700">{t('noCertificationConfigured')}</h3>
                <p className="mb-4 text-sm text-gray-500">{t('noCertificationDescription')}</p>
                <button
                  type="button"
                  onClick={() => handleCertificationToggle(true)}
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Award size={16} />
                  {isCreating ? t('creatingCertification') : t('enableCertificationButton')}
                </button>
              </div>
            )}

            {/* Creating State - when toggle is on but no certification exists yet */}
            {form.watch('enable_certification') && !hasExistingCertification && isCreating ? (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-8 text-center">
                <div className="mx-auto mb-4 animate-spin">
                  <Settings className="h-16 w-16 text-blue-500" />
                </div>
                <h3 className="mb-2 font-medium text-blue-700">{t('creatingCertification')}</h3>
                <p className="text-sm text-blue-600">{t('creatingCertificationDescription')}</p>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default EditCourseCertification;
