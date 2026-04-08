'use client';

import { Field, FieldContent, FieldError, FieldLabel } from '@components/ui/field';
import { AuthErrorBanner, AuthSubmitButton, useAuthAction } from '@components/auth/AuthForm';
import { getAbsoluteUrl, getPublicAPIUrl } from '@services/config/config';
import { loginAndGetToken, signup } from '@services/auth/auth';
import PasswordInput from '@components/ui/custom/password-input';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { useTransition } from 'react';
import { SiGoogle } from '@icons-pack/react-simple-icons';
import { Separator } from '@components/ui/separator';
import { passwordSchema } from '@/lib/schemas/auth';
import { Button } from '@components/ui/button';
import AuthLogo from '@components/auth/logo';
import AuthCard from '@components/auth/card';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { useForm } from 'react-hook-form';
import * as v from 'valibot';

const buildFormSchema = (t: (key: string) => string) =>
  v.pipe(
    v.object({
      firstName: v.pipe(v.string(), v.minLength(1, t('required'))),
      lastName: v.pipe(v.string(), v.minLength(1, t('required'))),
      email: v.pipe(v.string(), v.email(t('invalidEmail'))),
      password: passwordSchema(t),
      confirmPassword: v.string(),
    }),
    v.forward(
      v.partialCheck(
        [['password'], ['confirmPassword']],
        (data) => data.password === data.confirmPassword,
        t('passwordsDontMatch'),
      ),
      ['confirmPassword'],
    ),
  );

type SignUpFormData = v.InferOutput<ReturnType<typeof buildFormSchema>>;

/** Known backend error codes → i18n key mapping. Falls back to generic message. */
const SIGNUP_ERROR_MAP: Record<string, string> = {
  email_taken: 'emailTaken',
  username_taken: 'usernameTaken',
};

async function signupAndLogin(
  body: Parameters<typeof signup>[0],
  email: string,
  password: string,
  t: (key: string) => string,
) {
  const res = await signup(body);

  if (!res.ok) {
    const json = (await res.json().catch(() => ({}))) as { detail?: string | { code?: string; message?: string } };
    const detail = json?.detail;
    const code = typeof detail === 'object' ? detail?.code : undefined;
    const msg = code && SIGNUP_ERROR_MAP[code] ? t(SIGNUP_ERROR_MAP[code]) : t('errorSomethingWentWrong');
    throw new Error(msg);
  }

  const loginRes = await loginAndGetToken(email, password);
  if (!loginRes.ok) throw new Error(t('loginAfterSignupFailed'));

  globalThis.location.href = '/redirect_from_auth';
}

const SignUpClient = () => {
  const t = useTranslations('Auth.Signup');
  const validationT = useTranslations('Validation');
  const [isPendingGoogle, startGoogleTransition] = useTransition();
  const formSchema = buildFormSchema(validationT);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignUpFormData>({
    defaultValues: { firstName: '', lastName: '', email: '', password: '', confirmPassword: '' },
    resolver: valibotResolver(formSchema),
  });

  const { execute, error, isPending } = useAuthAction<SignUpFormData>(async (data) => {
    const username = `${data.firstName.toLowerCase()}.${data.lastName.toLowerCase()}`;
    await signupAndLogin(
      { username, email: data.email, password: data.password, first_name: data.firstName, last_name: data.lastName },
      data.email,
      data.password,
      t,
    );
  });

  const handleGoogleSignIn = () => {
    startGoogleTransition(() => {
      const frontendCallback = getAbsoluteUrl('/redirect_from_auth');
      const authorizeUrl = new URL(`${getPublicAPIUrl()}auth/google/authorize`);
      authorizeUrl.searchParams.set('callback', frontendCallback);
      globalThis.location.href = authorizeUrl.toString();
    });
  };

  const anyPending = isPending || isPendingGoogle;

  return (
    <AuthCard className="max-w-md">
      <Link
        prefetch={false}
        href={getAbsoluteUrl('/')}
      >
        <AuthLogo />
      </Link>
      <p className="mt-4 text-xl font-semibold tracking-tight">{t('title')}</p>

      <Button
        className="mt-8 w-full gap-3"
        onClick={handleGoogleSignIn}
        disabled={anyPending}
      >
        <SiGoogle />
        {t('continueWithGoogle')}
      </Button>

      <div className="my-7 flex w-full items-center justify-center overflow-hidden">
        <Separator />
        <span className="px-2 text-sm">{t('or')}</span>
        <Separator />
      </div>

      <form
        className="w-full space-y-4"
        onSubmit={handleSubmit(execute)}
      >
        {error ? <AuthErrorBanner message={error} /> : null}

        <div className="grid grid-cols-2 gap-3">
          <Field>
            <FieldLabel>{t('firstName')}</FieldLabel>
            <FieldContent>
              <Input
                type="text"
                placeholder={t('firstNamePlaceholder')}
                autoComplete="given-name"
                className="w-full"
                {...register('firstName')}
              />
            </FieldContent>
            <FieldError>{errors.firstName?.message}</FieldError>
          </Field>

          <Field>
            <FieldLabel>{t('lastName')}</FieldLabel>
            <FieldContent>
              <Input
                type="text"
                placeholder={t('lastNamePlaceholder')}
                autoComplete="family-name"
                className="w-full"
                {...register('lastName')}
              />
            </FieldContent>
            <FieldError>{errors.lastName?.message}</FieldError>
          </Field>
        </div>

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
              autoComplete="new-password"
              className="w-full"
              {...register('password')}
            />
          </FieldContent>
          <FieldError>{errors.password?.message}</FieldError>
        </Field>

        <Field>
          <FieldLabel>{t('confirmPassword')}</FieldLabel>
          <FieldContent>
            <PasswordInput
              placeholder={t('confirmPasswordPlaceholder')}
              autoComplete="new-password"
              className="w-full"
              {...register('confirmPassword')}
            />
          </FieldContent>
          <FieldError>{errors.confirmPassword?.message}</FieldError>
        </Field>

        <AuthSubmitButton
          isPending={anyPending}
          label={t('createAccount')}
          pendingLabel={t('loading')}
          className="mt-2 w-full"
        />
      </form>

      <p className="mt-5 text-center text-sm">
        {t('alreadyHaveAccount')}
        <Link
          prefetch={false}
          href={getAbsoluteUrl('/login')}
          className="text-muted-foreground ml-1 underline"
        >
          {t('signIn')}
        </Link>
      </p>
    </AuthCard>
  );
};

export default SignUpClient;
