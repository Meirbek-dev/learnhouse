'use client';
import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
  Textarea,
} from '@components/Objects/StyledElements/Form/Form';
import { useCourse, useCourseDispatch } from '@components/Contexts/CourseContext';
import FormTagInput from '@components/Objects/StyledElements/Form/TagInput';
import { useEffect, useState, useCallback } from 'react';
import LearningItemsList from './LearningItemsList';
import ThumbnailUpdate from './ThumbnailUpdate';
import * as Form from '@radix-ui/react-form';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useFormik } from 'formik';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';

type EditCourseStructureProps = {
  orgslug: string;
  course_uuid?: string;
};

interface MyCourseFormValues {
  name: string;
  description: string;
  about: string;
  learnings: string;
  tags: string;
  public: boolean;
  thumbnail_type: 'image' | 'video' | 'both';
}

const validate = (values: MyCourseFormValues, t: (key: string, values?: any) => string) => {
  const errors: Partial<Record<keyof MyCourseFormValues, string>> = {};

  if (!values.name) {
    errors.name = t('errors.required', { fieldName: t('name.label') });
  } else if (values.name.length > 100) {
    errors.name = t('errors.maxLength', { count: 100 });
  }

  if (!values.description) {
    errors.description = t('errors.required', {
      fieldName: t('description.label'),
    });
  } else if (values.description.length > 1000) {
    errors.description = t('errors.maxLength', { count: 1000 });
  }

  if (!values.learnings) {
    errors.learnings = t('errors.required', {
      fieldName: t('learnings.label'),
    });
  } else {
    try {
      const learningItems = JSON.parse(values.learnings);
      if (!Array.isArray(learningItems)) {
        errors.learnings = t('errors.invalidFormat');
      } else if (learningItems.length === 0) {
        errors.learnings = t('errors.atLeastOneLearningItem');
      } else {
        const hasEmptyText = learningItems.some((item: any) => !item.text || item.text.trim() === '');
        if (hasEmptyText) {
          errors.learnings = t('errors.allLearningItemsMustHaveText');
        }
      }
    } catch {
      errors.learnings = t('errors.invalidJsonFormat');
    }
  }

  return errors;
};

