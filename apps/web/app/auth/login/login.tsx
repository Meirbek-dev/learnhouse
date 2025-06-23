'use client';
import FormLayout, { FormField, FormLabelAndMessage, Input } from '@components/Objects/StyledElements/Form/Form';
import { getUriWithOrg, getUriWithoutOrg } from '@services/config/config';
import { AlertTriangle, UserRoundPlus } from 'lucide-react';
import openuLogoDark from 'public/openu_logo_dark.png';
import * as Form from '@radix-ui/react-form';
import { useTranslations } from 'next-intl';
import { signIn } from 'next-auth/react';
import { useFormik } from 'formik';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface LoginClientProps {
  org: any;
}

const LoginClient = (props: LoginClientProps) => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Auth.Login');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (values: any) => {
    const errors: any = {};

    if (!values.email) {
      errors.email = validationT('required');
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
      errors.email = validationT('invalidEmail');
    }

    if (!values.password) {
      errors.password = validationT('required');
    } else if (values.password.length < 8) {
      errors.password = validationT('passwordMinLength', { length: 8 });
    }

    return errors;
  };

  const [error, setError] = useState('');
  const formik = useFormik({
    initialValues: {
      email: '',
      password: '',
    },
    validate,
    validateOnBlur: true,
    validateOnChange: true,
    onSubmit: async (values, { validateForm, setErrors, setSubmitting }) => {
      setIsSubmitting(true);
      const errors = await validateForm(values);
      if (Object.keys(errors).length > 0) {
        setErrors(errors);
        setSubmitting(false);
        return;
      }

      const res = await signIn('credentials', {
        redirect: false,
        email: values.email,
        password: values.password,
        callbackUrl: '/redirect_from_auth',
      });
      if (res?.error) {
        setError(t('wrongCredentials'));
        setIsSubmitting(false);
      } else {
        await signIn('credentials', {
          email: values.email,
          password: values.password,
          callbackUrl: '/redirect_from_auth',
        });
      }
    },
  });

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
                      placeholder={t('emailPlaceholder')}
                      disabled={isSubmitting}
                      autoComplete="email"
                      aria-describedby={formik.errors.email ? 'email-error' : undefined}
                    />
                  </Form.Control>
                </FormField>
                {/* for password  */}
                <FormField name="password">
                  <FormLabelAndMessage
                    label={t('password')}
                    message={formik.errors.password}
                  />

                  <Form.Control asChild>
                    <Input
                      onChange={formik.handleChange}
                      value={formik.values.password}
                      type="password"
                      placeholder={t('passwordPlaceholder')}
                      disabled={isSubmitting}
                      autoComplete="current-password"
                      aria-describedby={formik.errors.password ? 'password-error' : undefined}
                    />
                  </Form.Control>
                </FormField>
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
                  <Form.Submit asChild>
                    <button
                      className="w-full rounded-md bg-black p-2 text-center font-bold text-white shadow-md transition-all duration-200 hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50"
                      disabled={isSubmitting}
                      aria-label={isSubmitting ? t('loading') : t('login')}
                    >
                      {isSubmitting ? t('loading') : t('login')}
                    </button>
                  </Form.Submit>
                </div>
              </FormLayout>
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
                  disabled={isSubmitting}
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
