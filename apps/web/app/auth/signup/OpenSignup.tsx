'use client'
import { useFormik } from 'formik'
import { useState, useEffect } from 'react'
import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
  Textarea,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { AlertTriangle, Check, User } from 'lucide-react'
import Link from 'next/link'
import { signup } from '@services/auth/auth'
import { useOrg } from '@components/Contexts/OrgContext'
import { signIn } from 'next-auth/react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

function OpenSignUpComponent() {
  const validationT = useTranslations('Validation')
  const t = useTranslations('Auth.Signup')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const org = useOrg() as any
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const validate = (values: any) => {
    const errors: any = {}

    if (!values.email) {
      errors.email = validationT('required')
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
      errors.email = validationT('invalidEmail')
    }

    if (!values.password) {
      errors.password = validationT('required')
    } else if (values.password.length < 8) {
      errors.password = validationT('passwordMinLength', { length: 8 })
    }

    if (values.username.length < 4) {
      errors.username = validationT('usernameMinLength', { length: 4 })
    }

    if (!values.username) {
      errors.username = validationT('required')
    }

    if (!values.bio) {
      errors.bio = validationT('required')
    }

    return errors
  }

  const formik = useFormik({
    initialValues: {
      org_slug: org?.slug,
      org_id: org?.id,
      email: '',
      password: '',
      username: '',
      bio: '',
      first_name: '',
      last_name: '',
    },
    validate,
    enableReinitialize: true,
    onSubmit: async (values) => {
      setError('')
      setMessage('')
      setIsSubmitting(true)
      const res = await signup(values)
      const responseMessage = await res.json()
      if (res.status == 200) {
        //router.push(`/login`);
        setMessage(t('accountCreated'))
        setIsSubmitting(false)
      } else if (
        res.status == 401 ||
        res.status == 400 ||
        res.status == 404 ||
        res.status == 409
      ) {
        setError(responseMessage.detail)
      } else {
        setError(t('errorSomethingWentWrong'))
      }
      setIsSubmitting(false)
    },
  })

  useEffect(() => {}, [org])

  return (
    <div className="login-form m-auto w-72">
      {error && (
        <div className="shadow-xs flex items-center justify-center space-x-2 rounded-md bg-red-200 p-4 text-red-950 transition-all">
          <AlertTriangle size={18} />
          <div className="text-sm font-bold">{error}</div>
        </div>
      )}
      {message && (
        <div className="shadow-xs flex flex-col items-center justify-center space-x-2 space-y-4 rounded-md bg-green-200 p-4 text-green-950 transition-all">
          <div className="flex space-x-2">
            <Check size={18} />
            <div className="text-sm font-bold">{message}</div>
          </div>
          <hr className="800 w-40 border border-green-900/20" />
          <Link
            className="flex items-center space-x-2"
            href={`/login?orgslug=${org?.slug}`}
          >
            <User size={14} /> <div>{t('loginToAccount')}</div>
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
              placeholder={t('emailPlaceholder')}
              type="email"
              required
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
              placeholder={t('passwordPlaceholder')}
              type="password"
              required
            />
          </Form.Control>
        </FormField>
        {/* for username  */}
        <FormField name="username">
          <FormLabelAndMessage
            label={t('username')}
            message={formik.errors.username}
          />

          <Form.Control asChild>
            <Input
              onChange={formik.handleChange}
              value={formik.values.username}
              placeholder={t('usernamePlaceholder')}
              type="text"
              required
            />
          </Form.Control>
        </FormField>

        {/* for bio  */}
        <FormField name="bio">
          <FormLabelAndMessage label={t('bio')} message={formik.errors.bio} />

          <Form.Control asChild>
            <Textarea
              onChange={formik.handleChange}
              value={formik.values.bio}
              placeholder={t('bioPlaceholder')}
              required
            />
          </Form.Control>
        </FormField>

        <div className="flex py-4">
          <Form.Submit asChild>
            <button className="w-full rounded-md bg-black p-2 text-center font-bold text-white shadow-md hover:cursor-pointer">
              {isSubmitting ? t('loading') : t('createAccount')}
            </button>
          </Form.Submit>
        </div>
      </FormLayout>
      <div>
        <div className="mx-10 mb-5 mt-5 flex h-0.5 rounded-2xl bg-slate-100" />
        <button
          onClick={() => signIn('google')}
          className="text-md flex w-full justify-center space-x-3 rounded-md bg-white p-2 py-3 text-center font-semibold text-slate-600 shadow-sm hover:cursor-pointer"
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
  )
}

export default OpenSignUpComponent
