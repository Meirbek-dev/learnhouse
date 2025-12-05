'use client';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { AlertTriangle, Info, Loader2, ArrowLeft } from 'lucide-react';
import platformLogoFull from 'public/platform_logo_full.svg';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUriWithOrg } from '@services/config/config';
import { zodResolver } from '@hookform/resolvers/zod';
import { sendResetLink } from '@services/auth/auth';
import { useState, useTransition } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { useForm } from 'react-hook-form';
import Image from 'next/image';
import * as z from 'zod';

const createValidationSchema = (t: (key: string) => string) =>
  z.object({
    email: z.email(t('invalidEmail')).min(1, t('required')),
  });

type ForgotPasswordFormData = z.infer<ReturnType<typeof createValidationSchema>>;

const ForgotPasswordClient = () => {
  const t = useTranslations('Auth.Forgot');
  const org = useOrg() as any;
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const validationSchema = createValidationSchema(t);

  const form = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      email: '',
    },
  });

  const [isPending, startTransition] = useTransition();

  const handleSubmit = async (values: ForgotPasswordFormData) => {
    setError('');
    setMessage('');

    startTransition(async () => {
      const res = await sendResetLink(values.email, org?.id);
      if (res.status === 200) {
        setMessage(t('checkEmail'));
      } else {
        setError(res.data.detail);
      }
    });
  };
  return (
    <div className="grid h-screen grid-flow-col justify-stretch">
      <div className="flex h-screen flex-col items-center justify-center bg-neutral-100">
        <div className="rounded-xl border-2 bg-white px-10 py-6 shadow-lg">
          <div className="flex justify-center pb-6">
            <Link
              prefetch={false}
              href={getUriWithOrg(org?.slug, '/')}
            >
              <Image
                quality={100}
                width={230}
                src={platformLogoFull}
                alt="Ashyq Bilim logo"
              />
            </Link>
          </div>
          <div className="flex flex-row bg-white">
            <div className="m-auto w-72">
              <h1 className="mb-4 text-2xl font-bold">{t('title')}</h1>
              <p className="mb-4 text-sm">{t('enterEmailMessage')}</p>

              {error ? (
                <div className="my-4 flex items-center justify-center space-x-2 rounded-md bg-red-200 p-3 text-red-950 shadow-xs transition-all">
                  <AlertTriangle size={22} />
                  <div className="text-sm font-bold">{error}</div>
                </div>
              ) : null}
              {message ? (
                <div className="flex items-center justify-center space-x-2 rounded-md bg-green-200 p-4 text-green-950 shadow-xs transition-all">
                  <Info size={18} />
                  <div className="text-sm font-bold">{t('checkEmail')}</div>
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

                  <div className="flex py-4">
                    <Button
                      type="submit"
                      className="w-full p-2 font-semibold shadow-md transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
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
                        t('sendResetLink')
                      )}
                    </Button>
                  </div>
                  <div className="flex justify-center">
                    <Link
                      prefetch={false}
                      href={`/login?orgslug=${org?.slug}`}
                      className="flex items-center space-x-2 text-sm text-slate-600 hover:text-slate-800"
                    >
                      <ArrowLeft size={14} />
                      <span>{t('backToLogin')}</span>
                    </Link>
                  </div>
                </form>
              </Form>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordClient;
