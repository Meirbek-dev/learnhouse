'use client';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { revalidateTags } from '@services/utils/ts/requests';
import { updateOrganization } from '@services/settings/org';
import { useOrg } from '@components/Contexts/OrgContext';
import { getAPIUrl } from '@services/config/config';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { Form, Formik } from 'formik';
import type { FC } from 'react';
import { mutate } from 'swr';
import * as Yup from 'yup';

const ORG_LABELS = [
  { value: 'languages', label: '🌐 Languages' },
  { value: 'business', label: '💰 Business' },
  { value: 'ecommerce', label: '🛍️ E-commerce' },
  { value: 'gaming', label: '🎮 Gaming' },
  { value: 'music', label: '🎸 Music' },
  { value: 'sports', label: '⚽️ Sports' },
  { value: 'cars', label: '🚗 Cars' },
  { value: 'sales_marketing', label: '🚀 Sales & Marketing' },
  { value: 'tech', label: '💻 Tech' },
  { value: 'photo_video', label: '📸 Photo & Video' },
  { value: 'pets', label: '🐾 Pets' },
  { value: 'personal_development', label: '📚 Personal Development' },
  { value: 'real_estate', label: '🏠 Real Estate' },
  { value: 'beauty_fashion', label: '👠 Beauty & Fashion' },
  { value: 'travel', label: '✈️ Travel' },
  { value: 'productivity', label: '⏳ Productivity' },
  { value: 'health_fitness', label: '🍎 Health & Fitness' },
  { value: 'finance', label: '📈 Finance' },
  { value: 'arts_crafts', label: '🎨 Arts & Crafts' },
  { value: 'education', label: '📚 Education' },
  { value: 'stem', label: '🔬 STEM' },
  { value: 'humanities', label: '📖 Humanities' },
  { value: 'professional_skills', label: '💼 Professional Skills' },
  { value: 'digital_skills', label: '🖥️ Digital Skills' },
  { value: 'creative_arts', label: '🎨 Creative Arts' },
  { value: 'social_sciences', label: '🌍 Social Sciences' },
  { value: 'test_prep', label: '✍️ Test Prep' },
  { value: 'vocational', label: '🔧 Vocational Training' },
  { value: 'early_education', label: '🎯 Early Education' },
] as const;

const getOrgLabels = (t: Function) =>
  ORG_LABELS.map((item) => {
    try {
      // Try to get the translated version
      const translatedLabel = t(`OrgLabels.${item.value}` as any);
      // If translation exists and is not the key itself, use it
      if (translatedLabel && !translatedLabel.startsWith('OrgLabels.')) {
        return {
          value: item.value,
          label: translatedLabel,
        };
      }
      // Fallback to hardcoded label
      return {
        value: item.value,
        label: item.label,
      };
    } catch {
      // If translation fails, use hardcoded label
      return {
        value: item.value,
        label: item.label,
      };
    }
  });

const validationSchema = Yup.object().shape({
  name: Yup.string()
    .required('DashPage.OrgSettings.General.Form.nameRequired')
    .max(60, 'DashPage.OrgSettings.General.Form.nameMax'),
  description: Yup.string()
    .required('DashPage.OrgSettings.General.Form.descriptionRequired')
    .max(100, 'DashPage.OrgSettings.General.Form.descriptionMax'),
  about: Yup.string().optional().max(400, 'DashPage.OrgSettings.General.Form.aboutMax'),
  label: Yup.string().required('DashPage.OrgSettings.General.Form.labelRequired'),
  explore: Yup.boolean(),
});

interface OrganizationValues {
  name: string;
  description: string;
  about: string;
  label: string;
  explore: boolean;
}

