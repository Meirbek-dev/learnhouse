'use client';

import { Field, FieldContent, FieldError, FieldLabel } from '@components/ui/field';
import { AlertTriangle, ArrowLeft, Info, Loader2 } from 'lucide-react';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUriWithOrg } from '@services/config/config';
import { zodResolver } from '@hookform/resolvers/zod';
import { sendResetLink } from '@services/auth/auth';
import { useState, useTransition } from 'react';
import { Button } from '@components/ui/button';
import AuthLogo from '@components/auth/logo';
import AuthCard from '@components/auth/card';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { useForm } from 'react-hook-form';
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
  const [isPending, startTransition] = useTransition();
  const validationSchema = createValidationSchema(t);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordFormData>({
    resolver: zodResolver(validationSchema),
    defaultValues: { email: '' },
  });

  const onSubmit = (values: ForgotPasswordFormData) => {
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
    <AuthCard>
      <Link
        prefetch={false}
        href={getUriWithOrg(org?.slug, '/')}
      >
        <AuthLogo />
      </Link>
      <p className="mt-4 text-xl font-semibold tracking-tight">{t('title')}</p>
      <p className="text-muted-foreground mt-2 text-center text-sm">{t('enterEmailMessage')}</p>

      {error ? (
        <div className="mt-4 flex w-full items-center gap-2 rounded-md bg-red-200 p-3 text-red-950">
          <AlertTriangle size={18} />
          <span className="text-sm font-semibold">{error}</span>
        </div>
      ) : null}

      {message ? (
        <div className="mt-4 flex w-full items-center gap-2 rounded-md bg-green-200 p-3 text-green-950">
          <Info size={18} />
          <span className="text-sm font-semibold">{t('checkEmail')}</span>
        </div>
      ) : null}

      <form
        className="mt-6 w-full space-y-4"
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
            t('sendResetLink')
          )}
        </Button>
      </form>

      <Link
        prefetch={false}
        href={`/login?orgslug=${org?.slug}`}
        className="text-muted-foreground mt-5 flex items-center gap-1 text-sm underline"
      >
        <ArrowLeft size={14} />
        {t('backToLogin')}
      </Link>
    </AuthCard>
  );
};

export default ForgotPasswordClient;
