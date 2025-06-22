'use client';
import FormLayout, { FormField, FormLabelAndMessage, Input } from '@components/Objects/StyledElements/Form/Form';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUriWithOrg } from '@services/config/config';
import { sendResetLink } from '@services/auth/auth';
import { AlertTriangle, Info } from 'lucide-react';
import darkLogo from 'public/dark_logo.png';
import * as Form from '@radix-ui/react-form';
import { useTranslations } from 'next-intl';
import { useFormik } from 'formik';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Button } from '@components/ui/button';

function ForgotPasswordClient() {
  const t = useTranslations('Auth.Forgot');
  const org = useOrg() as any;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const validate = (values: any) => {
    const errors: any = {};

    if (!values.email) {
      errors.email = t('required');
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
      errors.email = t('invalidEmail');
    }

    return errors;
  };

  const formik = useFormik({
    initialValues: {
      email: '',
    },
    validate,
    validateOnBlur: true,
    onSubmit: async (values) => {
      setIsSubmitting(true);
      const res = await sendResetLink(values.email, org?.id);
      if (res.status == 200) {
        setMessage(t('checkEmail'));
      } else {
        setError(res.data.detail);
      }
      setIsSubmitting(false);
    },
  });
  return (
    <div className="grid h-screen grid-flow-col justify-stretch">
      <div className="flex h-screen flex-col items-center justify-center bg-neutral-100">
        <div className="border-2 bg-white px-10 py-6">
          <div className="flex justify-center pb-6">
            <Link
              prefetch
              href={getUriWithOrg(org?.slug, '/')}
            >
              <Image
                quality={100}
                width={230}
                height={100}
                src={darkLogo}
                alt="OpenU logo"
              />
            </Link>
          </div>
          <div className="left-login-part flex flex-row bg-white">
            <div className="m-auto w-72">
              <h1 className="mb-4 text-2xl font-bold">{t('title')}</h1>
              <p className="mb-4 text-sm">{t('enterEmailMessage')}</p>

              {error && (
                <div className="shadow-xs flex items-center justify-center space-x-2 rounded-md bg-red-200 p-4 text-red-950 transition-all">
                  <AlertTriangle size={18} />
                  <div className="text-sm font-bold">{error}</div>
                </div>
              )}
              {message && (
                <div className="shadow-xs flex items-center justify-center space-x-2 rounded-md bg-green-200 p-4 text-green-950 transition-all">
                  <Info size={18} />
                  <div className="text-sm font-bold">{t('checkEmail')}</div>
                </div>
              )}
              <FormLayout onSubmit={formik.handleSubmit}>
                <FormField name="email">
                  <FormLabelAndMessage
                    label={t('email')}
                    message={formik.errors.email}
                  />
                  <Form.Control asChild>
                    <Input
                      onChange={formik.handleChange}
                      value={formik.values.email}
                      type="email"
                      required
                      placeholder={t('emailPlaceholder')}
                      disabled={isSubmitting}
                      autoComplete="email"
                      aria-describedby={formik.errors.email ? 'email-error' : undefined}
                    />
                  </Form.Control>
                </FormField>
                <div className="flex py-4">
                  <Form.Submit asChild>
                    <Button
                      className="w-full p-2 font-semibold shadow-md transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSubmitting}
                      aria-label={isSubmitting ? t('loading') : t('sendResetLink')}
                    >
                      {isSubmitting ? t('loading') : t('sendResetLink')}
                    </Button>
                  </Form.Submit>
                </div>
              </FormLayout>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ForgotPasswordClient;
