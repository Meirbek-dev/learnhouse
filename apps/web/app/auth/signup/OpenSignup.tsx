'use client';

import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { AlertTriangle, Check, Loader2, User } from 'lucide-react';
import PasswordInput from '@components/ui/custom/password-input';
import { useEffect, useState, useTransition } from 'react';
import { useOrg } from '@components/Contexts/OrgContext';
import { zodResolver } from '@hookform/resolvers/zod';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { signup } from '@services/auth/auth';
import { useTranslations } from 'next-intl';
import { useForm } from 'react-hook-form';
import { signIn } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { z } from 'zod';

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  z.object({
    email: z.email(t('invalidEmail')).min(1, t('required')),
    password: z
      .string()
      .min(1, t('required'))
      .min(8, t('passwordMinLength', { length: 8 })),
    username: z
      .string()
      .min(1, t('required'))
      .min(4, t('usernameMinLength', { length: 4 })),
    bio: z.string().min(1, t('required')),
    first_name: z.string().optional(),
    last_name: z.string().optional(),
    org_slug: z.string().optional(),
    org_id: z.number().optional(),
  });

type SignUpFormData = z.infer<ReturnType<typeof createValidationSchema>>;

const OpenSignUpComponent = () => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Auth.Signup');
  const org = useOrg() as any;
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [isPending, startTransition] = useTransition();
  const validationSchema = createValidationSchema(validationT);

  const form = useForm<SignUpFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      org_slug: org?.slug || '',
      org_id: org?.id || '',
      email: '',
      password: '',
      username: '',
      bio: '',
      first_name: '',
      last_name: '',
    },
  });

  const handleSubmit = (values: SignUpFormData) => {
    setError('');
    setMessage('');

    // Ensure org_slug and org_id are strings
    const submitValues = {
      ...values,
      org_slug: values.org_slug || org?.slug || '',
      org_id: values.org_id || org?.id || '',
    };

    startTransition(async () => {
      const res = await signup(submitValues);
      const responseMessage = await res.json();
      if (res.status === 200) {
        setMessage(t('accountCreated'));
      } else if ([401, 400, 404, 409].includes(res.status)) {
        setError(responseMessage.detail);
      } else {
        setError(t('errorSomethingWentWrong'));
      }
    });
  };

  useEffect(() => {
    if (org?.slug && org?.id) {
      form.setValue('org_slug', org.slug);
      form.setValue('org_id', org.id);
    }
  }, [org, form]);

  return (
    <div className="m-auto w-72">
      {error ? (
        <div className="my-4 flex items-center justify-center space-x-2 rounded-md bg-red-200 p-3 text-red-950 shadow-xs transition-all">
          <AlertTriangle size={22} />
          <div className="text-sm font-semibold">{error}</div>
        </div>
      ) : null}
      {message ? (
        <div className="mb-4 flex flex-col items-center justify-center space-y-4 space-x-2 rounded-md bg-green-200 p-4 text-green-950 shadow-xs transition-all">
          <div className="flex space-x-2">
            <Check size={18} />
            <div className="text-sm font-semibold">{message}</div>
          </div>
          <hr className="w-40 border border-green-900/20" />
          <Link
            className="flex items-center space-x-2 transition-colors hover:text-green-800"
            href={`/login?orgslug=${org?.slug}`}
          >
            <User size={14} /> <div>{t('loginToAccount')}</div>
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
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('password')}</FormLabel>
                <FormControl>
                  <PasswordInput
                    placeholder={t('passwordPlaceholder')}
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
            name="username"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('username')}</FormLabel>
                <FormControl>
                  <Input
                    type="text"
                    placeholder={t('usernamePlaceholder')}
                    autoComplete="username"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="bio"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('bio')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t('bioPlaceholder')}
                    className="min-h-[80px] resize-none"
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
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? (
                <div className="flex items-center gap-2">
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                  {t('loading')}
                </div>
              ) : (
                t('createAccount')
              )}
            </Button>
          </div>
        </form>
      </Form>
      <div>
        <div className="mx-10 mt-5 mb-5 flex h-0.5 rounded-2xl bg-slate-100" />
        <button
          onClick={() => startTransition(() => signIn('google', { callbackUrl: '/redirect_from_auth' }))}
          className="flex w-full justify-center space-x-3 rounded-md border border-gray-200 bg-white p-2 py-3 text-center text-base font-semibold text-slate-600 shadow-sm transition-all duration-200 hover:border-gray-300 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-50"
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
  );
};

export default OpenSignUpComponent;
