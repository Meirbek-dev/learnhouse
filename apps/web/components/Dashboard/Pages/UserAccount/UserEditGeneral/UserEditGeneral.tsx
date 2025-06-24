'use client';
import {
  ArrowBigUpDash,
  Check,
  FileWarning,
  Info,
  UploadCloud,
  AlertTriangle,
  Briefcase,
  GraduationCap,
  MapPin,
  Building2,
  Globe,
  Laptop2,
  Award,
  BookOpen,
  Link,
  Users,
  Calendar,
  Lightbulb,
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { LocaleSwitcher } from '@components/Utils/LocaleSwitcher';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { updateProfile } from '@services/settings/profile';
import { getUriWithoutOrg } from '@services/config/config';
import { updateUserAvatar } from '@services/users/users';
import UserAvatar from '@components/Objects/UserAvatar';
import { constructAcceptValue } from '@/lib/constants';
import { Textarea } from '@components/ui/textarea';
import { useDebounce } from '@/hooks/useDebounce';
import { getUser } from '@services/users/users';
import { Button } from '@components/ui/button';
import { getUserLocale } from '@/i18n/locale';
import { Label } from '@components/ui/label';
import { Input } from '@components/ui/input';
import type { Locale } from '@/i18n/config';
import { useTranslations } from 'next-intl';
import { signOut } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { Formik, Form } from 'formik';
import * as React from 'react';
import * as Yup from 'yup';

const SUPPORTED_FILES = constructAcceptValue(['image']);

const AVAILABLE_ICONS = [
  { name: 'briefcase', label: 'Briefcase', component: Briefcase },
  { name: 'graduation-cap', label: 'Education', component: GraduationCap },
  { name: 'map-pin', label: 'Location', component: MapPin },
  { name: 'building-2', label: 'Organization', component: Building2 },
  { name: 'speciality', label: 'Speciality', component: Lightbulb },
  { name: 'globe', label: 'Website', component: Globe },
  { name: 'laptop-2', label: 'Tech', component: Laptop2 },
  { name: 'award', label: 'Achievement', component: Award },
  { name: 'book-open', label: 'Book', component: BookOpen },
  { name: 'link', label: 'Link', component: Link },
  { name: 'users', label: 'Community', component: Users },
  { name: 'calendar', label: 'Calendar', component: Calendar },
] as const;

const IconComponent = ({ iconName }: { iconName: string }) => {
  const iconConfig = AVAILABLE_ICONS.find((i) => i.name === iconName);
  if (!iconConfig) return null;
  const IconElement = iconConfig.component;
  return <IconElement className="h-4 w-4" />;
};

interface DetailItem {
  id: string;
  label: string;
  icon: string;
  text: string;
}

interface FormValues {
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  bio: string;
  details: {
    [key: string]: DetailItem;
  };
}

const DETAIL_TEMPLATES = {
  general: [
    { id: 'title', label: 'Title', icon: 'briefcase', text: '' },
    { id: 'affiliation', label: 'Affiliation', icon: 'building-2', text: '' },
    { id: 'location', label: 'Location', icon: 'map-pin', text: '' },
    { id: 'website', label: 'Website', icon: 'globe', text: '' },
    { id: 'linkedin', label: 'LinkedIn', icon: 'link', text: '' },
  ],
  academic: [
    { id: 'institution', label: 'Institution', icon: 'building-2', text: '' },
    { id: 'department', label: 'Department', icon: 'graduation-cap', text: '' },
    { id: 'research', label: 'Research Area', icon: 'book-open', text: '' },
    { id: 'academic-title', label: 'Academic Title', icon: 'award', text: '' },
  ],
  professional: [
    { id: 'company', label: 'Company', icon: 'building-2', text: '' },
    { id: 'industry', label: 'Industry', icon: 'briefcase', text: '' },
    { id: 'expertise', label: 'Expertise', icon: 'laptop-2', text: '' },
    { id: 'community', label: 'Community', icon: 'users', text: '' },
  ],
} as const;

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  Yup.object().shape({
    email: Yup.string()
      .email(t('Form.invalidEmail'))
      .required(t('Form.requiredField', { fieldName: 'Email' })),
    username: Yup.string().required(t('Form.requiredField', { fieldName: 'Username' })),
    first_name: Yup.string().required(t('Form.requiredField', { fieldName: 'First name' })),
    last_name: Yup.string().required(t('Form.requiredField', { fieldName: 'Last name' })),
    bio: Yup.string().max(400, t('Form.maxChars', { count: 400 })),
    details: Yup.object().shape({}),
  });

// Memoized detail card component for better performance
const DetailCard = React.memo(
  ({
    id,
    detail,
    onUpdate,
    onRemove,
    onLabelChange,
  }: {
    id: string;
    detail: DetailItem;
    onUpdate: (id: string, field: keyof DetailItem, value: string) => void;
    onRemove: (id: string) => void;
    onLabelChange: (id: string, newLabel: string) => void;
  }) => {
    // Add local state for label input
    const [localLabel, setLocalLabel] = useState(detail.label);
    const t = useTranslations('DashPage.UserAccountSettings.generalSection');

    // Create a stable callback for label changes
    const stableLabelChangeCallback = useCallback(
      (newLabel: string) => {
        if (newLabel !== detail.label) {
          onLabelChange(id, newLabel);
        }
      },
      [id, onLabelChange, detail.label],
    );

    // Debounce the label change handler
    const debouncedLabelChange = useDebounce(stableLabelChangeCallback, 500);

    // Memoize handlers to prevent unnecessary re-renders
    const handleLabelChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const newLabel = e.target.value;
        setLocalLabel(newLabel);
        debouncedLabelChange(newLabel);
      },
      [debouncedLabelChange],
    );

    const handleIconChange = useCallback(
      (value: string) => {
        onUpdate(id, 'icon', value);
      },
      [id, onUpdate],
    );

    const handleTextChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        onUpdate(id, 'text', e.target.value);
      },
      [id, onUpdate],
    );

    const handleRemove = useCallback(() => {
      onRemove(id);
    }, [id, onRemove]);

    // Update local label when prop changes
    useEffect(() => {
      setLocalLabel(detail.label);
    }, [detail.label]);

    return (
      <div className="space-y-2 rounded-lg border bg-white p-4 shadow-sm">
        <div className="mb-3 flex items-center justify-between">
          <Input
            value={localLabel}
            onChange={handleLabelChange}
            placeholder={t('detailLabelPlaceholder')}
            className="max-w-[200px]"
          />
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-red-500 hover:text-red-700"
            onClick={handleRemove}
          >
            {t('detailRemove')}
          </Button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>{t('detailIconLabel')}</Label>
            <Select
              value={detail.icon}
              onValueChange={handleIconChange}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t('detailSelectIconPlaceholder')}>
                  {detail.icon && (
                    <div className="flex items-center gap-2">
                      <IconComponent iconName={detail.icon} />
                      <span>{AVAILABLE_ICONS.find((i) => i.name === detail.icon)?.label}</span>
                    </div>
                  )}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {AVAILABLE_ICONS.map((icon) => (
                  <SelectItem
                    key={icon.name}
                    value={icon.name}
                  >
                    <div className="flex items-center gap-2">
                      <icon.component className="h-4 w-4" />
                      <span>{icon.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>{t('detailTextLabel')}</Label>
            <Input
              value={detail.text}
              onChange={handleTextChange}
              placeholder={t('detailTextPlaceholder')}
            />
          </div>
        </div>
      </div>
    );
  },
);

DetailCard.displayName = 'DetailCard';

interface UserEditFormProps {
  values: FormValues;
  setFieldValue: (field: string, value: any) => void;
  handleChange: (e: React.ChangeEvent<any>) => void;
  errors: any;
  touched: any;
  isSubmitting: boolean;
  profilePicture: {
    error: string | undefined;
    success: string;
    isLoading: boolean;
    localAvatar: File | null;
    handleFileChange: (event: any) => Promise<void>;
  };
}

// Form component to handle the details section
const UserEditForm = ({
  values,
  setFieldValue,
  handleChange,
  errors,
  touched,
  isSubmitting,
  profilePicture,
}: UserEditFormProps) => {
  const t = useTranslations('DashPage.UserAccountSettings.generalSection');
  // Memoize template handlers
  const _templateHandlers = useMemo(() => {
    const handlers: { [key: string]: () => void } = {};
    Object.entries(DETAIL_TEMPLATES).forEach(([key, template]) => {
      handlers[key] = () => {
        const currentIds = new Set(Object.keys(values.details));
        const newDetails = { ...values.details };

        template.forEach((item) => {
          if (!currentIds.has(item.id)) {
            newDetails[item.id] = { ...item };
          }
        });

        setFieldValue('details', newDetails);
      };
    });
    return handlers;
  }, [values.details, setFieldValue]);

  // Memoize detail handlers
  const _detailHandlers = useMemo(
    () => ({
      handleDetailUpdate: (id: string, field: keyof DetailItem, value: string) => {
        const newDetails = { ...values.details };
        const existingDetail = newDetails[id];
        newDetails[id] = {
          id: existingDetail?.id || id,
          label: existingDetail?.label || '',
          icon: existingDetail?.icon || '',
          text: existingDetail?.text || '',
          ...existingDetail,
          [field]: value,
        };
        setFieldValue('details', newDetails);
      },
      handleDetailRemove: (id: string) => {
        const newDetails = { ...values.details };
        delete newDetails[id];
        setFieldValue('details', newDetails);
      },
    }),
    [values.details, setFieldValue],
  );

  return (
    <Form>
      <div className="flex flex-col gap-0">
        <div className="mx-3 my-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
          <h1 className="text-xl font-bold text-gray-800">{t('title')}</h1>
          <h2 className="text-md text-gray-500">{t('description')}</h2>
        </div>

        <div className="mx-5 my-5 mt-0 flex flex-col gap-8 lg:flex-row">
          {/* Profile Information Section */}
          <div className="min-w-0 flex-1 space-y-4">
            <div>
              <Label htmlFor="email">{t('email')}</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={values.email}
                onChange={handleChange}
                placeholder={t('emailPlaceholder')}
              />
              {touched.email && errors.email && <p className="mt-1 text-sm text-red-500">{errors.email}</p>}
              <div className="mt-2 flex items-center space-x-2 rounded-md bg-amber-50 p-2 text-amber-600">
                <AlertTriangle size={16} />
                <span className="text-sm">{t('emailChangeWarning')}</span>
              </div>
            </div>

            <div>
              <Label htmlFor="username">{t('username')}</Label>
              <Input
                id="username"
                name="username"
                value={values.username}
                onChange={handleChange}
                placeholder={t('usernamePlaceholder')}
              />
              {touched.username && errors.username && <p className="mt-1 text-sm text-red-500">{errors.username}</p>}
            </div>

            <div>
              <Label htmlFor="first_name">{t('firstName')}</Label>
              <Input
                id="first_name"
                name="first_name"
                value={values.first_name}
                onChange={handleChange}
                placeholder={t('firstNamePlaceholder')}
              />
              {touched.first_name && errors.first_name && (
                <p className="mt-1 text-sm text-red-500">{errors.first_name}</p>
              )}
            </div>

            <div>
              <Label htmlFor="last_name">{t('lastName')}</Label>
              <Input
                id="last_name"
                name="last_name"
                value={values.last_name}
                onChange={handleChange}
                placeholder={t('lastNamePlaceholder')}
              />
              {touched.last_name && errors.last_name && <p className="mt-1 text-sm text-red-500">{errors.last_name}</p>}
            </div>

            <div>
              <Label htmlFor="bio">
                {t('bio')}
                <span className="text-sm text-gray-500">
                  ({400 - (values.bio?.length || 0)} {t('charactersLeft')})
                </span>
              </Label>
              <Textarea
                id="bio"
                name="bio"
                value={values.bio}
                onChange={handleChange}
                placeholder={t('bioPlaceholder')}
                className="min-h-[150px]"
                maxLength={400}
              />
              {touched.bio && errors.bio && <p className="mt-1 text-sm text-red-500">{errors.bio}</p>}
            </div>
            <div>
              <Label className="mb-1.5">{t('language')}</Label>
              <LocaleSwitcher />
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <Label>{t('additionalDetails')}</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-red-500 hover:bg-red-50 hover:text-red-700"
                      onClick={() => {
                        setFieldValue('details', {});
                      }}
                    >
                      {t('clearAll')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const newDetails = { ...values.details };
                        const id = `detail-${Date.now()}`;
                        newDetails[id] = {
                          id,
                          label: t('newDetail'),
                          icon: '',
                          text: '',
                        };
                        setFieldValue('details', newDetails);
                      }}
                    >
                      {t('addDetail')}
                    </Button>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {Object.entries(DETAIL_TEMPLATES).map(([key, template]) => (
                    <Button
                      key={key}
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="flex items-center gap-2"
                      onClick={() => {
                        const currentIds = new Set(Object.keys(values.details));
                        const newDetails = { ...values.details };

                        template.forEach((item) => {
                          if (!currentIds.has(item.id)) {
                            newDetails[item.id] = { ...item };
                          }
                        });

                        setFieldValue('details', newDetails);
                      }}
                    >
                      {key === 'general' && <Briefcase className="h-4 w-4" />}
                      {key === 'academic' && <GraduationCap className="h-4 w-4" />}
                      {key === 'professional' && <Building2 className="h-4 w-4" />}
                      {t(`add${key.charAt(0).toUpperCase() + key.slice(1)}Info`)}
                    </Button>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                {Object.entries(values.details).map(([id, detail]) => (
                  <DetailCard
                    key={id}
                    id={id}
                    detail={detail}
                    onUpdate={(id, field, value) => {
                      const newDetails = { ...values.details };
                      const existingDetail = newDetails[id];
                      newDetails[id] = {
                        id: existingDetail?.id || id,
                        label: existingDetail?.label || '',
                        icon: existingDetail?.icon || '',
                        text: existingDetail?.text || '',
                        ...existingDetail,
                        [field]: value,
                      };
                      setFieldValue('details', newDetails);
                    }}
                    onRemove={(id) => {
                      const newDetails = { ...values.details };
                      delete newDetails[id];
                      setFieldValue('details', newDetails);
                    }}
                    onLabelChange={(id, newLabel) => {
                      const newDetails = { ...values.details };
                      const existingDetail = newDetails[id];
                      newDetails[id] = {
                        id: existingDetail?.id || id,
                        label: newLabel,
                        icon: existingDetail?.icon || '',
                        text: existingDetail?.text || '',
                        ...existingDetail,
                      };
                      setFieldValue('details', newDetails);
                    }}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Profile Picture Section */}
          <div className="w-full lg:w-80">
            <div className="nice-shadow h-full rounded-lg bg-gray-50/50 p-6">
              <div className="flex flex-col items-center space-y-6">
                <Label className="font-bold">{t('profilePicture')}</Label>
                {profilePicture.error && (
                  <div className="flex items-center rounded-md bg-red-200 px-4 py-2 text-sm text-red-950">
                    <FileWarning
                      size={16}
                      className="mr-2"
                    />
                    <span className="font-semibold first-letter:uppercase">
                      {t('avatarError', { error: profilePicture.error })}
                    </span>
                  </div>
                )}
                {profilePicture.success && (
                  <div className="flex items-center rounded-md bg-green-200 px-4 py-2 text-sm text-green-950">
                    <Check
                      size={16}
                      className="mr-2"
                    />
                    <span className="font-semibold first-letter:uppercase">{t('avatarSuccess')}</span>
                  </div>
                )}
                {profilePicture.localAvatar ? (
                  <UserAvatar
                    border="border-8"
                    width={120}
                    avatar_url={URL.createObjectURL(profilePicture.localAvatar)}
                  />
                ) : (
                  <UserAvatar
                    border="border-8"
                    width={120}
                  />
                )}
                {profilePicture.isLoading ? (
                  <div className="text-gray flex animate-pulse items-center rounded-md bg-green-200 px-4 py-2 text-sm font-bold antialiased">
                    <ArrowBigUpDash
                      size={16}
                      className="mr-2"
                    />
                    <span>{t('uploadingAvatar')}</span>
                  </div>
                ) : (
                  <>
                    <input
                      type="file"
                      id="fileInput"
                      accept={SUPPORTED_FILES}
                      className="hidden"
                      onChange={profilePicture.handleFileChange}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => document.getElementById('fileInput')?.click()}
                      className="w-full"
                    >
                      <UploadCloud
                        size={16}
                        className="mr-2"
                      />
                      {t('changeAvatar')}
                    </Button>
                  </>
                )}
                <div className="flex items-center text-xs text-gray-500">
                  <Info
                    size={13}
                    className="mr-2"
                  />
                  <p>{t('recommendedSize')}</p>
                </div>
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
            {isSubmitting ? t('saving') : t('saveChanges')}
          </Button>
        </div>
      </div>
    </Form>
  );
};

function UserEditGeneral() {
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [localAvatar, setLocalAvatar] = React.useState<File | null>(null);
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | undefined>();
  const [success, setSuccess] = React.useState<string>('');
  const [userData, setUserData] = useState<any>(null);
  const [currentLocale, setCurrentLocale] = useState<Locale | null>(null);
  const [initialLoading, setInitialLoading] = useState<boolean>(true);
  const t = useTranslations('DashPage.Notifications');
  const validationSchema = React.useMemo(() => createValidationSchema(t), [t]);

  // Add a handler to update the state when locale changes
  const _handleLocaleChange = useCallback((newLocale: Locale) => {
    setCurrentLocale(newLocale);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (session?.data?.user?.id && access_token) {
        try {
          const [userDataResponse, localeResponse] = await Promise.all([
            getUser(session.data.user.id, access_token),
            getUserLocale(),
          ]);
          setUserData(userDataResponse);
          setCurrentLocale(localeResponse as Locale);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          console.error('Error fetching initial data:', errorMessage, error);
          setError('Failed to load user data.');
        } finally {
          setInitialLoading(false);
        }
      } else {
        setInitialLoading(false);
      }
    };

    fetchData();
  }, [session?.data?.user?.id, access_token]);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLocalAvatar(file);
    setIsLoading(true);
    setError(undefined);
    setSuccess('');
    try {
      const res = await updateUserAvatar(session.data.user_uuid, file, access_token);
      // await new Promise((r) => setTimeout(r, 1000));
      if (res.success === false) {
        setError(res.HTTPmessage || t('avatarError'));
      } else {
        setSuccess(t('avatarSuccess'));
      }
    } catch (error) {
      console.error('Avatar upload error:', error);
      setError(t('avatarError'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleEmailChange = async (newEmail: string) => {
    toast.success(t('profileUpdateSuccess'), {
      duration: 4000,
    });

    toast(
      (t: any) => (
        <div className="flex items-center gap-2">
          <span>
            {t('promptLogoutOnEmailChange', {
              newEmail,
            })}
          </span>
        </div>
      ),
      {
        duration: 4000,
        icon: '📧',
      },
    );

    // Wait for 4 seconds before signing out
    await new Promise((resolve) => setTimeout(resolve, 4000));
    signOut({ redirect: true, callbackUrl: getUriWithoutOrg('/') });
  };

  if (initialLoading || !userData || !currentLocale) {
    return (
      <div className="nice-shadow mx-0 rounded-xl bg-white p-8 sm:mx-10">
        <div className="flex items-center justify-center">
          <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-gray-900" />
        </div>
      </div>
    );
  }

  return (
    <div className="nice-shadow mx-0 rounded-xl bg-white sm:mx-10">
      <Formik<FormValues>
        enableReinitialize
        initialValues={{
          username: userData.username || '',
          first_name: userData.first_name || '',
          last_name: userData.last_name || '',
          email: userData.email || '',
          bio: userData.bio || '',
          details: userData.details || {},
        }}
        validationSchema={validationSchema}
        onSubmit={async (values, { setSubmitting }) => {
          const isEmailChanged = values.email !== userData.email;
          const loadingToast = toast.loading(t('updating'));
          setSubmitting(true);

          try {
            await updateProfile(values, userData.id, access_token);
            const updatedUserData = await getUser(userData.id, access_token);
            setUserData(updatedUserData);

            toast.dismiss(loadingToast);
            if (isEmailChanged) {
              await handleEmailChange(values.email);
            } else {
              toast.success(t('profileUpdateSuccess'));
            }
          } catch (error) {
            console.error('Profile update error:', error);
            toast.error(t('profileUpdateError'), {
              id: loadingToast,
            });
          } finally {
            setSubmitting(false);
          }
        }}
      >
        {(formikProps) => (
          <UserEditForm
            {...formikProps}
            profilePicture={{
              error,
              success,
              isLoading,
              localAvatar,
              handleFileChange,
            }}
          />
        )}
      </Formik>
    </div>
  );
}

export default UserEditGeneral;
