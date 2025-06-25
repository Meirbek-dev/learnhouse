'use client';
import { SiFacebook, SiInstagram, SiTiktok, SiX, SiYoutube } from '@icons-pack/react-simple-icons';
import { Plus, X as XIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { mutate } from 'swr';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { Button } from '@components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { Input } from '@components/ui/input';
import { getAPIUrl } from '@services/config/config';
import { updateOrganization } from '@services/settings/org';
import { revalidateTags } from '@services/utils/ts/requests';

interface OrganizationValues {
  socials: {
    twitter?: string;
    facebook?: string;
    instagram?: string;
    linkedin?: string;
    youtube?: string;
    tiktok?: string;
  };
  links: {
    [key: string]: string;
  };
}

export default function OrgEditSocials() {
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const org = useOrg() as any;
  const t = useTranslations('DashPage.OrgSettings.Socials');

  const form = useForm<OrganizationValues>({
    defaultValues: {
      socials: org?.socials || {},
      links: org?.links || {},
    },
  });

  const socials = form.watch('socials');
  const links = form.watch('links');

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

  const handleSocialChange = (field: keyof OrganizationValues['socials'], value: string) => {
    form.setValue(`socials.${field}`, value);
  };

  const handleLinkChange = (oldKey: string, newKey: string, value: string) => {
    const currentLinks = form.getValues('links');
    const newLinks = { ...currentLinks };
    if (oldKey !== newKey) {
      delete newLinks[oldKey];
    }
    newLinks[newKey] = value;
    form.setValue('links', newLinks);
  };

  const removeLink = (key: string) => {
    const currentLinks = form.getValues('links');
    const newLinks = { ...currentLinks };
    delete newLinks[key];
    form.setValue('links', newLinks);
  };

  const addNewLink = () => {
    const currentLinks = form.getValues('links');
    const newLinks = { ...currentLinks };
    newLinks[`${t('Form.newCustomLinkDefaultLabel')} ${Object.keys(newLinks).length + 1}`] = '';
    form.setValue('links', newLinks);
  };

  return (
    <div className="nice-shadow mx-0 rounded-xl bg-white sm:mx-10">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(updateOrg)}>
          <div className="flex flex-col gap-0">
            <div className="mx-3 my-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
              <h1 className="text-xl font-bold text-gray-800">{t('title')}</h1>
              <h2 className="text-md text-gray-500">{t('description')}</h2>
            </div>

            <div className="mx-5 my-5 mt-0 flex flex-col lg:flex-row lg:space-x-8">
              <div className="w-full space-y-6">
                <div>
                  <FormLabel className="text-lg font-semibold">{t('socialLinksTitle')}</FormLabel>
                  <div className="nice-shadow mt-2 space-y-3 rounded-lg bg-gray-50/50 p-4">
                    <div className="grid gap-3">
                      <FormField
                        control={form.control}
                        name="socials.instagram"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center space-x-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#E4405F]/10">
                                <SiInstagram
                                  size={16}
                                  color="#E4405F"
                                />
                              </div>
                              <FormControl>
                                <Input
                                  placeholder={t('Form.instagramPlaceholder')}
                                  className="h-9 bg-white"
                                  {...field}
                                />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="socials.facebook"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center space-x-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1877F2]/10">
                                <SiFacebook
                                  size={16}
                                  color="#1877F2"
                                />
                              </div>
                              <FormControl>
                                <Input
                                  placeholder={t('Form.facebookPlaceholder')}
                                  className="h-9 bg-white"
                                  {...field}
                                />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="socials.youtube"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center space-x-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#FF0000]/10">
                                <SiYoutube
                                  size={16}
                                  color="#FF0000"
                                />
                              </div>
                              <FormControl>
                                <Input
                                  placeholder={t('Form.youtubePlaceholder')}
                                  className="h-9 bg-white"
                                  {...field}
                                />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="socials.tiktok"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center space-x-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#82878a]/10">
                                <SiTiktok size={16} />
                              </div>
                              <FormControl>
                                <Input
                                  placeholder={t('Form.tiktokPlaceholder')}
                                  className="h-9 bg-white"
                                  {...field}
                                />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="socials.twitter"
                        render={({ field }) => (
                          <FormItem>
                            <div className="flex items-center space-x-3">
                              <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#707577]/10">
                                <SiX size={16} />
                              </div>
                              <FormControl>
                                <Input
                                  placeholder={t('Form.xPlaceholder')}
                                  className="h-9 bg-white"
                                  {...field}
                                />
                              </FormControl>
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="w-full space-y-6">
                <div>
                  <FormLabel className="text-lg font-semibold">{t('customLinksTitle')}</FormLabel>
                  <div className="nice-shadow mt-2 space-y-3 rounded-lg bg-gray-50/50 p-4">
                    {Object.entries(links).map(([linkKey, linkValue], index) => (
                      <div
                        key={index}
                        className="flex items-center gap-3"
                      >
                        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gray-200/50 text-xs font-medium text-gray-600">
                          {index + 1}
                        </div>
                        <div className="flex flex-1 gap-2">
                          <Input
                            placeholder={t('Form.customLinkLabelPlaceholder')}
                            value={linkKey}
                            className="h-9 w-1/3 bg-white"
                            onChange={(e) => handleLinkChange(linkKey, e.target.value, linkValue)}
                          />
                          <Input
                            placeholder={t('Form.customLinkUrlPlaceholder')}
                            value={linkValue}
                            className="h-9 flex-1 bg-white"
                            onChange={(e) => handleLinkChange(linkKey, linkKey, e.target.value)}
                          />
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => removeLink(linkKey)}
                          >
                            <XIcon className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    {Object.keys(links).length < 3 && (
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

                    <p className="mt-2 text-xs text-gray-500">{t('Form.customLinkInfo', { count: 3 })}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mx-5 mb-5 mt-3 flex flex-row-reverse">
              <Button
                type="submit"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? t('Form.savingButton') : t('Form.saveButton')}
              </Button>
            </div>
          </div>
        </form>
      </Form>
    </div>
  );
}
