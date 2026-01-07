'use client';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectPositioner,
  SelectTrigger,
  SelectValue,
} from '@components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { revalidateTags } from '@services/utils/ts/requests';
import { updateOrganization } from '@services/settings/org';
import { useOrg } from '@components/Contexts/OrgContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { getAPIUrl } from '@services/config/config';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { useTransition } from 'react';
import type { FC } from 'react';
import { toast } from 'sonner';
import { mutate } from 'swr';
import * as z from 'zod';

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

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  z.object({
    name: z.string().min(1, t('Form.nameRequired')).max(60, t('Form.nameMax')),
    description: z.string().min(1, t('Form.descriptionRequired')).max(100, t('Form.descriptionMax')),
    about: z.string().max(400, t('Form.aboutMax')).optional().or(z.literal('')),
    label: z.string().min(1, t('Form.labelRequired')),
    explore: z.boolean(),
  });

interface OrganizationValues {
  name: string;
  description: string;
  about?: string;
  label: string;
  explore: boolean;
}

const OrgEditGeneral: FC = () => {
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;
  const t = useTranslations('DashPage.OrgSettings.General');
  const validationSchema = createValidationSchema(t);

  const form = useForm<OrganizationValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: org?.name || '',
      description: org?.description || '',
      about: org?.about || '',
      label: org?.label || 'education',
      explore: org?.explore ?? false,
    },
  });
  const [isPending, startTransition] = useTransition();

  const updateOrg = async (values: OrganizationValues) => {
    const loadingToast = toast.loading(t('updatingOrg'));
    try {
      startTransition(() => {
        void updateOrganization(org.id, values, access_token)
          .then(async () => {
            await revalidateTags(['organizations'], org.slug);
            mutate(`${getAPIUrl()}orgs/slug/${org.slug}`);
            toast.success(t('orgUpdatedSuccess'), { id: loadingToast });
          })
          .catch(() => {
            toast.error(t('orgUpdateFailed'), { id: loadingToast });
          });
      });
    } catch {
      toast.error(t('orgUpdateFailed'), { id: loadingToast });
    }
  };

  return (
    <div className="soft-shadow mx-0 rounded-xl bg-white sm:mx-10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(updateOrg)}>
          <div className="flex flex-col gap-0">
            <div className="mx-3 my-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
              <h1 className="text-xl font-bold text-gray-800">{t('title')}</h1>
              <h2 className="text-base text-gray-500">{t('description')}</h2>
            </div>

            <div className="mx-5 my-5 mt-0 flex flex-col lg:flex-row lg:space-x-8">
              <div className="w-full space-y-6">
                <div className="space-y-4">
                  <FormField
                    control={form.control}
                    name="name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('Form.nameLabel')}
                          <span className="text-sm text-gray-500">
                            ({60 - (field.value?.length || 0)} {t('Form.charsLeft')})
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('Form.namePlaceholder')}
                            maxLength={60}
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
                        <FormLabel>
                          {t('Form.descriptionLabel')}
                          <span className="text-sm text-gray-500">
                            ({100 - (field.value?.length || 0)} {t('Form.charsLeft')})
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Input
                            placeholder={t('Form.descriptionPlaceholder')}
                            maxLength={100}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="label"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('Form.labelLabel')}</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          value={field.value}
                          items={getOrgLabels(t)}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder={t('Form.labelPlaceholder')} />
                            </SelectTrigger>
                          </FormControl>

                          <SelectPositioner>
                            <SelectContent>
                              <SelectGroup>
                                {getOrgLabels(t).map((item) => (
                                  <SelectItem
                                    key={item.value}
                                    value={item.value}
                                  >
                                    {item.label}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            </SelectContent>
                          </SelectPositioner>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="about"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>
                          {t('Form.aboutLabel')}
                          <span className="text-sm text-gray-500">
                            ({400 - (field.value?.length || 0)} {t('Form.charsLeft')})
                          </span>
                        </FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder={t('Form.aboutPlaceholder')}
                            className="min-h-[250px]"
                            maxLength={400}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
            </div>
            <div className="mx-5 mt-0 mb-5 flex flex-row-reverse">
              <Button
                type="submit"
                disabled={form.formState.isSubmitting || isPending}
              >
                {form.formState.isSubmitting || isPending ? t('Form.savingButton') : t('Form.saveButton')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
};

export default OrgEditGeneral;
