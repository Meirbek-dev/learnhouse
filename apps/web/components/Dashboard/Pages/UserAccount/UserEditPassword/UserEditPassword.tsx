'use client';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import PasswordInput from '@components/ui/custom/password-input';
import { updatePassword } from '@services/settings/password';
import { getUriWithoutOrg } from '@services/config/config';
import { zodResolver } from '@hookform/resolvers/zod';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo } from 'react';
import { useForm } from 'react-hook-form';
import { signOut } from 'next-auth/react';
import { toast } from 'react-hot-toast';
import { z } from 'zod';

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  z.object({
    old_password: z.string().min(
      1,
      t('Form.requiredField', {
        fieldName: t('currentPasswordLabel'),
      }),
    ),
    new_password: z
      .string()
      .min(
        1,
        t('Form.requiredField', {
          fieldName: t('newPasswordLabel'),
        }),
      )
      .min(8, t('Form.minChars', { count: 8 })),
  });

type PasswordFormData = z.infer<ReturnType<typeof createValidationSchema>>;

const UserEditPassword = () => {
  const session = useLHSession();
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.Notifications');
  const tPassword = useTranslations('DashPage.UserAccountSettings.UserAccount.EditPassword');
  const validationSchema = useMemo(() => createValidationSchema(t), [t]);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<PasswordFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      old_password: '',
      new_password: '',
    },
  });

  const onSubmit = async (values: PasswordFormData) => {
    const loadingToast = toast.loading(t('updating'));
    try {
      const user_id = session?.data?.user?.id;
      if (!(user_id && access_token)) {
        toast.error(t('passwordUpdateError'), { id: loadingToast });
        return;
      }

      const response = await updatePassword(user_id, values, access_token);

      if (response.success) {
        toast.dismiss(loadingToast);

        // Show success message and notify about logout
        toast.success(t('passwordUpdateSuccess'), {
          duration: 4000,
        });
        toast(
          (t: any) => (
            <div className="flex items-center gap-2">
              <span>{t('promptLogoutOnPasswordChange')}</span>
            </div>
          ),
          {
            duration: 4000,
            icon: '🔑',
          },
        );

        // Wait for 4 seconds before signing out
        await new Promise((resolve) => setTimeout(resolve, 4000));
        signOut({ redirect: true, callbackUrl: getUriWithoutOrg('/') });
      } else {
        toast.error(t('passwordUpdateError'), {
          id: loadingToast,
        });
      }
    } catch (error: any) {
      toast.error(t('passwordUpdateError'), { id: loadingToast });
      console.error('Password update error:', error);
    }
  };

  useEffect(() => {}, [session]);

  return (
    <div className="soft-shadow mx-0 rounded-xl bg-white sm:mx-10">
      <div className="flex flex-col">
        <div className="mx-3 my-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
          <h1 className="text-xl font-bold text-gray-800">{tPassword('title')}</h1>
          <h2 className="text-md text-gray-500">{tPassword('description')}</h2>
        </div>

        <div className="px-8 py-6">
          <form
            onSubmit={handleSubmit(onSubmit)}
            className="mx-auto w-full max-w-2xl space-y-6"
          >
            <div>
              <Label htmlFor="old_password">{tPassword('currentPasswordLabel')}</Label>
              <PasswordInput
                id="old_password"
                {...register('old_password')}
                className="mt-1"
              />
              {errors.old_password ? <p className="mt-1 text-sm text-red-500">{errors.old_password.message}</p> : null}
            </div>

            <div>
              <Label htmlFor="new_password">{tPassword('newPasswordLabel')}</Label>
              <PasswordInput
                id="new_password"
                {...register('new_password')}
                className="mt-1"
              />
              {errors.new_password ? <p className="mt-1 text-sm text-red-500">{errors.new_password.message}</p> : null}
            </div>

            <div className="flex items-center space-x-2 rounded-md bg-amber-50 p-3 text-amber-600">
              <AlertTriangle size={16} />
              <span className="text-sm">{tPassword('logoutWarning')}</span>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isSubmitting}
              >
                {isSubmitting ? tPassword('updatingButton') : tPassword('updateButton')}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserEditPassword;
