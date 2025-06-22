'use client';
import { SiX, SiFacebook, SiInstagram, SiYoutube, SiTiktok } from '@icons-pack/react-simple-icons';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { revalidateTags } from '@services/utils/ts/requests';
import { updateOrganization } from '@services/settings/org';
import { useOrg } from '@components/Contexts/OrgContext';
import { getAPIUrl } from '@services/config/config';
import { Plus, X as XIcon } from 'lucide-react';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { toast } from 'react-hot-toast';
import { Form, Formik } from 'formik';
import { mutate } from 'swr';

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
  const initialValues: OrganizationValues = {
    socials: org?.socials || {},
    links: org?.links || {},
  };

  const updateOrg = async (values: OrganizationValues) => {
    const loadingToast = toast.loading(t('updatingOrg'));
    try {
      await updateOrganization(org.id, values, access_token);
      await revalidateTags(['organizations'], org.slug);

      mutate(`${getAPIUrl()}orgs/slug/${org.slug}`);
      toast.success(t('orgUpdatedSuccess'), { id: loadingToast });
    } catch (_err) {
      toast.error(t('orgUpdateFailed'), { id: loadingToast });
    }
  };

  return (
    <div className="nice-shadow mx-0 rounded-xl bg-white sm:mx-10">
      <Formik
        enableReinitialize
        initialValues={initialValues}
        onSubmit={(values, { setSubmitting }) => {
          setTimeout(() => {
            setSubmitting(false);
            updateOrg(values);
          }, 400);
        }}
      >
        {({ isSubmitting, values, handleChange, setFieldValue }) => (
          <Form>
            <div className="flex flex-col gap-0">
              <div className="mx-3 my-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
                <h1 className="text-xl font-bold text-gray-800">{t('title')}</h1>
                <h2 className="text-md text-gray-500">{t('description')}</h2>
              </div>

              <div className="mx-5 my-5 mt-0 flex flex-col lg:flex-row lg:space-x-8">
                <div className="w-full space-y-6">
                  <div>
                    <Label className="text-lg font-semibold">{t('socialLinksTitle')}</Label>
                    <div className="nice-shadow mt-2 space-y-3 rounded-lg bg-gray-50/50 p-4">
                      <div className="grid gap-3">
                        <div className="flex items-center space-x-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#E4405F]/10">
                            <SiInstagram
                              size={16}
                              color="#E4405F"
                            />
                          </div>
                          <Input
                            id="socials.instagram"
                            name="socials.instagram"
                            value={values.socials.instagram || ''}
                            onChange={handleChange}
                            placeholder={t('Form.instagramPlaceholder')}
                            className="h-9 bg-white"
                          />
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#1877F2]/10">
                            <SiFacebook
                              size={16}
                              color="#1877F2"
                            />
                          </div>
                          <Input
                            id="socials.facebook"
                            name="socials.facebook"
                            value={values.socials.facebook || ''}
                            onChange={handleChange}
                            placeholder={t('Form.facebookPlaceholder')}
                            className="h-9 bg-white"
                          />
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#FF0000]/10">
                            <SiYoutube
                              size={16}
                              color="#FF0000"
                            />
                          </div>
                          <Input
                            id="socials.youtube"
                            name="socials.youtube"
                            value={values.socials.youtube || ''}
                            onChange={handleChange}
                            placeholder={t('Form.youtubePlaceholder')}
                            className="h-9 bg-white"
                          />
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#82878a]/10">
                            <SiTiktok size={16} />
                          </div>
                          <Input
                            id="socials.tiktok"
                            name="socials.tiktok"
                            value={values.socials.tiktok || ''}
                            onChange={handleChange}
                            placeholder={t('Form.tiktokPlaceholder')}
                            className="h-9 bg-white"
                          />
                        </div>

                        <div className="flex items-center space-x-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[#707577]/10">
                            <SiX size={16} />
                          </div>
                          <Input
                            id="socials.twitter"
                            name="socials.twitter"
                            value={values.socials.twitter || ''}
                            onChange={handleChange}
                            placeholder={t('Form.xPlaceholder')}
                            className="h-9 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="w-full space-y-6">
                  <div>
                    <Label className="text-lg font-semibold">{t('customLinksTitle')}</Label>
                    <div className="nice-shadow mt-2 space-y-3 rounded-lg bg-gray-50/50 p-4">
                      {Object.entries(values.links).map(([linkKey, linkValue], index) => (
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
                              onChange={(e) => {
                                const newLinks = { ...values.links };
                                delete newLinks[linkKey];
                                newLinks[e.target.value] = linkValue;
                                setFieldValue('links', newLinks);
                              }}
                            />
                            <Input
                              placeholder={t('Form.customLinkUrlPlaceholder')}
                              value={linkValue}
                              className="h-9 flex-1 bg-white"
                              onChange={(e) => {
                                const newLinks = { ...values.links };
                                newLinks[linkKey] = e.target.value;
                                setFieldValue('links', newLinks);
                              }}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() => {
                                const newLinks = { ...values.links };
                                delete newLinks[linkKey];
                                setFieldValue('links', newLinks);
                              }}
                            >
                              <XIcon className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}

                      {Object.keys(values.links).length < 3 && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="mt-2"
                          onClick={() => {
                            const newLinks = { ...values.links };
                            newLinks[`${t('Form.newCustomLinkDefaultLabel')} ${Object.keys(newLinks).length + 1}`] = '';
                            setFieldValue('links', newLinks);
                          }}
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
}
