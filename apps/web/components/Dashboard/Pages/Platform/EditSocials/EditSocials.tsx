'use client';

import { useForm, useStore } from '@tanstack/react-form';
import { SiFacebook, SiInstagram, SiTiktok, SiX, SiYoutube } from '@icons-pack/react-simple-icons';
import { usePlatform } from '@/components/Contexts/PlatformContext';
import { updatePlatform } from '@/services/settings/platform';
import { revalidateTags } from '@services/utils/ts/requests';
import { Field, FieldLabel } from '@components/ui/field';
import { getAPIUrl } from '@services/config/config';
import { Plus, X as XIcon } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { mutate } from 'swr';

interface SocialMediaData {
  socials: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
  };
  links: Record<string, string>;
}

export default function EditSocials() {
  const platform = usePlatform() as any;
  const t = useTranslations('DashPage.PlatformSettings.Socials');

  const socialDefaults = {
    twitter: '',
    facebook: '',
    instagram: '',
    linkedin: '',
    youtube: '',
    tiktok: '',
  };

  const defaultValues = {
    socials: {
      ...socialDefaults,
      ...platform?.socials,
    },
    links: platform?.links || {},
  };

  const form = useForm({
    defaultValues,
    onSubmit: async ({ value }) => {
      await updatePlatformSettings(value);
    },
  });

  const isSubmitting = useStore(form.store, (state) => state.isSubmitting);

  const updatePlatformSettings = async (values: SocialMediaData) => {
    const loadingToast = toast.loading(t('updatingPlatform'));
    try {
      await updatePlatform(values);
      await revalidateTags(['platform']);
      mutate(`${getAPIUrl()}platform`);
      toast.success(t('platformUpdatedSuccess'), { id: loadingToast });
    } catch {
      toast.error(t('platformUpdateFailed'), { id: loadingToast });
    }
  };

  const handleLinkChange = (oldKey: string, newKey: string, value: string) => {
    const currentLinks = form.state.values.links;
    const newLinks = { ...currentLinks };
    if (oldKey !== newKey) {
      delete newLinks[oldKey];
    }
    newLinks[newKey] = value;
    form.setFieldValue('links', newLinks);
  };

  const removeLink = (key: string) => {
    const currentLinks = form.state.values.links;
    const newLinks = { ...currentLinks };
    delete newLinks[key];
    form.setFieldValue('links', newLinks);
  };

  const addNewLink = () => {
    const currentLinks = form.state.values.links;
    const newLinks = { ...currentLinks };
    newLinks[`${t('Form.newCustomLinkDefaultLabel')} ${Object.keys(newLinks).length + 1}`] = '';
    form.setFieldValue('links', newLinks);
  };

  const linksEntries = Object.entries((form.state.values.links || {}) as Record<string, string>);

  const socialFields = [
    {
      name: 'socials.instagram' as const,
      placeholder: t('Form.instagramPlaceholder'),
      icon: (
        <SiInstagram
          size={16}
          color="#E4405F"
        />
      ),
      bgColor: 'bg-[#E4405F]/10',
    },
    {
      name: 'socials.facebook' as const,
      placeholder: t('Form.facebookPlaceholder'),
      icon: (
        <SiFacebook
          size={16}
          color="#1877F2"
        />
      ),
      bgColor: 'bg-[#1877F2]/10',
    },
    {
      name: 'socials.youtube' as const,
      placeholder: t('Form.youtubePlaceholder'),
      icon: (
        <SiYoutube
          size={16}
          color="#FF0000"
        />
      ),
      bgColor: 'bg-[#FF0000]/10',
    },
    {
      name: 'socials.tiktok' as const,
      placeholder: t('Form.tiktokPlaceholder'),
      icon: <SiTiktok size={16} />,
      bgColor: 'bg-[#82878a]/10',
    },
    {
      name: 'socials.twitter' as const,
      placeholder: t('Form.xPlaceholder'),
      icon: <SiX size={16} />,
      bgColor: 'bg-[#707577]/10',
    },
  ];

  return (
    <div className="soft-shadow border-border bg-card text-card-foreground mx-0 rounded-xl border shadow-sm sm:mx-10">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
      >
        <div className="flex flex-col gap-0">
          <div className="bg-muted mx-3 my-3 flex flex-col gap-1 rounded-md px-5 py-3">
            <h1 className="text-foreground text-xl font-bold">{t('title')}</h1>
            <h2 className="text-muted-foreground text-base">{t('description')}</h2>
          </div>

          <div className="mx-5 my-5 mt-0 flex flex-col lg:flex-row lg:space-x-8">
            <div className="w-full space-y-6">
              <div>
                <FieldLabel className="text-lg font-semibold">{t('socialLinksTitle')}</FieldLabel>
                <div className="soft-shadow border-border bg-muted/50 mt-2 space-y-3 rounded-lg border p-4">
                  <div className="grid gap-3">
                    {socialFields.map((field) => (
                      <form.Field
                        key={field.name}
                        name={field.name}
                        children={(socialField) => (
                          <Field>
                            <div className="flex items-center gap-3">
                              <div className={`flex h-8 w-8 items-center justify-center rounded-md ${field.bgColor}`}>
                                {field.icon}
                              </div>
                              <Input
                                placeholder={field.placeholder}
                                className="bg-background h-9"
                                value={String(socialField.state.value ?? '')}
                                onBlur={socialField.handleBlur}
                                onChange={(event) => socialField.handleChange(event.target.value)}
                              />
                            </div>
                          </Field>
                        )}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div className="w-full space-y-6">
              <div>
                <FieldLabel className="text-lg font-semibold">{t('customLinksTitle')}</FieldLabel>
                <div className="soft-shadow border-border bg-muted/50 mt-2 space-y-3 rounded-lg border p-4">
                  {linksEntries.map(([linkKey, linkValue], index) => (
                    <div
                      key={index}
                      className="flex items-center gap-3"
                    >
                      <div className="bg-muted text-muted-foreground flex h-8 w-8 items-center justify-center rounded-md text-xs font-medium">
                        {index + 1}
                      </div>
                      <div className="flex flex-1 gap-2">
                        <Input
                          placeholder={t('Form.customLinkLabelPlaceholder')}
                          value={linkKey}
                          className="bg-background h-9 w-1/3"
                          onChange={(e) => {
                            handleLinkChange(linkKey, e.target.value, linkValue);
                          }}
                        />
                        <Input
                          placeholder={t('Form.customLinkUrlPlaceholder')}
                          value={linkValue}
                          className="bg-background h-9 flex-1"
                          onChange={(e) => {
                            handleLinkChange(linkKey, linkKey, e.target.value);
                          }}
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            removeLink(linkKey);
                          }}
                        >
                          <XIcon className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}

                  {linksEntries.length < 3 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={addNewLink}
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      {t('Form.addCustomLinkButton')}
                    </Button>
                  )}

                  <p className="text-muted-foreground mt-2 text-xs">{t('Form.customLinkInfo', { count: 3 })}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="mx-5 mt-3 mb-5 flex flex-row-reverse">
            <Button
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? t('Form.savingButton') : t('Form.saveButton')}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
