'use client';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { getUriWithOrg, getUriWithoutOrg } from '@services/config/config';
import { AlertTriangle, Loader2, UserRoundPlus } from 'lucide-react';
import PasswordInput from '@components/ui/custom/password-input';
import platformLogoFull from 'public/platform_logo_full.svg';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState, useTransition } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { useForm } from 'react-hook-form';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import * as z from 'zod';

interface LoginClientProps {
  org: any;
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
  const validationSchema = createValidationSchema(validationT);
  const [isPending, startTransition] = useTransition();

  const form = useForm<LoginFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSubmit = (values: LoginFormData) => {
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
          // Successful login, redirect
          window.location.href = '/redirect_from_auth';
        }
      } catch (error) {
        console.error('Login error:', error);
        setError(t('wrongCredentials'));
      }
    });
  };

  return (
    <div className="grid h-screen grid-flow-col justify-stretch">
      <div className="flex h-screen flex-col items-center justify-center bg-neutral-100">
        <div className="rounded-xl border-2 bg-white p-12 shadow-lg">
          <div className="flex justify-center pb-8">
            <Link
              prefetch={false}
              href={getUriWithOrg(props.org.slug, '/')}
            >
              <Image
                quality={100}
                width={230}
                src={platformLogoFull}
                alt="Ashyq Bilim logo"
                loading="eager"
              />
            </Link>
          </div>
          <div className="flex flex-row bg-white">
            <div className="m-auto w-72">
              {error ? (
                <div className="mb-4 flex items-center justify-center space-x-2 rounded-md bg-red-200 p-4 text-red-950 shadow-xs transition-all">
                  <AlertTriangle size={22} />
                  <div className="text-sm font-semibold">{t('wrongCredentials')}</div>
                </div>
              ) : null}
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit(handleSubmit)}
                  className="space-y-4"
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('email')}</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            placeholder={t('emailPlaceholder')}
                            autoComplete="email"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="password"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{t('password')}</FormLabel>
                        <FormControl>
                          <PasswordInput
                            placeholder={t('passwordPlaceholder')}
                            autoComplete="current-password"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <div>
                    <Link
                      prefetch={false}
                      href={{
                        pathname: getUriWithoutOrg('/forgot'),
                        query: props.org.slug ? { orgslug: props.org.slug } : undefined,
                      }}
                      className="text-xs text-gray-500 transition-colors hover:text-gray-700 hover:underline"
                    >
                      {t('forgotPassword')}
                    </Link>
                  </div>

                  <div className="flex py-4">
                    <Button
                      type="submit"
                      className="w-full font-semibold shadow-md transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isPending}
                    >
                      {isPending ? (
                        <div className="flex items-center gap-2">
                          <Loader2
                            className="h-4 w-4 animate-spin"
                            aria-hidden="true"
                          />
                          {t('loading')}
                        </div>
                      ) : (
                        t('login')
                      )}
                    </Button>
                  </div>
                </form>
              </Form>
              <div className="mx-10 mt-5 flex h-0.5 rounded-2xl bg-slate-100" />
              <div className="mx-auto flex justify-center py-5">{t('or')}</div>
              <div className="flex flex-col space-y-4">
                <Link
                  prefetch={false}
                  href={{
                    pathname: getUriWithoutOrg('/signup'),
                    query: props.org.slug ? { orgslug: props.org.slug } : undefined,
                  }}
                  className="flex w-full items-center justify-center space-x-3 rounded-md bg-gray-800 p-2 py-3 text-center text-base font-semibold text-gray-300 shadow-sm transition-all duration-200 hover:bg-gray-700 hover:text-white"
                >
                  <UserRoundPlus size={17} />
                  <span>{t('signup')}</span>
                </Link>
                <button
                  onClick={() =>
                    startTransition(() => {
                      // Store org_id in cookie for OAuth callback
                      if (props.org?.id) {
                        document.cookie = `oauth_org_id=${props.org.id}; path=/; max-age=600; samesite=lax`;
                      }
                      signIn('google', {
                        callbackUrl: `/redirect_from_auth?org_id=${props.org?.id || ''}&org_slug=${props.org?.slug || ''}`,
                      });
                    })
                  }
                  className="flex w-full justify-center space-x-3 rounded-md border border-gray-200 bg-white p-2 py-3 text-center text-base font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50"
                  disabled={isPending}
                >
                  <Image
                    src="https://fonts.gstatic.com/s/i/productlogos/googleg/v6/24px.svg"
                    alt="Google logo"
                    width={24}
                    height={24}
                  />
                  <span>{t('signInWithGoogle')}</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoginClient;
