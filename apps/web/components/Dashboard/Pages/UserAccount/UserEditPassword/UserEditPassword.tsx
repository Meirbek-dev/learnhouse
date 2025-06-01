'use client'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { updatePassword } from '@services/settings/password'
import { Formik, Form } from 'formik'
import { useMemo, useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'
import { Input } from '@components/ui/input'
import { Button } from '@components/ui/button'
import { Label } from '@components/ui/label'
import { toast } from 'react-hot-toast'
import { signOut } from 'next-auth/react'
import { getUriWithoutOrg } from '@services/config/config'
import * as Yup from 'yup'
import { useTranslations } from 'next-intl'

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  Yup.object().shape({
    old_password: Yup.string().required(
      t('DashPage.Notifications.Form.requiredField', {
        fieldName: t(
          'DashPage.UserAccountSettings.passwordSection.currentPasswordLabel'
        ),
      })
    ),
    new_password: Yup.string()
      .required(
        t('DashPage.Notifications.Form.requiredField', {
          fieldName: t(
            'DashPage.UserAccountSettings.passwordSection.newPasswordLabel'
          ),
        })
      )
      .min(8, t('DashPage.Notifications.Form.minChars', { count: 8 })),
  })

function UserEditPassword() {
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const t2 = useTranslations('DashPage.Notifications')
  const t = useTranslations(
    'DashPage.UserAccountSettings.UserAccount.EditPassword'
  )
  const validationSchema = useMemo(() => createValidationSchema(t2), [t2])

  const updatePasswordUI = async (values: any) => {
    const loadingToast = toast.loading(t2('updating'))
    try {
      const user_id = session.data.user.id
      const response = await updatePassword(user_id, values, access_token)

      if (response.success) {
        toast.dismiss(loadingToast)

        // Show success message and notify about logout
        toast.success(t2('passwordUpdateSuccess'), {
          duration: 4000,
        })
        toast(
          (t: any) => (
            <div className="flex items-center gap-2">
              <span>{t('promptLogoutOnPasswordChange')}</span>
            </div>
          ),
          {
            duration: 4000,
            icon: '🔑',
          }
        )

        // Wait for 4 seconds before signing out
        await new Promise((resolve) => setTimeout(resolve, 4000))
        signOut({ redirect: true, callbackUrl: getUriWithoutOrg('/') })
      } else {
        toast.error(t2('passwordUpdateError'), {
          id: loadingToast,
        })
      }
    } catch (error: any) {
      toast.error(t2('passwordUpdateError'), { id: loadingToast })
      console.error('Password update error:', error)
    }
  }

  useEffect(() => {}, [session])

  return (
    <div className="nice-shadow mx-0 rounded-xl bg-white sm:mx-10">
      <div className="flex flex-col">
        <div className="mx-3 my-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
          <h1 className="text-xl font-bold text-gray-800">{t('title')}</h1>
          <h2 className="text-md text-gray-500">{t('description')}</h2>
        </div>

        <div className="px-8 py-6">
          <Formik
            initialValues={{ old_password: '', new_password: '' }}
            validationSchema={validationSchema}
            onSubmit={(values, { setSubmitting }) => {
              setTimeout(() => {
                setSubmitting(false)
                updatePasswordUI(values)
              }, 400)
            }}
          >
            {({ isSubmitting, handleChange, errors, touched }) => (
              <Form className="mx-auto w-full max-w-2xl space-y-6">
                <div>
                  <Label htmlFor="old_password">
                    {t('currentPasswordLabel')}
                  </Label>
                  <Input
                    type="password"
                    id="old_password"
                    name="old_password"
                    onChange={handleChange}
                    className="mt-1"
                  />
                  {touched.old_password && errors.old_password && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.old_password}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="new_password">{t('newPasswordLabel')}</Label>
                  <Input
                    type="password"
                    id="new_password"
                    name="new_password"
                    onChange={handleChange}
                    className="mt-1"
                  />
                  {touched.new_password && errors.new_password && (
                    <p className="mt-1 text-sm text-red-500">
                      {errors.new_password}
                    </p>
                  )}
                </div>

                <div className="flex items-center space-x-2 rounded-md bg-amber-50 p-3 text-amber-600">
                  <AlertTriangle size={16} />
                  <span className="text-sm">{t('logoutWarning')}</span>
                </div>

                <div className="flex justify-end pt-2">
                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="bg-black text-white hover:bg-black/90"
                  >
                    {isSubmitting ? t('updatingButton') : t('updateButton')}
                  </Button>
                </div>
              </Form>
            )}
          </Formik>
        </div>
      </div>
    </div>
  )
}

export default UserEditPassword
