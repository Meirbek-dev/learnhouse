'use client'
import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { getAPIUrl } from '@services/config/config'
import { createNewUserInstall, updateInstall } from '@services/install/install'
import { swrFetcher } from '@services/utils/ts/requests'
import { useFormik } from 'formik'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useRouter } from 'next/navigation'
import { useState } from 'react'
import { BarLoader } from 'react-spinners'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

// Define a type for the form values for better type safety
interface AccountCreationFormValues {
  org_slug: string
  email: string
  password: string
  confirmPassword: string
  username: string
}

function AccountCreation() {
  const t = useTranslations('Install.steps.ACCOUNT_CREATION') // Use specific step namespace
  const generalT = useTranslations('General')
  const validationT = useTranslations('Validation')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const {
    data: install,
    error: fetchError, // Rename to avoid conflict with formik errors
    isLoading,
  } = useSWR(
    access_token ? `${getAPIUrl()}install/latest` : null,
    (url) => swrFetcher(url, access_token),
    {
      revalidateOnFocus: false,
    }
  )
  const router = useRouter()

  const validate = (values: Omit<AccountCreationFormValues, 'org_slug'>) => {
    const errors: Partial<
      Record<keyof Omit<AccountCreationFormValues, 'org_slug'>, string>
    > = {} // More specific type

    if (!values.email) {
      errors.email = validationT('required')
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(values.email)) {
      errors.email = validationT('invalidEmail')
    }

    if (!values.password) {
      errors.password = validationT('required')
    } else if (values.password.length < 8) {
      // Use translation key with placeholder
      errors.password = validationT('passwordMinLength', { length: 8 })
    }

    if (!values.confirmPassword) {
      errors.confirmPassword = validationT('required')
    } else if (values.confirmPassword !== values.password) {
      errors.confirmPassword = validationT('passwordsDoNotMatch')
    }

    if (!values.username) {
      errors.username = validationT('required')
    } else if (values.username.length < 3) {
      // Use translation key with placeholder
      errors.username = validationT('usernameMinLength', { length: 3 })
    }

    return errors
  }

  const formik = useFormik<Omit<AccountCreationFormValues, 'org_slug'>>({
    // Use the specific type
    initialValues: {
      email: '',
      password: '',
      confirmPassword: '',
      username: '',
    },
    validate,
    validateOnBlur: true,
    validateOnChange: false,
    onSubmit: async (values) => {
      setIsSubmitting(true) // Set submitting state at the beginning
      if (!install?.data?.[1]?.slug) {
        console.error('Organization slug not found in install data.')
        // Handle error appropriately, e.g., show a toast message
        setIsSubmitting(false)
        return
      }

      // Prepare data carefully
      const finalValuesWithoutPasswords = {
        email: values.email,
        username: values.username,
        org_slug: install.data[1].slug,
      }

      // Ensure install.data is an object before spreading
      const installData =
        typeof install.data === 'object' && install.data !== null
          ? install.data
          : {}

      // Create install data update payload
      const installDataUpdatePayload = {
        ...installData,
        3: finalValuesWithoutPasswords, // Store non-sensitive info at step 3
      }

      try {
        // Update install status first
        await updateInstall(installDataUpdatePayload, 4) // Update current step to 4

        // Create the user
        await createNewUserInstall(
          {
            email: values.email,
            username: values.username,
            password: values.password, // Send password only to the user creation endpoint
          },
          install.data[1].slug
        )

        router.push('/install?step=4')
      } catch (error) {
        console.error('Error during account creation or install update:', error)
        // Handle error, e.g., show a toast message to the user
        // Optionally revert the install step if needed, though complex
      } finally {
        // Ensure isSubmitting is reset even if errors occur
        setIsSubmitting(false)
      }
    },
  })

  if (isLoading) return <div>{generalT('loading')}</div> // Basic loading state
  if (fetchError)
    return (
      <div>
        {generalT('error')}:{' '}
        {typeof fetchError === 'object' &&
        fetchError !== null &&
        'message' in fetchError
          ? String(fetchError.message)
          : String(fetchError)}
      </div>
    ) // Safely access error message

  return (
    <div>
      {/* Add a title for the form */}
      <h2 className="mb-4 text-xl font-semibold">{t('formTitle')}</h2>
      <FormLayout onSubmit={formik.handleSubmit}>
        <FormField name="email">
          {/* Use translation keys for labels */}
          <FormLabelAndMessage
            label={t('emailLabel')}
            message={
              formik.touched.email && formik.errors.email
                ? formik.errors.email
                : undefined
            }
          />
          <Form.Control asChild>
            <Input
              name="email" // Ensure name attribute is set
              onChange={formik.handleChange}
              onBlur={formik.handleBlur} // Add onBlur for touch status
              value={formik.values.email}
              placeholder={t('emailPlaceholder')} // Use translation key
              type="email"
              required
              aria-invalid={formik.touched.email && !!formik.errors.email} // Accessibility
              aria-describedby={
                formik.touched.email && formik.errors.email
                  ? 'email-error'
                  : undefined
              }
            />
          </Form.Control>
          {/* Optionally add error display specific to the field */}
          {formik.touched.email && formik.errors.email && (
            <span id="email-error" className="text-sm text-red-600">
              {formik.errors.email}
            </span>
          )}
        </FormField>

        <FormField name="password">
          <FormLabelAndMessage
            label={t('passwordLabel')} // Use translation key
            message={
              formik.touched.password && formik.errors.password
                ? formik.errors.password
                : undefined
            }
          />
          <Form.Control asChild>
            <Input
              name="password" // Ensure name attribute is set
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.password}
              placeholder={t('passwordPlaceholder')} // Use translation key
              type="password"
              required
              aria-invalid={formik.touched.password && !!formik.errors.password}
              aria-describedby={
                formik.touched.password && formik.errors.password
                  ? 'password-error'
                  : undefined
              }
            />
          </Form.Control>
          {formik.touched.password && formik.errors.password && (
            <span id="password-error" className="text-sm text-red-600">
              {formik.errors.password}
            </span>
          )}
        </FormField>

        <FormField name="confirmPassword">
          <FormLabelAndMessage
            label={t('confirmPasswordLabel')} // Use translation key
            message={
              formik.touched.confirmPassword && formik.errors.confirmPassword
                ? formik.errors.confirmPassword
                : undefined
            }
          />
          <Form.Control asChild>
            <Input
              name="confirmPassword" // Ensure name attribute is set
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.confirmPassword}
              placeholder={t('confirmPasswordPlaceholder')} // Use translation key
              type="password"
              required
              aria-invalid={
                formik.touched.confirmPassword &&
                !!formik.errors.confirmPassword
              }
              aria-describedby={
                formik.touched.confirmPassword && formik.errors.confirmPassword
                  ? 'confirmPassword-error'
                  : undefined
              }
            />
          </Form.Control>
          {formik.touched.confirmPassword && formik.errors.confirmPassword && (
            <span id="confirmPassword-error" className="text-sm text-red-600">
              {formik.errors.confirmPassword}
            </span>
          )}
        </FormField>

        <FormField name="username">
          <FormLabelAndMessage
            label={t('usernameLabel')} // Use translation key
            message={
              formik.touched.username && formik.errors.username
                ? formik.errors.username
                : undefined
            }
          />
          <Form.Control asChild>
            <Input
              name="username" // Ensure name attribute is set
              onChange={formik.handleChange}
              onBlur={formik.handleBlur}
              value={formik.values.username}
              placeholder={t('usernamePlaceholder')} // Use translation key
              type="text"
              required
              aria-invalid={formik.touched.username && !!formik.errors.username}
              aria-describedby={
                formik.touched.username && formik.errors.username
                  ? 'username-error'
                  : undefined
              }
            />
          </Form.Control>
          {formik.touched.username && formik.errors.username && (
            <span id="username-error" className="text-sm text-red-600">
              {formik.errors.username}
            </span>
          )}
        </FormField>

        <div className="flex flex-row-reverse py-4">
          <Form.Submit asChild>
            {/* Use ButtonBlack component if defined, otherwise standard button */}
            <button
              type="submit"
              className="rounded bg-black px-4 py-2 font-bold text-white hover:bg-gray-800 disabled:opacity-50"
              disabled={isSubmitting || !formik.isValid || !formik.dirty} // Disable when submitting or form invalid/pristine
              style={{ marginTop: 10 }} // Keep inline style if necessary
            >
              {isSubmitting ? (
                <BarLoader
                  cssOverride={{ borderRadius: 60 }}
                  width={60}
                  color="#ffffff"
                />
              ) : (
                t('createAdminButton') // Use translation key
              )}
            </button>
          </Form.Submit>
        </div>
      </FormLayout>
    </div>
  )
}

export default AccountCreation
