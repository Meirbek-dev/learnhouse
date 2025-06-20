'use client';
import FormLayout, { FormField, FormLabelAndMessage, Input } from '@components/Objects/StyledElements/Form/Form';
import { getUriWithOrg, getUriWithoutOrg } from '@services/config/config';
import { getOrgLogoMediaDirectory } from '@services/media/media';
import { useOrg } from '@components/Contexts/OrgContext';
import { resetPassword } from '@services/auth/auth';
import { AlertTriangle, Info } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import openuIcon from 'public/openu_icon.png';
import * as Form from '@radix-ui/react-form';
import { useTranslations } from 'next-intl';
import { useFormik } from 'formik';
import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';

function ResetPasswordClient() {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Auth.Reset');
  const org = useOrg() as any;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchParams = useSearchParams();
  const reset_code = searchParams.get('resetCode') || '';
  const email = searchParams.get('email') || '';
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const validate = (values: any) => {
    const errors: any = {};

    if (!values.email) {
      errors.email = validationT('required');
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
      errors.email = validationT('invalidEmail');
    }

    if (!values.new_password) {
      errors.new_password = validationT('required');
    } else if (values.new_password.length < 8) {
      errors.new_password = validationT('passwordMinLength', { length: 8 });
    }

    if (!values.confirm_password) {
      errors.confirm_password = validationT('required');
    }

    if (values.new_password !== values.confirm_password) {
      errors.confirm_password = validationT('passwordsDoNotMatch');
    }

    if (!values.reset_code) {
      errors.reset_code = validationT('required');
    }
    return errors;
  };

  const formik = useFormik({
    initialValues: {
      email: email,
      new_password: '',
      confirm_password: '',
      reset_code: reset_code,
    },
    validate,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setIsSubmitting(true);
      const res = await resetPassword(values.email, values.new_password, org?.id, values.reset_code);
      if (res.status == 200) {
        setMessage(t('success'));
      } else {
        setError(res.data.detail);
      }
      setIsSubmitting(false);
    },
  });
  return (
    <div className="grid h-screen grid-flow-col justify-stretch">
      <div
        className="right-login-part"
        style={{
          background: 'linear-gradient(041.61deg, #202020 7.15%, #000000 90.96%)',
        }}
      >
        <div className="login-topbar m-10">
          <Link
            prefetch
            href={getUriWithOrg(org?.slug, '/')}
          >
            <Image
              quality={100}
              width={30}
              height={30}
              src={openuIcon}
              alt=""
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
                  src={openuIcon}
                  alt=""
                />
              )}
            </div>
            <div className="text-xl font-bold">{org?.name}</div>
          </div>
        </div>
      </div>
      <div className="left-login-part flex flex-row bg-white">
        <div className="login-form m-auto w-72">
          <h1 className="mb-4 text-2xl font-bold">{t('title')}</h1>
          <p className="mb-4 text-sm">{t('enterResetDetails')}</p>

          {error && (
            <div className="shadow-xs flex items-center justify-center space-x-2 rounded-md bg-red-200 p-4 text-red-950 transition-all">
              <AlertTriangle size={18} />
              <div className="text-sm font-bold">{error}</div>
            </div>
          )}
          {message && (
            <div className="flex flex-col gap-2">
              <div className="shadow-xs flex items-center justify-center space-x-2 rounded-md bg-green-200 p-4 text-green-950 transition-all">
                <Info size={18} />
                <div className="text-sm font-bold">{t('success')}</div>
              </div>
              <Link
                href={getUriWithoutOrg(`/login?orgslug=${org.slug}`)}
                className="text-center text-sm text-blue-600 hover:text-blue-800"
              >
                {t('loginAgain')}
              </Link>
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
                />
              </Form.Control>
            </FormField>

            <FormField name="reset_code">
              <FormLabelAndMessage
                label={t('resetCode')}
                message={formik.errors.reset_code}
              />
              <Form.Control asChild>
                <Input
                  onChange={formik.handleChange}
                  value={formik.values.reset_code}
                  type="text"
                  placeholder={t('resetCodePlaceholder')}
                />
              </Form.Control>
            </FormField>

            <FormField name="new_password">
              <FormLabelAndMessage
                label={t('newPassword')}
                message={formik.errors.new_password}
              />
              <Form.Control asChild>
                <Input
                  onChange={formik.handleChange}
                  value={formik.values.new_password}
                  type="password"
                  placeholder={t('newPasswordPlaceholder')}
                />
              </Form.Control>
            </FormField>

            <FormField name="confirm_password">
              <FormLabelAndMessage
                label={t('confirmPassword')}
                message={formik.errors.confirm_password}
              />
              <Form.Control asChild>
                <Input
                  onChange={formik.handleChange}
                  value={formik.values.confirm_password}
                  type="password"
                  placeholder={t('confirmPasswordPlaceholder')}
                />
              </Form.Control>
            </FormField>

            <div className="flex py-4">
              <Form.Submit asChild>
                <button className="w-full rounded-md bg-black p-2 text-center font-bold text-white shadow-md hover:cursor-pointer">
                  {isSubmitting ? t('loading') : t('changePassword')}
                </button>
              </Form.Submit>
            </div>
          </FormLayout>
        </div>
      </div>
    </div>
  );
}

export default ResetPasswordClient;
