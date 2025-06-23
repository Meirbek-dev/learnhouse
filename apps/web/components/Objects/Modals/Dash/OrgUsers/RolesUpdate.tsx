'use client';
import FormLayout, { ButtonBlack, Flex, FormField, FormLabel } from '@components/Objects/StyledElements/Form/Form';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { updateUserRole } from '@services/organizations/orgs';
import { useOrg } from '@components/Contexts/OrgContext';
import { getAPIUrl } from '@services/config/config';
import type { ChangeEvent, FormEvent } from 'react';
import { FormMessage } from '@radix-ui/react-form';
import * as Form from '@radix-ui/react-form';
import { useTranslations } from 'next-intl';
import { useState, useEffect } from 'react';
import { BarLoader } from 'react-spinners';
import toast from 'react-hot-toast';
import { mutate } from 'swr';

interface Props {
  user: any;
  setRolesModal: any;
  alreadyAssignedRole: any;
}

function RolesUpdate(props: Props) {
  const t = useTranslations('Components.RolesUpdate');
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [assignedRole, setAssignedRole] = useState(props.alreadyAssignedRole);
  const [error, setError] = useState<string | null>(null) as any;

  const handleAssignedRole = (event: ChangeEvent<HTMLSelectElement>) => {
    setError(null);
    setAssignedRole(event.target.value);
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    const toastId = toast.loading(t('toastLoading'));
    try {
      const res = await updateUserRole(org.id, props.user.user.id, assignedRole, access_token);
      if (res.status === 200) {
        await mutate(`${getAPIUrl()}orgs/${org.id}/users`);
        props.setRolesModal(false);
        toast.success(t('toastSuccess'), { id: toastId });
      } else {
        const errorDetail = res.data?.detail || 'Unknown error';
        setError(t('updateErrorDetail', { error: errorDetail }));
        toast.error(t('toastError'), { id: toastId });
      }
    } catch (error: any) {
      const errorMessage = error?.message || 'An unexpected error occurred';
      setError(t('updateErrorDetail', { error: errorMessage }));
      toast.error(t('toastError'), { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  };

  useEffect(() => {}, [assignedRole]);

  return (
    <div>
      <FormLayout onSubmit={handleSubmit}>
        <FormField name="role-select">
          {error && <div className="mb-2 rounded-md bg-red-100 px-3 py-2 text-xs font-bold text-red-500">{error}</div>}
          <Flex className="items-baseline justify-between">
            <FormLabel>{t('rolesLabel')}</FormLabel>
            <FormMessage match="valueMissing">{t('selectRolePlaceholder')}</FormMessage>
          </Flex>
          <Form.Control asChild>
            <select
              onChange={handleAssignedRole}
              value={assignedRole}
              className="w-full rounded-md border border-gray-300 bg-white p-2"
              required
            >
              <option value="role_global_admin">{t('adminRole')}</option>
              <option value="role_global_maintainer">{t('maintainerRole')}</option>
              <option value="role_global_user">{t('userRole')}</option>
            </select>
          </Form.Control>
        </FormField>
        <Flex className="mt-6 justify-end">
          <Form.Submit asChild>
            <ButtonBlack
              type="submit"
              className="mt-2.5"
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
  );
}

export default RolesUpdate;
