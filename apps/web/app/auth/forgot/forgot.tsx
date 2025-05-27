'use client'
import Image from 'next/image'
import { useState } from 'react'
import openuIcon from 'public/openu_icon.png'
import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { getOrgLogoMediaDirectory } from '@services/media/media'
import { AlertTriangle, Info } from 'lucide-react'
import Link from 'next/link'
import { getUriWithOrg } from '@services/config/config'
import { useOrg } from '@components/Contexts/OrgContext'
import { useFormik } from 'formik'
import { sendResetLink } from '@services/auth/auth'
import { useTranslations } from 'next-intl'

function ForgotPasswordClient() {
  const t = useTranslations('Auth.Forgot')
  const validationT = useTranslations('Validation')
  const org = useOrg() as any
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const validate = (values: any) => {
    const errors: any = {}

    if (!values.email) {
      errors.email = validationT('required')
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
      errors.email = validationT('invalidEmail')
    }

    return errors
  }

  const formik = useFormik({
    initialValues: {
      email: '',
    },
    validate,
    validateOnBlur: true,
    onSubmit: async (values) => {
      setIsSubmitting(true)
      const res = await sendResetLink(values.email, org?.id)
      if (res.status == 200) {
        setMessage(t('checkEmail'))
      } else {
        setError(res.data.detail)
      }
      setIsSubmitting(false)
    },
  })
  return (
    <div className="grid h-screen grid-flow-col justify-stretch">
      <div
        className="right-login-part"
        style={{
          background:
            'linear-gradient(041.61deg, #202020 7.15%, #000000 90.96%)',
        }}
      >
        <div className="login-topbar m-10">
          <Link prefetch href={getUriWithOrg(org?.slug, '/')}>
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
                <img
                  src={`${getOrgLogoMediaDirectory(
                    org?.org_uuid,
                    org?.logo_image
                  )}`}
                  alt={org?.name}
                  style={{ width: 'auto', height: 70 }}
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
                />
              </Form.Control>
            </FormField>
            <div className="flex py-4">
              <Form.Submit asChild>
                <button className="w-full rounded-md bg-black p-2 text-center font-bold text-white shadow-md hover:cursor-pointer">
                  {isSubmitting ? t('loading') : t('sendResetLink')}
                </button>
              </Form.Submit>
            </div>
          </FormLayout>
        </div>
      </div>
    </div>
  )
}

export default ForgotPasswordClient
