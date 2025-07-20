import {
  CustomSelect,
  CustomSelectContent,
  CustomSelectItem,
  CustomSelectTrigger,
  CustomSelectValue,
} from '../EditCourseGeneral/CustomSelect';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { createCertification, deleteCertification } from '@services/courses/certifications';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import { AlertTriangle, Award, FileText, Settings } from 'lucide-react';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { zodResolver } from '@hookform/resolvers/zod';
import CertificatePreview from './CertificatePreview';
import { Textarea } from '@/components/ui/textarea';
import { getAPIUrl } from '@services/config/config';
import React, { useEffect, useState } from 'react';
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import useSWR from 'swr';
import { z } from 'zod';

interface EditCourseCertificationProps {
  orgslug: string;
  course_uuid?: string;
}

// Zod schema for form validation
const formSchema = z
  .object({
    enable_certification: z.boolean(),
    certification_name: z.string().max(100, 'Must be 100 characters or less'),
    certification_description: z.string().max(500, 'Must be 500 characters or less'),
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
      message: 'Certification name and description are required when certification is enabled',
    },
  );

type FormValues = z.infer<typeof formSchema>;

function EditCourseCertification(props: EditCourseCertificationProps) {
  const [error, setError] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const course = useCourse();
  const dispatchCourse = useCourseDispatch() as any;
  const { isLoading, courseStructure } = course as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;

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
  const hasExistingCertification = !!existingCertification;

  // Create initial values object
  const getInitialValues = (): FormValues => {
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

    return {
      enable_certification: hasExistingCertification,
      certification_name: config.certification_name || courseStructure?.name || '',
      certification_description: config.certification_description || courseStructure?.description || '',
      certification_type: (config.certification_type as FormValues['certification_type']) || 'completion',
      certificate_pattern: (config.certificate_pattern as FormValues['certificate_pattern']) || 'professional',
      certificate_instructor: config.certificate_instructor || getInstructorName(),
    };
  };

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: getInitialValues(),
  });

  // Handle enabling/disabling certification
  const handleCertificationToggle = async (enabled: boolean) => {
    if (enabled && !hasExistingCertification) {
      // Create new certification
      setIsCreating(true);
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
          toast.success('Certification created successfully');
          mutateCertifications();
          form.setValue('enable_certification', true);
        } else {
          throw new Error('Failed to create certification');
        }
      } catch {
        setError('Failed to create certification.');
        toast.error('Failed to create certification');
        form.setValue('enable_certification', false);
      } finally {
        setIsCreating(false);
      }
    } else if (!enabled && hasExistingCertification) {
      // Delete existing certification
      try {
        const result = await deleteCertification(existingCertification.certification_uuid, access_token);

        // deleteCertification uses errorHandling which returns JSON directly on success
        if (result) {
          toast.success('Certification removed successfully');
          mutateCertifications();
          form.setValue('enable_certification', false);
        } else {
          throw new Error('Failed to delete certification');
        }
      } catch {
        setError('Failed to remove certification.');
        toast.error('Failed to remove certification');
        form.setValue('enable_certification', true);
      }
    } else {
      form.setValue('enable_certification', enabled);
    }
  };

  // Reset form when certifications data changes
  useEffect(() => {
    if (certifications && !isLoading) {
      const newValues = getInitialValues();
      form.reset(newValues);
    }
  }, [certifications, isLoading, form]);

  // Watch form values and update course state
  const watchedValues = form.watch();
  useEffect(() => {
    if (!isLoading && hasExistingCertification) {
      const hasChanges = Object.keys(watchedValues).some((key) => {
        const currentValue = watchedValues[key as keyof FormValues];
        const initialValue = getInitialValues()[key as keyof FormValues];
        return currentValue !== initialValue;
      });

      if (hasChanges) {
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
      }
    }
  }, [watchedValues, isLoading, hasExistingCertification, existingCertification, dispatchCourse, courseStructure]);

  const onSubmit = (values: FormValues) => {
    // This is no longer used - saving is handled by the main Save button
  };

  if (isLoading || !courseStructure || (courseStructure.course_uuid && access_token && certifications === undefined)) {
    return <div>Loading...</div>;
  }

  if (certificationsError) {
    return <div>Error loading certifications</div>;
  }

  return (
    <div>
      {courseStructure && (
        <div>
          <div className="h-6" />
          <div className="mx-4 rounded-xl bg-white px-4 py-4 shadow-xs sm:mx-10">
            {/* Header Section */}
            <div className="mb-3 flex items-center justify-between rounded-md bg-gray-50 px-3 py-3 sm:px-5">
              <div className="flex flex-col -space-y-1">
                <h1 className="text-lg font-bold text-gray-800 sm:text-xl">Course Certification</h1>
                <h2 className="text-xs text-gray-500 sm:text-sm">
                  Enable and configure certificates for students who complete this course
                </h2>
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
                {isCreating && (
                  <div className="animate-spin">
                    <Settings size={16} />
                  </div>
                )}
              </div>
            </div>

            {error && (
              <div className="mb-6 flex items-center justify-center space-x-2 rounded-md bg-red-200 p-4 text-red-950 shadow-xs transition-all">
                <AlertTriangle size={18} />
                <div className="text-sm font-bold">{error}</div>
              </div>
            )}

            {/* Certification Configuration - Only show if enabled and has existing certification */}
            {form.watch('enable_certification') && hasExistingCertification && (
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
                        <h3 className="text-md flex items-center gap-2 font-bold text-gray-800">
                          <FileText size={16} />
                          Basic Information
                        </h3>
                        <p className="text-xs text-gray-500 sm:text-sm">
                          Configure the basic details of your certification
                        </p>
                      </div>

                      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                        {/* Certification Name */}
                        <FormField
                          control={form.control}
                          name="certification_name"
                          render={({ field }) => (
                            <FormItem>
                              <FormLabel>Certification Name</FormLabel>
                              <FormControl>
                                <Input
                                  {...field}
                                  style={{ backgroundColor: 'white' }}
                                  placeholder="e.g., Advanced JavaScript Certification"
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
                              <FormLabel>Certification Type</FormLabel>
                              <FormControl>
                                <CustomSelect
                                  value={field.value}
                                  onValueChange={field.onChange}
                                >
                                  <CustomSelectTrigger className="w-full bg-white">
                                    <CustomSelectValue>
                                      {field.value === 'completion'
                                        ? 'Course Completion'
                                        : field.value === 'achievement'
                                          ? 'Achievement Based'
                                          : field.value === 'assessment'
                                            ? 'Assessment Based'
                                            : field.value === 'participation'
                                              ? 'Participation'
                                              : field.value === 'mastery'
                                                ? 'Skill Mastery'
                                                : field.value === 'professional'
                                                  ? 'Professional Development'
                                                  : field.value === 'continuing'
                                                    ? 'Continuing Education'
                                                    : field.value === 'workshop'
                                                      ? 'Workshop Attendance'
                                                      : field.value === 'specialization'
                                                        ? 'Specialization'
                                                        : 'Course Completion'}
                                    </CustomSelectValue>
                                  </CustomSelectTrigger>
                                  <CustomSelectContent>
                                    <CustomSelectItem value="completion">Course Completion</CustomSelectItem>
                                    <CustomSelectItem value="achievement">Achievement Based</CustomSelectItem>
                                    <CustomSelectItem value="assessment">Assessment Based</CustomSelectItem>
                                    <CustomSelectItem value="participation">Participation</CustomSelectItem>
                                    <CustomSelectItem value="mastery">Skill Mastery</CustomSelectItem>
                                    <CustomSelectItem value="professional">Professional Development</CustomSelectItem>
                                    <CustomSelectItem value="continuing">Continuing Education</CustomSelectItem>
                                    <CustomSelectItem value="workshop">Workshop Attendance</CustomSelectItem>
                                    <CustomSelectItem value="specialization">Specialization</CustomSelectItem>
                                  </CustomSelectContent>
                                </CustomSelect>
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
                            <FormLabel>Certification Description</FormLabel>
                            <FormControl>
                              <Textarea
                                {...field}
                                style={{ backgroundColor: 'white', height: '120px', minHeight: '120px' }}
                                placeholder="Describe what this certification represents and its value..."
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      {/* Certificate Design Section */}
                      <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-3 py-3 sm:px-5">
                        <h3 className="text-md flex items-center gap-2 font-bold text-gray-800">
                          <Award size={16} />
                          Certificate Design
                        </h3>
                        <p className="text-xs text-gray-500 sm:text-sm">
                          Choose a decorative pattern for your certificate
                        </p>
                      </div>

                      {/* Pattern Selection */}
                      <FormField
                        control={form.control}
                        name="certificate_pattern"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Certificate Pattern</FormLabel>
                            <FormControl>
                              <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
                                {[
                                  { value: 'royal', name: 'Royal', description: 'Ornate with crown motifs' },
                                  { value: 'tech', name: 'Tech', description: 'Circuit-inspired patterns' },
                                  { value: 'nature', name: 'Nature', description: 'Organic leaf patterns' },
                                  { value: 'geometric', name: 'Geometric', description: 'Abstract shapes & lines' },
                                  { value: 'vintage', name: 'Vintage', description: 'Art deco styling' },
                                  { value: 'waves', name: 'Waves', description: 'Flowing water patterns' },
                                  { value: 'minimal', name: 'Minimal', description: 'Clean and simple' },
                                  { value: 'professional', name: 'Professional', description: 'Business-ready design' },
                                  { value: 'academic', name: 'Academic', description: 'Traditional university style' },
                                  { value: 'modern', name: 'Modern', description: 'Contemporary clean lines' },
                                ].map((pattern) => (
                                  <div
                                    key={pattern.value}
                                    className={`cursor-pointer rounded-lg border-2 p-3 transition-all ${
                                      field.value === pattern.value
                                        ? 'border-blue-500 bg-blue-50'
                                        : 'border-gray-200 hover:border-gray-300'
                                    }`}
                                    onClick={() => field.onChange(pattern.value)}
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
                            <FormLabel>Instructor Name (Optional)</FormLabel>
                            <FormControl>
                              <Input
                                {...field}
                                style={{ backgroundColor: 'white' }}
                                placeholder="e.g., Dr. Jane Smith"
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
                      <h3 className="text-md flex items-center gap-2 font-bold text-gray-800">
                        <Award size={16} />
                        Certificate Preview
                      </h3>
                      <p className="text-xs text-gray-500 sm:text-sm">Live preview of your certificate</p>
                    </div>

                    <div className="p-4">
                      <CertificatePreview
                        certificationName={form.watch('certification_name')}
                        certificationDescription={form.watch('certification_description')}
                        certificationType={form.watch('certification_type')}
                        certificatePattern={form.watch('certificate_pattern')}
                        certificateInstructor={form.watch('certificate_instructor')}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Disabled State */}
            {!form.watch('enable_certification') && (
              <div className="rounded-lg border border-gray-200 bg-gray-50 p-8 text-center">
                <Award className="mx-auto mb-4 h-16 w-16 text-gray-300" />
                <h3 className="mb-2 font-medium text-gray-700">No Certification Configured</h3>
                <p className="mb-4 text-sm text-gray-500">
                  Enable certification to provide students with certificates upon course completion.
                </p>
                <button
                  type="button"
                  onClick={() => handleCertificationToggle(true)}
                  disabled={isCreating}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm font-medium text-blue-600 hover:bg-blue-100 focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Award size={16} />
                  {isCreating ? 'Creating...' : 'Enable Certification'}
                </button>
              </div>
            )}

            {/* Creating State - when toggle is on but no certification exists yet */}
            {form.watch('enable_certification') && !hasExistingCertification && isCreating && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-8 text-center">
                <div className="mx-auto mb-4 animate-spin">
                  <Settings className="h-16 w-16 text-blue-500" />
                </div>
                <h3 className="mb-2 font-medium text-blue-700">Creating Certification...</h3>
                <p className="text-sm text-blue-600">Please wait while we set up your course certification.</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default EditCourseCertification;
