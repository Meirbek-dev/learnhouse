'use client';

import { Field, FieldContent, FieldError, FieldLabel } from '@components/ui/field';
import { AuthErrorBanner, AuthSuccessBanner, AuthSubmitButton, useAuthAction } from '@components/auth/AuthForm';
import PasswordInput from '@components/ui/custom/password-input';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { getAbsoluteUrl } from '@services/config/config';
import { resetPassword } from '@services/auth/auth';
import { useSearchParams } from 'next/navigation';
import AuthLogo from '@components/auth/logo';
import AuthCard from '@components/auth/card';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { useForm } from 'react-hook-form';
import * as v from 'valibot';

const createValidationSchema = (t: (key: string, values?: Record<string, string | number | Date>) => string) =>
  v.pipe(
    v.object({
      email: v.pipe(v.string(), v.minLength(1, t('required')), v.email(t('invalidEmail'))),
      new_password: v.pipe(
        v.string(),
        v.minLength(1, t('required')),
        v.minLength(8, t('passwordMinLength', { length: 8 })),
      ),
      confirm_password: v.pipe(v.string(), v.minLength(1, t('required'))),
      reset_code: v.pipe(v.string(), v.minLength(1, t('required'))),
    }),
    v.forward(
      v.partialCheck(
        [['new_password'], ['confirm_password']],
        (data) => data.new_password === data.confirm_password,
        t('passwordsDoNotMatch'),
      ),
      ['confirm_password'],
    ),
  );

type ResetPasswordFormData = v.InferOutput<ReturnType<typeof createValidationSchema>>;

const ResetPasswordClient = () => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Auth.Reset');
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? searchParams.get('resetCode') ?? '';
  const email = searchParams.get('email') ?? '';
  const validationSchema = createValidationSchema(validationT);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ResetPasswordFormData>({
    resolver: valibotResolver(validationSchema),
    defaultValues: { email, new_password: '', confirm_password: '', reset_code: token },
  });

  const { execute, error, message, setMessage, isPending } = useAuthAction<ResetPasswordFormData>(async (values) => {
    const res = await resetPassword(values.reset_code, values.new_password);
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string };
      throw new Error(body?.detail ?? t('unknownError'));
    }
    setMessage(t('success'));
  });

  return (
    <AuthCard className="max-w-md">
      <AuthLogo />
      <p className="mt-4 text-xl font-semibold tracking-tight">{t('title')}</p>
      <p className="text-muted-foreground mt-2 text-center text-sm">{t('enterResetDetails')}</p>

      {error ? <div className="mt-4"><AuthErrorBanner message={error} /></div> : null}

      {message ? (
        <div className="mt-4 w-full space-y-2">
          <AuthSuccessBanner message={message} />
          <Link
            href={getAbsoluteUrl('/login')}
            className="block text-center text-sm underline"
          >
            {t('loginAgain')}
          </Link>
        </div>
      ) : null}

      <form
        className="mt-6 w-full space-y-4"
        onSubmit={handleSubmit(execute)}
      >
        <Field>
          <FieldLabel>{t('email')}</FieldLabel>
          <FieldContent>
            <Input
              type="email"
              placeholder={t('emailPlaceholder')}
              autoComplete="email"
              className="w-full"
              {...register('email')}
            />
          </FieldContent>
          <FieldError>{errors.email?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel>{t('resetCode')}</FieldLabel>
          <FieldContent>
            <Input
              type="text"
              placeholder={t('resetCodePlaceholder')}
              autoComplete="one-time-code"
              className="w-full"
              {...register('reset_code')}
            />
          </FieldContent>
          <FieldError>{errors.reset_code?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel>{t('newPassword')}</FieldLabel>
          <FieldContent>
            <PasswordInput
              placeholder={t('newPasswordPlaceholder')}
              autoComplete="new-password"
              className="w-full"
              {...register('new_password')}
            />
          </FieldContent>
          <FieldError>{errors.new_password?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel>{t('confirmPassword')}</FieldLabel>
          <FieldContent>
            <PasswordInput
              placeholder={t('confirmPasswordPlaceholder')}
              autoComplete="new-password"
              className="w-full"
              {...register('confirm_password')}
            />
          </FieldContent>
          <FieldError>{errors.confirm_password?.message}</FieldError>
        </Field>

        <AuthSubmitButton
          isPending={isPending}
          label={t('changePassword')}
          pendingLabel={t('loading')}
        />
      </form>
    </AuthCard>
  );
};

export default ResetPasswordClient;
