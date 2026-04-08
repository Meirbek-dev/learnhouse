'use client';

import { updatePassword } from '@/lib/users/client';
import { useForm } from '@tanstack/react-form';
import { logout } from '@services/auth/auth';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import PasswordInput from '@components/ui/custom/password-input';
import { getAbsoluteUrl } from '@services/config/config';
import { FieldError } from '@components/ui/field';
import { toFieldErrors } from '@/lib/tanstack-form';
import { Button } from '@components/ui/button';
import { Label } from '@components/ui/label';
import { AlertTriangle } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import * as v from 'valibot';

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  v.object({
    old_password: v.pipe(
      v.string(),
      v.minLength(
        1,
        t('Form.requiredField', {
          fieldName: t('currentPasswordLabel'),
        }),
      ),
    ),
    new_password: v.pipe(
      v.string(),
      v.minLength(
        1,
        t('Form.requiredField', {
          fieldName: t('newPasswordLabel'),
        }),
      ),
      v.minLength(8, t('Form.minChars', { count: 8 })),
    ),
  });

type PasswordFormData = v.InferOutput<ReturnType<typeof createValidationSchema>>;

const UserEditPassword = () => {
  const viewer = useCurrentUser();
  const t = useTranslations('DashPage.Notifications');
  const tPassword = useTranslations('DashPage.UserAccountSettings.UserAccount.EditPassword');
  const validationSchema = createValidationSchema(t);

  const form = useForm({
    defaultValues: {
      old_password: '',
      new_password: '',
    },
    validators: {
      onChange: validationSchema,
      onSubmit: validationSchema,
    },
    onSubmit: async ({ value }) => {
      const loadingToast = toast.loading(t('updating'));
      try {
        const user_id = viewer?.id;
        if (!user_id) {
          toast.error(t('passwordUpdateError'), { id: loadingToast });
          return;
        }

        const response = await updatePassword(user_id, value);

        if (response.success) {
          toast.dismiss(loadingToast);

          toast.success(t('passwordUpdateSuccess'), {
            duration: 4000,
          });
          toast(t('promptLogoutOnPasswordChange'), {
            duration: 4000,
            icon: '🔑',
          });

          setTimeout(() => {
            void logout({ redirectTo: getAbsoluteUrl('/') });
          }, 4000);
        } else {
          toast.error(t('passwordUpdateError'), {
            id: loadingToast,
          });
        }
      } catch (error: any) {
        toast.error(t('passwordUpdateError'), { id: loadingToast });
        console.error('Password update error:', error);
      }
    },
  });

  return (
    <div className="soft-shadow border-border bg-card text-card-foreground mx-0 rounded-xl border shadow-sm sm:mx-10">
      <div className="flex flex-col">
        <div className="bg-muted mx-3 my-3 flex flex-col gap-1 rounded-md px-5 py-3">
          <h1 className="text-foreground text-xl font-bold">{tPassword('title')}</h1>
          <h2 className="text-muted-foreground text-base">{tPassword('description')}</h2>
        </div>

        <div className="px-8 py-6">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              event.stopPropagation();
              void form.handleSubmit();
            }}
            className="mx-auto w-full max-w-2xl space-y-6"
          >
            <form.Field name="old_password">
              {(field) => (
                <div>
                  <Label htmlFor={field.name}>{tPassword('currentPasswordLabel')}</Label>
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="mt-1"
                  />
                  <FieldError
                    className="mt-1"
                    errors={toFieldErrors(field.state.meta.errors)}
                  />
                </div>
              )}
            </form.Field>

            <form.Field name="new_password">
              {(field) => (
                <div>
                  <Label htmlFor={field.name}>{tPassword('newPasswordLabel')}</Label>
                  <PasswordInput
                    id={field.name}
                    name={field.name}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(event.target.value)}
                    className="mt-1"
                  />
                  <FieldError
                    className="mt-1"
                    errors={toFieldErrors(field.state.meta.errors)}
                  />
                </div>
              )}
            </form.Field>

            <div className="flex items-center gap-2 rounded-md border border-amber-500/20 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-400">
              <AlertTriangle size={16} />
              <span className="text-sm">{tPassword('logoutWarning')}</span>
            </div>

            <div className="flex justify-end pt-2">
              <form.Subscribe
                selector={(state) => [state.canSubmit, state.isSubmitting]}
                children={([canSubmit, isSubmitting]) => (
                  <Button
                    type="submit"
                    disabled={!canSubmit || isSubmitting}
                  >
                    {isSubmitting ? tPassword('updatingButton') : tPassword('updateButton')}
                  </Button>
                )}
              />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default UserEditPassword;
