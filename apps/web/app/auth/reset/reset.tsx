'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { AlertTriangle, Info } from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

import { useOrg } from '@components/Contexts/OrgContext';
import { Button } from '@components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { Input } from '@components/ui/input';
import { resetPassword } from '@services/auth/auth';
import { getUriWithOrg, getUriWithoutOrg } from '@services/config/config';
import { getOrgLogoMediaDirectory } from '@services/media/media';
import touEmblemDark from 'public/tou_emblem_dark.png';

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  z
    .object({
      email: z.string().min(1, t('required')).email(t('invalidEmail')),
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

function ResetPasswordClient() {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Auth.Reset');
  const org = useOrg() as any;
  const searchParams = useSearchParams();
  const reset_code = searchParams.get('resetCode') || '';
  const email = searchParams.get('email') || '';
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
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

  const handleSubmit = async (values: ResetPasswordFormData) => {
    setError('');
    setMessage('');
    const res = await resetPassword(values.email, values.new_password, org?.id, values.reset_code);
    if (res.status === 200) {
      setMessage(t('success'));
    } else {
      setError(res.data.detail);
    }
  };
  return (
    <div className="grid h-screen grid-flow-col justify-stretch">
      <div
        className="right-login-part"
        style={{
          background: 'linear-gradient(041.61deg, #202020 7.15%, #000000 90.96%)',
        }}
      >
        <div className="m-10">
          <Link
            prefetch
            href={getUriWithOrg(org?.slug, '/')}
          >
            <Image
              quality={100}
              width={30}
              height={30}
              src={touEmblemDark}
              alt="OpenU logo"
            />
          </Link>
        </div>
        <div className="ml-10 flex h-4/6 flex-row text-white">
          <div className="m-auto flex flex-wrap items-center space-x-4">
            <div className="shadow-[0px_4px_16px_rgba(0,0,0,0.02)]">
              {org?.logo_image ? (
                <Image
                  src={`${getOrgLogoMediaDirectory(org?.org_uuid, org?.logo_image)}`}
                  alt={org?.name}
                  width={70}
                  height={70}
                  className="inset-0 rounded-xl bg-white shadow-xl ring-1 ring-inset ring-black/10"
                />
              ) : (
                <Image
                  quality={100}
                  width={70}
                  height={70}
                  src={touEmblemDark}
                  alt="OpenU logo"
                />
              )}
            </div>
            <div className="text-xl font-bold">{org?.name}</div>
          </div>
        </div>
      </div>
      <div className="left-login-part flex flex-row bg-white">
        <div className="m-auto w-72">
          <h1 className="mb-4 text-2xl font-bold">{t('title')}</h1>
          <p className="mb-4 text-sm text-gray-600">{t('enterResetDetails')}</p>

          {error && (
            <div className="shadow-xs mb-4 flex items-center justify-center space-x-2 rounded-md bg-red-200 p-4 text-red-950 transition-all">
              <AlertTriangle size={18} />
              <div className="text-sm font-bold">{error}</div>
            </div>
          )}
          {message && (
            <div className="mb-4 flex flex-col gap-2">
              <div className="shadow-xs flex items-center justify-center space-x-2 rounded-md bg-green-200 p-4 text-green-950 transition-all">
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
                      <Input
                        type="password"
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
                      <Input
                        type="password"
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
                  className="w-full rounded-md bg-black p-2 text-center font-bold text-white shadow-md transition-all duration-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                  disabled={form.formState.isSubmitting}
                >
                  {form.formState.isSubmitting ? t('loading') : t('changePassword')}
                </Button>
              </div>
            </form>
          </Form>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordClient;
