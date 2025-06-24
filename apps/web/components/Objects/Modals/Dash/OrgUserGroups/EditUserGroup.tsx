'use client';
import * as Form from '@radix-ui/react-form';
import { useFormik } from 'formik';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { toast } from 'react-hot-toast';
import { mutate } from 'swr';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import FormLayout, { FormField, FormLabelAndMessage, Input } from '@components/Objects/StyledElements/Form/Form';
import { getAPIUrl } from '@services/config/config';
import { updateUserGroup } from '@services/usergroups/usergroups';

interface EditUserGroupProps {
  usergroup: {
    id: number;
    name: string;
    description: string;
  };
}

function EditUserGroup(props: EditUserGroupProps) {
  const t = useTranslations('Components.EditUserGroup');
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [isSubmitting, setIsSubmitting] = useState(false);

  const validate = (values: any) => {
    const errors: any = {};
    if (!values.name) {
      errors.name = t('nameRequiredError');
    }
    return errors;
  };

  const formik = useFormik({
    initialValues: {
      name: props.usergroup.name,
      description: props.usergroup.description,
    },
    validate,
    onSubmit: async (values) => {
      setIsSubmitting(true);
      const res = await updateUserGroup(props.usergroup.id, access_token, values);

      if (res.status == 200) {
        setIsSubmitting(false);
        toast.success(t('toastSuccess'));
        mutate(`${getAPIUrl()}usergroups/org/${org.id}`);
      } else {
        toast.error(t('toastError'));
        setIsSubmitting(false);
      }
    },
  });

  console.log(formik.errors.name);

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
          message={(formik.touched.description && formik.errors.description) || undefined}
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
            {isSubmitting ? t('loadingButton') : t('saveButton')}
          </button>
        </Form.Submit>
      </div>
    </FormLayout>
  );
}

export default EditUserGroup;