// Initialize learnings as a JSON array if it's not already
const initializeLearnings = (learnings: any) => {
  if (!learnings) {
    return JSON.stringify([{ id: 'initial-learning-item', text: '', emoji: '📝' }]);
  }

  try {
    // Check if it's already a valid JSON array
    const parsed = JSON.parse(learnings);
    if (Array.isArray(parsed)) {
      return learnings;
    }

    // If it's a string but not a JSON array, convert it to a learning item
    if (typeof learnings === 'string') {
      return JSON.stringify([
        {
          id: 'initial-learning-item',
          text: learnings,
          emoji: '📝',
        },
      ]);
    }

    // Default empty array
    return JSON.stringify([{ id: 'init-learn-item', text: '', emoji: '📝' }]);
  } catch (e) {
    // If it's not valid JSON, convert the string to a learning item
    if (typeof learnings === 'string') {
      return JSON.stringify([
        {
          id: 'init-learn-item-from-string',
          text: learnings,
          emoji: '📝',
        },
      ]);
    }

    // Default empty array
    return JSON.stringify([{ id: 'init-new-learn-item', text: '', emoji: '📝' }]);
  }
};
function EditCourseGeneral(props: EditCourseStructureProps) {
  const [error, setError] = useState('');
  const course = useCourse();
  const dispatchCourse = useCourseDispatch() as any;
  const { isLoading, courseStructure } = course as any;
  const t = useTranslations('CourseEdit.General');
  const thumbnailType = courseStructure?.thumbnail_type || 'image';

  const formik = useFormik<MyCourseFormValues>({
    initialValues: {
      name: courseStructure?.name || '',
      description: courseStructure?.description || '',
      about: courseStructure?.about || '',
      learnings: initializeLearnings(courseStructure?.learnings || ''),
      tags: courseStructure?.tags || '',
      public: courseStructure?.public,
      thumbnail_type: thumbnailType,
    },
    validate: (values) => validate(values, t),
    onSubmit: async (values) => {
      try {
        dispatchCourse({ type: 'setIsSaved' });
      } catch (e) {
        setError(t('errors.saveFailed'));
      }
    },
    enableReinitialize: true,
  }) as any;

  // Reset form when courseStructure changes
  useEffect(() => {
    if (courseStructure && !isLoading) {
      const newValues = {
        name: courseStructure?.name || '',
        description: courseStructure?.description || '',
        about: courseStructure?.about || '',
        learnings: initializeLearnings(courseStructure?.learnings || ''),
        tags: courseStructure?.tags || '',
        public: courseStructure?.public,
        thumbnail_type: thumbnailType,
      };
      formik.resetForm({ values: newValues });
    }
  }, [courseStructure, isLoading]);

  useEffect(() => {
    if (!isLoading) {
      const formikValues = formik.values as any;
      const initialValues = formik.initialValues as any;
      const valuesChanged = Object.keys(formikValues).some((key) => formikValues[key] !== initialValues[key]);

      if (valuesChanged) {
        dispatchCourse({ type: 'setIsNotSaved' });
        const updatedCourse = {
          ...courseStructure,
          ...formikValues,
        };
        dispatchCourse({ type: 'setCourseStructure', payload: updatedCourse });
      }
    }
  }, [formik.values, isLoading]);

  if (isLoading || !courseStructure) {
    return <div>{t('loading')}</div>;
  }

  return (
    <div className="h-full">
      <div className="h-6" />
      <div className="px-10 pb-10">
        <div className="shadow-xs rounded-xl bg-white">
          <FormLayout
            onSubmit={formik.handleSubmit}
            className="p-6"
          >
            {error && (
              <div className="shadow-xs mb-6 flex items-center justify-center space-x-2 rounded-md bg-red-200 p-4 text-red-950 transition-all">
                <AlertTriangle size={18} />
                <div className="text-sm font-bold">{error}</div>
              </div>
            )}

            <div className="space-y-6">
              <FormField name="name">
                <FormLabelAndMessage
                  label={t('name.label')}
                  message={formik.errors.name}
                />
                <Form.Control asChild>
                  <Input
                    style={{ backgroundColor: 'white' }}
                    onChange={formik.handleChange}
                    value={formik.values.name}
                    type="text"
                    required
                  />
                </Form.Control>
              </FormField>

              <FormField name="description">
                <FormLabelAndMessage
                  label={t('description.label')}
                  message={formik.errors.description}
                />
                <Form.Control asChild>
                  <Input
                    style={{ backgroundColor: 'white' }}
                    onChange={formik.handleChange}
                    value={formik.values.description}
                    type="text"
                    required
                  />
                </Form.Control>
              </FormField>

              <FormField name="about">
                <FormLabelAndMessage
                  label={t('about.label')}
                  message={formik.errors.about}
                />
                <Form.Control asChild>
                  <Textarea
                    style={{ backgroundColor: 'white', height: '200px', minHeight: '200px' }}
                    onChange={formik.handleChange}
                    value={formik.values.about}
                    required
                  />
                </Form.Control>
              </FormField>

              <FormField name="learnings">
                <FormLabelAndMessage
                  label={t('learnings.label')}
                  message={formik.errors.learnings}
                />
                <Form.Control asChild>
                  <LearningItemsList
                    value={formik.values.learnings}
                    onChange={(value) => formik.setFieldValue('learnings', value)}
                    error={formik.errors.learnings}
                  />
                </Form.Control>
              </FormField>

              <FormField name="tags">
                <FormLabelAndMessage
                  label={t('tags.label')}
                  message={formik.errors.tags}
                />
                <Form.Control asChild>
                  <FormTagInput
                    placeholder={t('tags.placeholder')}
                    onChange={(value) => formik.setFieldValue('tags', value)}
                    value={formik.values.tags}
                  />
                </Form.Control>
              </FormField>

              <FormField name="thumbnail_type">
                <FormLabelAndMessage label={t('thumbnailType')} />
                <Form.Control asChild>
                  <Select
                    value={formik.values.thumbnail_type}
                    onValueChange={(value) => {
                      if (!value) return;
                      formik.setFieldValue('thumbnail_type', value);
                    }}
                  >
                    <SelectTrigger className="w-full bg-white">
                      <SelectValue>
                        {formik.values.thumbnail_type === 'image'
                          ? t('image')
                          : formik.values.thumbnail_type === 'video'
                            ? t('video')
                            : formik.values.thumbnail_type === 'both'
                              ? t('both')
                              : t('image')}
                      </SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="image">{t('image')}</SelectItem>
                      <SelectItem value="video">{t('video')}</SelectItem>
                      <SelectItem value="both">{t('both')}</SelectItem>
                    </SelectContent>
                  </Select>
                </Form.Control>
              </FormField>

              <FormField name="thumbnail">
                <FormLabelAndMessage label={t('thumbnail.label')} />
                <Form.Control asChild>
                  <ThumbnailUpdate thumbnailType={formik.values.thumbnail_type} />
                </Form.Control>
              </FormField>
            </div>
          </FormLayout>
        </div>
      </div>
    </div>
  );
}

export default EditCourseGeneral;
