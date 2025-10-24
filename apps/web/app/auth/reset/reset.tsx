'use client';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import PasswordInput from '@components/ui/custom/password-input';
import { AlertTriangle, Info, Loader2 } from 'lucide-react';
import { getUriWithoutOrg } from '@services/config/config';
import { useOrg } from '@components/Contexts/OrgContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { resetPassword } from '@services/auth/auth';
import { useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  z
    .object({
      email: z.email(t('invalidEmail')).min(1, t('required')),
      new_password: z
        .string()
        .min(1, t('required'))
        .min(8, t('passwordMinLength', { length: 8 })),
      confirm_password: z.string().min(1, t('required')),
      reset_code: z.string().min(1, t('required')),
    })
    .refine((data) => data.new_password === data.confirm_password, {
      message: t('passwordsDoNotMatch'),
      path: ['confirm_password'],
    });

type ResetPasswordFormData = z.infer<ReturnType<typeof createValidationSchema>>;

const ResetPasswordClient = () => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Auth.Reset');
  const org = useOrg() as any;
  const searchParams = useSearchParams();
  const reset_code = searchParams.get('resetCode') || '';
  const email = searchParams.get('email') || '';
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const validationSchema = createValidationSchema(validationT);

  const form = useForm<ResetPasswordFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      email,
      new_password: '',
      confirm_password: '',
      reset_code,
    },
  });

  const handleSubmit = (values: ResetPasswordFormData) => {
    setError('');
    setMessage('');
    startTransition(async () => {
      const res = await resetPassword(values.email, values.new_password, org?.id, values.reset_code);
      if (res.status === 200) {
        setMessage(t('success'));
      } else {
        setError(res.data.detail);
      }
    });
  };
  return (
    <div className="grid h-screen grid-flow-col justify-stretch">
      <div className="flex h-screen flex-col items-center justify-center bg-neutral-100">
        <div className="rounded-xl border-2 bg-white p-12 shadow-lg">
          <div className="m-auto w-72">
            <h1 className="mb-4 text-2xl font-bold">{t('title')}</h1>
            <p className="mb-4 text-sm text-gray-600">{t('enterResetDetails')}</p>

            {error ? (
              <div className="my-4 flex items-center justify-center space-x-2 rounded-md bg-red-200 p-3 text-red-950 shadow-xs transition-all">
                <AlertTriangle size={22} />
                <div className="text-sm font-bold">{error}</div>
              </div>
            ) : null}
            {message ? (
              <div className="mb-4 flex flex-col gap-2">
                <div className="flex items-center justify-center space-x-2 rounded-md bg-green-200 p-4 text-green-950 shadow-xs transition-all">
                  <Info size={18} />
                  <div className="text-sm font-bold">{t('success')}</div>
                </div>
                <Link
                  href={getUriWithoutOrg(`/login?orgslug=${org.slug}`)}
                  className="text-center text-sm text-blue-600 transition-colors hover:text-blue-800 hover:underline"
                >
                  {t('loginAgain')}
                </Link>
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
                  name="reset_code"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('resetCode')}</FormLabel>
                      <FormControl>
                        <Input
                          type="text"
                          placeholder={t('resetCodePlaceholder')}
                          autoComplete="one-time-code"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="new_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('newPassword')}</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder={t('newPasswordPlaceholder')}
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="confirm_password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{t('confirmPassword')}</FormLabel>
                      <FormControl>
                        <PasswordInput
                          placeholder={t('confirmPasswordPlaceholder')}
                          autoComplete="new-password"
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="flex py-4">
                  <Button
                    type="submit"
                    className="w-full font-bold shadow-md transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
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
                      t('changePassword')
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ResetPasswordClient;
