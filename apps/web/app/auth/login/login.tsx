'use client';

import { Field, FieldContent, FieldError, FieldLabel } from '@components/ui/field';
import { AuthErrorBanner, AuthSubmitButton, useAuthAction } from '@components/auth/AuthForm';
import { getAbsoluteUrl, getPublicAPIUrl } from '@services/config/config';
import { loginAndGetToken } from '@services/auth/auth';
import PasswordInput from '@components/ui/custom/password-input';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { SiGoogle } from '@icons-pack/react-simple-icons';
import { Separator } from '@components/ui/separator';
import { useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@components/ui/button';
import AuthLogo from '@components/auth/logo';
import AuthCard from '@components/auth/card';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { useForm } from 'react-hook-form';
import * as v from 'valibot';

const createValidationSchema = (t: (key: string, values?: Record<string, unknown>) => string) =>
  v.object({
    email: v.pipe(v.string(), v.minLength(1, t('required')), v.email(t('invalidEmail'))),
    password: v.pipe(v.string(), v.minLength(1, t('required')), v.minLength(8, t('passwordMinLength', { length: 8 }))),
  });

type LoginFormData = v.InferOutput<ReturnType<typeof createValidationSchema>>;

/** Validate and return the returnTo path, rejecting open-redirect attempts. */
function getSafeReturnTo(raw: string | null): string {
  if (raw) {
    try {
      const parsed = new URL(raw, globalThis.location.origin);
      if (parsed.origin === globalThis.location.origin) return raw;
    } catch {
      // Invalid URL — fall through.
    }
  }
  return '/redirect_from_auth';
}

const LoginClient = () => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Auth.Login');
  const searchParams = useSearchParams();
  const [isPendingGoogle, startGoogleTransition] = useTransition();

  const validationSchema = createValidationSchema(validationT);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: valibotResolver(validationSchema),
    defaultValues: { email: '', password: '' },
  });

  const { execute, error, isPending } = useAuthAction<LoginFormData>(async (values) => {
    const response = await loginAndGetToken(values.email, values.password);
    if (!response.ok) throw new Error(t('wrongCredentials'));
    globalThis.location.href = getSafeReturnTo(searchParams.get('returnTo'));
  });

  const handleGoogleSignIn = () => {
    startGoogleTransition(() => {
      const postLoginPath = getSafeReturnTo(searchParams.get('returnTo'));
      const frontendCallback = getAbsoluteUrl(postLoginPath.startsWith('/') ? postLoginPath : '/redirect_from_auth');
      const authorizeUrl = new URL(`${getPublicAPIUrl()}auth/google/authorize`);
      authorizeUrl.searchParams.set('callback', frontendCallback);
      globalThis.location.href = authorizeUrl.toString();
    });
  };

  const anyPending = isPending || isPendingGoogle;

  return (
    <AuthCard>
      <Link
        prefetch={false}
        href={getAbsoluteUrl('/')}
      >
        <AuthLogo />
      </Link>

      <Button
        className="mt-8 w-full gap-3"
        onClick={handleGoogleSignIn}
        disabled={anyPending}
      >
        <SiGoogle />
        {t('signInWithGoogle')}
      </Button>

      <div className="my-7 flex w-full items-center justify-center overflow-hidden">
        <Separator />
        <span className="px-2 text-sm">{t('or')}</span>
        <Separator />
      </div>

      {error ? (
        <div className="mb-4">
          <AuthErrorBanner message={error} />
        </div>
      ) : null}

      <form
        className="w-full space-y-4"
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
          <FieldLabel>{t('password')}</FieldLabel>
          <FieldContent>
            <PasswordInput
              placeholder={t('passwordPlaceholder')}
              autoComplete="current-password"
              className="w-full"
              {...register('password')}
            />
          </FieldContent>
          <FieldError>{errors.password?.message}</FieldError>
        </Field>

        <div className="flex justify-end">
          <Link
            prefetch={false}
            href={getAbsoluteUrl('/forgot')}
            className="text-muted-foreground text-xs underline"
          >
            {t('forgotPassword')}
          </Link>
        </div>

        <AuthSubmitButton
          isPending={anyPending}
          label={t('login')}
          pendingLabel={t('loading')}
        />
      </form>

      <p className="mt-5 text-center text-sm">
        {t('noAccount')}
        <Link
          prefetch={false}
          href={getAbsoluteUrl('/signup')}
          className="text-muted-foreground ml-1 underline"
        >
          {t('signup')}
        </Link>
      </p>
    </AuthCard>
  );
};

export default LoginClient;
