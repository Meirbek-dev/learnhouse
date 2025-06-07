'use client'
import FormLayout, {
  FormField,
  FormLabelAndMessage,
  Input,
} from '@components/Objects/StyledElements/Form/Form'
import * as Form from '@radix-ui/react-form'
import { useOrg } from '@components/Contexts/OrgContext'
import { useState } from 'react'
import { createUserGroup } from '@services/usergroups/usergroups'
import { mutate } from 'swr'
import { getAPIUrl } from '@services/config/config'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useFormik } from 'formik'
import toast from 'react-hot-toast'
import { useTranslations } from 'next-intl'

type AddUserGroupProps = {
  setCreateUserGroupModal: any
}

function AddUserGroup(props: AddUserGroupProps) {
  const t = useTranslations('Components.AddUserGroup')
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const [isSubmitting, setIsSubmitting] = useState(false)

  const validate = (values: any) => {
    const errors: any = {}
    if (!values.name) {
      errors.name = t('nameRequiredError')
    }
    return errors
  }

  const formik = useFormik({
    initialValues: {
      name: '',
      description: '',
      org_id: org.id,
    },
    validate,
    onSubmit: async (values) => {
      const toastID = toast.loading(t('toastLoading'))
      setIsSubmitting(true)
      const res = await createUserGroup(values, access_token)
      if (res.status == 200) {
        setIsSubmitting(false)
        mutate(`${getAPIUrl()}usergroups/org/${org.id}`)
        props.setCreateUserGroupModal(false)
        toast.success(t('toastSuccess'), { id: toastID })
      } else {
        setIsSubmitting(false)
        toast.error(t('toastError'), { id: toastID })
      }
    },
  })

  return (
    <FormLayout onSubmit={formik.handleSubmit}>
      <FormField name="name">
        <FormLabelAndMessage
          label={t('nameLabel')}
          message={(formik.touched.name && formik.errors.name) || undefined}
        />
        <Form.Control asChild>
          <Input
            onChange={formik.handleChange}
            value={formik.values.name}
            type="name"
            required
          />
        </Form.Control>
      </FormField>
      <FormField name="description">
        <FormLabelAndMessage
          label={t('descriptionLabel')}
          message={
            (formik.touched.description && formik.errors.description) ||
            undefined
          }
        />
        <Form.Control asChild>
          <Input
            onChange={formik.handleChange}
            value={formik.values.description}
            type="description"
          />
        </Form.Control>
      </FormField>
      <div className="flex py-4">
        <Form.Submit asChild>
          <button className="w-full rounded-md bg-black p-2 text-center font-bold text-white shadow-md hover:cursor-pointer">
            {isSubmitting ? t('loadingButton') : t('createButton')}
          </button>
        </Form.Submit>
      </div>
    </FormLayout>
  )
}

export default AddUserGroup