const OrgEditGeneral: FC = () => {
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;
  const t = useTranslations('DashPage.OrgSettings.General');

  const initialValues: OrganizationValues = {
    name: org?.name,
    description: org?.description || '',
    about: org?.about || '',
    label: org?.label || '',
    explore: org?.explore ?? false,
  };

  const updateOrg = async (values: OrganizationValues) => {
    const loadingToast = toast.loading(t('updatingOrg'));
    try {
      await updateOrganization(org.id, values, access_token);
      await revalidateTags(['organizations'], org.slug);
      mutate(`${getAPIUrl()}orgs/slug/${org.slug}`);
      toast.success(t('orgUpdatedSuccess'), { id: loadingToast });
    } catch {
      toast.error(t('orgUpdateFailed'), { id: loadingToast });
    }
  };

  return (
    <div className="nice-shadow mx-0 rounded-xl bg-white sm:mx-10">
      <Formik
        enableReinitialize
        initialValues={initialValues}
        validationSchema={validationSchema}
        onSubmit={(values, { setSubmitting }) => {
          setTimeout(() => {
            setSubmitting(false);
            updateOrg(values);
          }, 400);
        }}
      >
        {({ isSubmitting, values, handleChange, errors, touched, setFieldValue }) => (
          <Form>
            <div className="flex flex-col gap-0">
              <div className="mx-3 my-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
                <h1 className="text-xl font-bold text-gray-800">{t('title')}</h1>
                <h2 className="text-md text-gray-500">{t('description')}</h2>
              </div>

              <div className="mx-5 my-5 mt-0 flex flex-col lg:flex-row lg:space-x-8">
                <div className="w-full space-y-6">
                  <div className="space-y-4">
                    <div>
                      <Label htmlFor="name">
                        {t('Form.nameLabel')}
                        <span className="text-sm text-gray-500">
                          ({60 - (values.name?.length || 0)} {t('Form.charsLeft')}
                        </span>
                      </Label>
                      <Input
                        id="name"
                        name="name"
                        value={values.name}
                        onChange={handleChange}
                        placeholder={t('Form.namePlaceholder')}
                        maxLength={60}
                      />
                      {touched.name && errors.name && <p className="mt-1 text-sm text-red-500">{errors.name}</p>}
                    </div>

                    <div>
                      <Label htmlFor="description">
                        {t('Form.descriptionLabel')}
                        <span className="text-sm text-gray-500">
                          ({100 - (values.description?.length || 0)} {t('Form.charsLeft')}
                        </span>
                      </Label>
                      <Input
                        id="description"
                        name="description"
                        value={values.description}
                        onChange={handleChange}
                        placeholder={t('Form.descriptionPlaceholder')}
                        maxLength={100}
                      />
                      {touched.description && errors.description && (
                        <p className="mt-1 text-sm text-red-500">{errors.description}</p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="label">{t('Form.labelLabel')}</Label>
                      <Select
                        value={values.label || ''}
                        onValueChange={(value) => setFieldValue('label', value)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder={t('Form.labelPlaceholder')} />
                        </SelectTrigger>
                        <SelectContent>
                          {getOrgLabels(t).map((type) => (
                            <SelectItem
                              key={type.value}
                              value={type.value}
                            >
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {touched.label && errors.label && <p className="mt-1 text-sm text-red-500">{errors.label}</p>}
                    </div>

                    <div>
                      <Label htmlFor="about">
                        {t('Form.aboutLabel')}
                        <span className="text-sm text-gray-500">
                          ({400 - (values.about?.length || 0)} {t('Form.charsLeft')}
                        </span>
                      </Label>
                      <Textarea
                        id="about"
                        name="about"
                        value={values.about}
                        onChange={handleChange}
                        placeholder={t('Form.aboutPlaceholder')}
                        className="min-h-[250px]"
                        maxLength={400}
                      />
                      {touched.about && errors.about && <p className="mt-1 text-sm text-red-500">{errors.about}</p>}
                    </div>
                  </div>
                </div>
              </div>
              <div className="mx-5 mt-0 mb-5 flex flex-row-reverse">
                <Button
                  type="submit"
                  disabled={isSubmitting}
                  className="bg-black text-white hover:bg-black/90"
                >
                  {isSubmitting ? t('Form.savingButton') : t('Form.saveButton')}
                </Button>
              </div>
            </div>
          </Form>
        )}
      </Formik>
    </div>
  );
};

export default OrgEditGeneral;
