'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, UserRoundPlus } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { signIn } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { Button } from '@components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { Input } from '@components/ui/input';
import { getUriWithOrg, getUriWithoutOrg } from '@services/config/config';
import openuLogoDark from 'public/openu_logo_dark.png';

interface LoginClientProps {
  org: any;
}

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  z.object({
    email: z.string().min(1, t('required')).email(t('invalidEmail')),
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

  const form = useForm<LoginFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      email: '',
      password: '',
    },
  });

  const handleSubmit = async (values: LoginFormData) => {
    const res = await signIn('credentials', {
      redirect: false,
      email: values.email,
      password: values.password,
      callbackUrl: '/redirect_from_auth',
    });
    if (res?.error) {
      setError(t('wrongCredentials'));
    } else {
      await signIn('credentials', {
        email: values.email,
        password: values.password,
        callbackUrl: '/redirect_from_auth',
      });
    }
  };

  return (
    <div className="grid h-screen grid-flow-col justify-stretch">
      <div className="flex h-screen flex-col items-center justify-center bg-neutral-100">
        <div className="rounded-xl border-2 bg-white p-12">
          <div className="flex justify-center pb-8">
            <Link
              prefetch
              href={getUriWithOrg(props.org.slug, '/')}
            >
              <Image
                quality={100}
                width={230}
                height={100}
                src={openuLogoDark}
                alt="OpenU logo"
              />
            </Link>
          </div>
          <div className="left-login-part flex flex-row bg-white">
            <div className="m-auto w-72">
              {error && (
                <div className="shadow-xs flex items-center justify-center space-x-2 rounded-md bg-red-200 p-4 text-red-950 transition-all">
                  <AlertTriangle size={18} />
                  <div className="text-sm font-bold">{t('wrongCredentials')}</div>
                </div>
              )}

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
                          <Input
                            type="password"
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
                      href={{
                        pathname: getUriWithoutOrg('/forgot'),
                        query: props.org.slug ? { orgslug: props.org.slug } : null,
                      }}
                      passHref
                      className="text-xs text-gray-500 transition-colors hover:text-gray-700 hover:underline"
                    >
                      {t('forgotPassword')}
                    </Link>
                  </div>

                  <div className="flex py-4">
                    <Button
                      type="submit"
                      className="w-full rounded-md bg-black p-2 text-center font-bold text-white shadow-md transition-all duration-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={form.formState.isSubmitting}
                    >
                      {form.formState.isSubmitting ? t('loading') : t('login')}
                    </Button>
                  </div>
                </form>
              </Form>
              <div className="mx-10 mt-5 flex h-0.5 rounded-2xl bg-slate-100" />
              <div className="mx-auto flex justify-center py-5">{t('or')}</div>
              <div className="flex flex-col space-y-4">
                <Link
                  href={{
                    pathname: getUriWithoutOrg('/signup'),
                    query: props.org.slug ? { orgslug: props.org.slug } : null,
                  }}
                  className="text-md flex w-full items-center justify-center space-x-3 rounded-md bg-gray-800 p-2 py-3 text-center font-semibold text-gray-300 shadow-sm transition-all duration-200 hover:bg-gray-700 hover:text-white"
                >
                  <UserRoundPlus size={17} />
                  <span>{t('signup')}</span>
                </Link>
                <button
                  onClick={() => signIn('google', { callbackUrl: '/redirect_from_auth' })}
                  className="text-md flex w-full justify-center space-x-3 rounded-md border border-gray-200 bg-white p-2 py-3 text-center font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50"
                  disabled={form.formState.isSubmitting}
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
