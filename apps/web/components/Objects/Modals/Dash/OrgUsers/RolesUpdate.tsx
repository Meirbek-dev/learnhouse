'use client'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import FormLayout, {
  ButtonBlack,
  Flex,
  FormField,
  FormLabel,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { FormMessage } from '@radix-ui/react-form'
import { getAPIUrl } from '@services/config/config'
import { updateUserRole } from '@services/organizations/orgs'
import React, { useEffect } from 'react'
import toast from 'react-hot-toast'
import { BarLoader } from 'react-spinners'
import { mutate } from 'swr'
import { useTranslations } from 'next-intl'

interface Props {
  user: any
  setRolesModal: any
  alreadyAssignedRole: any
}

function RolesUpdate(props: Props) {
  const t = useTranslations('Components.RolesUpdate')
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [assignedRole, setAssignedRole] = React.useState(
    props.alreadyAssignedRole
  )
  const [error, setError] = React.useState<string | null>(null) as any

  const handleAssignedRole = (event: React.ChangeEvent<HTMLSelectElement>) => {
    setError(null)
    setAssignedRole(event.target.value)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsSubmitting(true)
    setError(null)
    const toastId = toast.loading(t('toastLoading'))
    try {
      const res = await updateUserRole(
        org.id,
        props.user.user.id,
        assignedRole,
        access_token
      )
      if (res.status === 200) {
        await mutate(`${getAPIUrl()}orgs/${org.id}/users`)
        props.setRolesModal(false)
        toast.success(t('toastSuccess'), { id: toastId })
      } else {
        const errorDetail = res.data?.detail || 'Unknown error'
        setError(t('updateErrorDetail', { error: errorDetail }))
        toast.error(t('toastError'), { id: toastId })
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'An unexpected error occurred'
      setError(t('updateErrorDetail', { error: errorMessage }))
      toast.error(t('toastError'), { id: toastId })
    } finally {
      setIsSubmitting(false)
    }
  }

  useEffect(() => {}, [assignedRole])

  return (
    <div>
      <FormLayout onSubmit={handleSubmit}>
        <FormField name="role-select">
          {error && (
            <div className="text-red-500 font-bold text-xs px-3 py-2 bg-red-100 rounded-md mb-2">
              {error}
            </div>
          )}
          <Flex
            css={{ alignItems: 'baseline', justifyContent: 'space-between' }}
          >
            <FormLabel>{t('rolesLabel')}</FormLabel>
            <FormMessage match="valueMissing">
              {t('selectRolePlaceholder')}
            </FormMessage>
          </Flex>
          <Form.Control asChild>
            <select
              onChange={handleAssignedRole}
              value={assignedRole}
              className="border border-gray-300 rounded-md p-2 w-full bg-white"
              required
            >
              <option value="role_global_admin">{t('adminRole')}</option>
              <option value="role_global_maintainer">
                {t('maintainerRole')}
              </option>
              <option value="role_global_user">{t('userRole')}</option>
            </select>
          </Form.Control>
        </FormField>
        <Flex css={{ marginTop: 25, justifyContent: 'flex-end' }}>
          <Form.Submit asChild>
            <ButtonBlack
              type="submit"
              css={{ marginTop: 10 }}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <BarLoader
                  cssOverride={{ borderRadius: 60 }}
                  width={60}
                  color="#ffffff"
                />
              ) : (
                t('updateButton')
              )}
            </ButtonBlack>
          </Form.Submit>
        </Flex>
      </FormLayout>
    </div>
  )
}

export default RolesUpdate
