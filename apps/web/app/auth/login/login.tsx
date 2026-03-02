'use client';

import { Field, FieldContent, FieldError, FieldLabel } from '@components/ui/field';
import { getUriWithOrg, getUriWithoutOrg } from '@services/config/config';
import PasswordInput from '@components/ui/custom/password-input';
import { SiGoogle } from '@icons-pack/react-simple-icons';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Separator } from '@components/ui/separator';
import { useState, useTransition } from 'react';
import { Button } from '@components/ui/button';
import AuthLogo from '@components/auth/logo';
import AuthCard from '@components/auth/card';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { useForm } from 'react-hook-form';
import { signIn } from 'next-auth/react';
import type { Org } from '@/types/org';
import * as z from 'zod';

interface LoginClientProps {
  org: Org;
}

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  z.object({
    email: z.email(t('invalidEmail')).min(1, t('required')),
    password: z
      .string()
      .min(1, t('required'))
      .min(8, t('passwordMinLength', { length: 8 })),
  });

type LoginFormData = z.infer<ReturnType<typeof createValidationSchema>>;

const LoginClient = (props: LoginClientProps) => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Auth.Login');
  const [error, setError] = useState('');
  const [isPending, startTransition] = useTransition();
  const validationSchema = createValidationSchema(validationT);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: { email: '', password: '' },
  });

  const onSubmit = (values: LoginFormData) => {
    startTransition(async () => {
      try {
        const res = await signIn('credentials', {
          redirect: false,
          email: values.email,
          password: values.password,
        });

        if (res?.error) {
          setError(t('wrongCredentials'));
          return;
        }

        if (res?.ok) {
          globalThis.location.href = '/redirect_from_auth';
        }
      } catch {
        setError(t('wrongCredentials'));
      }
    });
  };

  const handleGoogleSignIn = () => {
    startTransition(() => {
      if (props.org?.id) {
        document.cookie = `oauth_org_id=${props.org.id}; path=/; max-age=600; samesite=lax`;
      }
      signIn('google', {
        callbackUrl: `/redirect_from_auth?org_id=${props.org?.id || ''}&org_slug=${props.org?.slug || ''}`,
      });
    });
  };

  return (
    <AuthCard>
      <Link
        prefetch={false}
        href={getUriWithOrg(props.org.slug, '/')}
      >
        <AuthLogo />
      </Link>

      <Button
        className="mt-8 w-full gap-3"
        onClick={handleGoogleSignIn}
        disabled={isPending}
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
        <div className="mb-4 flex w-full items-center gap-2 rounded-md bg-red-200 p-3 text-red-950">
          <AlertTriangle size={18} />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      ) : null}

      <form
        className="w-full space-y-4"
        onSubmit={handleSubmit(onSubmit)}
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
            href={{
              pathname: getUriWithoutOrg('/forgot'),
              query: props.org.slug ? { orgslug: props.org.slug } : undefined,
            }}
            className="text-muted-foreground text-xs underline"
          >
            {t('forgotPassword')}
          </Link>
        </div>

        <Button
          type="submit"
          className="w-full"
          disabled={isPending}
        >
          {isPending ? (
            <>
              <Loader2
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              {t('loading')}
            </>
          ) : (
            t('login')
          )}
        </Button>
      </form>

      <p className="mt-5 text-center text-sm">
        {t('noAccount')}
        <Link
          prefetch={false}
          href={{
            pathname: getUriWithoutOrg('/signup'),
            query: props.org.slug ? { orgslug: props.org.slug } : undefined,
          }}
          className="text-muted-foreground ml-1 underline"
        >
          {t('signup')}
        </Link>
      </p>
    </AuthCard>
  );
};

export default LoginClient;
