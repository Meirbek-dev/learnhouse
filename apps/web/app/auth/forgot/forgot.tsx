'use client';

import { Field, FieldContent, FieldError, FieldLabel } from '@components/ui/field';
import { AuthErrorBanner, AuthSuccessBanner, AuthSubmitButton, useAuthAction } from '@components/auth/AuthForm';
import { ArrowLeft } from 'lucide-react';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { getAbsoluteUrl } from '@services/config/config';
import { sendResetLink } from '@services/auth/auth';
import AuthLogo from '@components/auth/logo';
import AuthCard from '@components/auth/card';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { useForm } from 'react-hook-form';
import * as v from 'valibot';

const createValidationSchema = (t: (key: string) => string) =>
  v.object({
    email: v.pipe(v.string(), v.minLength(1, t('required')), v.email(t('invalidEmail'))),
  });

type ForgotPasswordFormData = v.InferOutput<ReturnType<typeof createValidationSchema>>;

const ForgotPasswordClient = () => {
  const t = useTranslations('Auth.Forgot');
  const validationT = useTranslations('Validation');
  const validationSchema = createValidationSchema(validationT);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: valibotResolver(validationSchema),
    defaultValues: { email: '' },
  });

  const { execute, error, message, setMessage, isPending } = useAuthAction<ForgotPasswordFormData>(async (values) => {
    const res = await sendResetLink(values.email);
    if (!res.ok) {
      const body = await res.json().catch(() => ({})) as { detail?: string };
      throw new Error(body?.detail ?? t('unknownError'));
    }
    setMessage(t('checkEmail'));
  });

  return (
    <AuthCard>
      <Link
        prefetch={false}
        href={getAbsoluteUrl('/')}
      >
        <AuthLogo />
      </Link>
      <p className="mt-4 text-xl font-semibold tracking-tight">{t('title')}</p>
      <p className="text-muted-foreground mt-2 text-center text-sm">{t('enterEmailMessage')}</p>

      {error ? <div className="mt-4"><AuthErrorBanner message={error} /></div> : null}
      {message ? <div className="mt-4"><AuthSuccessBanner message={message} /></div> : null}

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

        <AuthSubmitButton
          isPending={isPending}
          label={t('sendResetLink')}
          pendingLabel={t('loading')}
        />
      </form>

      <Link
        prefetch={false}
        href={getAbsoluteUrl('/login')}
        className="text-muted-foreground mt-5 flex items-center gap-1 text-sm underline"
      >
        <ArrowLeft size={14} />
        {t('backToLogin')}
      </Link>
    </AuthCard>
  );
};

export default ForgotPasswordClient;
