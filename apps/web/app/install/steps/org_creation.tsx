import FormLayout, {
  ButtonBlack,
  FormField,
  FormLabelAndMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { useFormik } from 'formik'
import { BarLoader } from 'react-spinners'
import { useState } from 'react'
import { swrFetcher } from '@services/utils/ts/requests'
import { getAPIUrl } from '@services/config/config'
import useSWR from 'swr'
import { createNewOrgInstall, updateInstall } from '@services/install/install'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTranslations } from 'next-intl'

function OrgCreation() {
  const t = useTranslations('Install.OrgCreation')
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const validationT = useTranslations('Validation')
  const {
    data: install,
    error: error,
    isLoading,
  } = useSWR(`${getAPIUrl()}install/latest`, (url) =>
    swrFetcher(url, access_token)
  )
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const router = useRouter()

  const validate = (values: any) => {
    const errors: any = {}

    if (!values.name) {
      errors.name = validationT('required')
    }

    if (!values.description) {
      errors.description = validationT('required')
    }

    if (!values.slug) {
      errors.slug = validationT('required')
    }

    if (!values.email) {
      errors.email = validationT('required')
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
      errors.email = validationT('invalidEmail')
    }

    return errors
  }

  function createOrgAndUpdateInstall(values: any) {
    try {
      createNewOrgInstall(values)
      const install_data = { ...install?.data, 1: values }
      updateInstall(install_data, 2)
      setTimeout(() => {
        setIsSubmitting(false)
        router.push('/install?step=2')
        setIsSubmitted(true)
      }, 2000)
    } catch (e) {
      console.error('Error creating org or updating install:', e)
      setIsSubmitting(false)
    }
  }

  const formik = useFormik({
    initialValues: {
      name: '',
      description: '',
      slug: '',
      email: '',
    },
    validate,
    onSubmit: (values) => {
      setIsSubmitting(true)
      createOrgAndUpdateInstall(values)
    },
  })
  return (
    <div>
      <FormLayout onSubmit={formik.handleSubmit}>
        <FormField name="name">
          <FormLabelAndMessage
            label={t('nameLabel')}
            message={formik.errors.name}
          />
          <Form.Control asChild>
            <Input
              onChange={formik.handleChange}
              value={formik.values.name}
              placeholder={t('namePlaceholder')}
              type="text"
              required
            />
          </Form.Control>
        </FormField>

        <FormField name="description">
          <FormLabelAndMessage
            label={t('descriptionLabel')}
            message={formik.errors.description}
          />

          <Form.Control asChild>
            <Input
              onChange={formik.handleChange}
              value={formik.values.description}
              placeholder={t('descriptionPlaceholder')}
              type="text"
              required
            />
          </Form.Control>
        </FormField>

        <FormField name="slug">
          <FormLabelAndMessage
            label={t('slugLabel')}
            message={formik.errors.slug}
          />

          <Form.Control asChild>
            <Input
              onChange={formik.handleChange}
              value={formik.values.slug}
              placeholder={t('slugPlaceholder')}
              type="text"
              required
            />
          </Form.Control>
        </FormField>
        {/* for username  */}
        <FormField name="email">
          <FormLabelAndMessage
            label={t('emailLabel')}
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

        <div className="flex flex-row-reverse py-4">
          <Form.Submit asChild>
            <ButtonBlack type="submit" css={{ marginTop: 10 }}>
              {isSubmitting ? (
                <BarLoader
                  cssOverride={{ borderRadius: 60 }}
                  width={60}
                  color="#ffffff"
                />
              ) : (
                t('createOrgButton')
              )}
            </ButtonBlack>
          </Form.Submit>
        </div>

        {isSubmitted && (
          <div className="flex space-x-3">
            {' '}
            <Check /> {t('orgCreatedSuccess')}
          </div>
        )}
      </FormLayout>
    </div>
  )
}

export default OrgCreation
