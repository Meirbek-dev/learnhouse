import FormLayout, {
  ButtonBlack,
  FormField,
  FormLabelAndMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { useFormik } from 'formik'
import { BarLoader } from 'react-spinners'
import React from 'react'
import { swrFetcher } from '@services/utils/ts/requests'
import { getAPIUrl } from '@services/config/config'
import useSWR from 'swr'
import { createNewOrgInstall, updateInstall } from '@services/install/install'
import { useRouter } from 'next/navigation'
import { Check } from 'lucide-react'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTranslations } from 'next-intl'

const validate = (values: any) => {
  const errors: any = {}

  if (!values.name) {
    errors.name = 'Required'
  }

  if (!values.description) {
    errors.description = 'Required'
  }

  if (!values.slug) {
    errors.slug = 'Required'
  }

  if (!values.email) {
    errors.email = 'Required'
  } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
    errors.email = 'Invalid email address'
  }

  return errors
}

function OrgCreation() {
  const t = useTranslations('Install.OrgCreation');
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const {
    data: install,
    error: error,
    isLoading,
  } = useSWR(`${getAPIUrl()}install/latest`, (url) => swrFetcher(url, access_token))
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [isSubmitted, setIsSubmitted] = React.useState(false)
  const router = useRouter()

  function createOrgAndUpdateInstall(values: any) {
    try {
      createNewOrgInstall(values)
      install.data = {
        1: values,
      }
      let install_data = { ...install.data, 1: values }
      updateInstall(install_data, 2)
      // await 2 seconds
      setTimeout(() => {
        setIsSubmitting(false)
      }, 2000)

      router.push('/install?step=2')
      setIsSubmitted(true)
    } catch (e) {}
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
      createOrgAndUpdateInstall(values)
    },
  })
  return (
    <div>
      <FormLayout onSubmit={formik.handleSubmit}>
        <FormField name="name">
          <FormLabelAndMessage label={t('nameLabel')} message={formik.errors.name} />
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
          <FormLabelAndMessage label={t('slugLabel')} message={formik.errors.slug} />

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
          <FormLabelAndMessage label={t('emailLabel')} message={formik.errors.email} />

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
