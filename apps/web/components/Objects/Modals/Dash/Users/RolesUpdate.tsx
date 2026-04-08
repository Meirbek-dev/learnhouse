'use client';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { useForm } from '@tanstack/react-form';
import { assignRoleToUser, removeRoleFromUser } from '@/services/rbac';
import { Field, FieldError, FieldLabel } from '@components/ui/field';
import { BarLoader } from '@components/Objects/Loaders/BarLoader';
import { Alert, AlertDescription } from '@components/ui/alert';
import { toFieldErrors, valibotFormValidator } from '@/lib/tanstack-form';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import { useState } from 'react';
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl';
import useSWR, { mutate } from 'swr';
import type { FC } from 'react';
import { toast } from 'sonner';
import * as v from 'valibot';

interface Props {
  user: any;
  setRolesModal: any;
  alreadyAssignedRole: string;
}
const createValidationSchema = (t: (key: string) => string) =>
  v.object({
    role: v.pipe(v.string(), v.minLength(1, t('roleRequired'))),
  });

interface FormData {
  role: string;
}

const RolesUpdate: FC<Props> = (props) => {
  const validationT = useTranslations('Validation');
  const t = useTranslations('Components.RolesUpdate');
  const validationSchema = createValidationSchema(validationT);
  const formValidator = valibotFormValidator(validationSchema);
  const [error, setError] = useState<any>(null);

  const form = useForm({
    defaultValues: {
      role: props.alreadyAssignedRole,
    },
    validators: {
      onChange: formValidator,
      onSubmit: formValidator,
    },
    onSubmit: async ({ value }) => {
      setError(null);

      const toastId = toast.loading(t('toastLoading'));
      try {
        const newRoleId = Number.parseInt(value.role, 10);
        const oldRoleId = Number.parseInt(props.alreadyAssignedRole, 10);
        const userId = props.user.user.id;

        if (!Number.isNaN(oldRoleId)) {
          await removeRoleFromUser(userId, oldRoleId);
        }
        await assignRoleToUser(userId, newRoleId);

        await mutate(`${getAPIUrl()}members`);
        props.setRolesModal(false);
        toast.success(t('toastSuccess'), { id: toastId });
      } catch (nextError: any) {
        const detail = nextError?.message ?? 'Unknown error';
        setError(detail);
        toast.error(t('toastError'), { id: toastId });
      }
    },
  });

  // Fetch available platform roles and sort them by system flag + priority
  const { data: roles, error: rolesError } = useSWR(`${getAPIUrl()}roles`, swrFetcher);

  const sortedRoles = (roles ?? []).toSorted((a: any, b: any) => {
    // System roles first, then by descending priority, then by name
    const aSystem = a.is_system ? 0 : 1;
    const bSystem = b.is_system ? 0 : 1;
    if (aSystem !== bSystem) return aSystem - bSystem;
    const aPriority = (a.priority ?? 0) * -1;
    const bPriority = (b.priority ?? 0) * -1;
    if (aPriority !== bPriority) return aPriority - bPriority;
    return (a.name || '').localeCompare(b.name || '');
  });

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            <strong>
              {t('errorPrefix')} {error.split(':')[0]}:{' '}
            </strong>
            {error.split(':').slice(1).join(':')}
          </AlertDescription>
        </Alert>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          event.stopPropagation();
          void form.handleSubmit();
        }}
        className="space-y-4"
      >
        <form.Field name="role">
          {(field) => (
            <Field>
              <FieldLabel>{t('rolesLabel')}</FieldLabel>
              <Select
                onValueChange={(value) => {
                  if (value) {
                    field.handleChange(value);
                  }
                }}
                value={field.state.value}
                disabled={!roles || rolesError}
                items={
                  !roles || rolesError
                    ? undefined
                    : sortedRoles.map((role: any) => ({
                        value: role.id.toString(),
                        label: role.name,
                      }))
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('selectRolePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {!roles || rolesError ? (
                    <div className="text-muted-foreground px-3 py-2">{t('loadingRoles')}</div>
                  ) : (
                    <SelectGroup>
                      {sortedRoles.map((role: any) => (
                        <SelectItem
                          key={role.id}
                          value={role.id.toString()}
                        >
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  )}
                </SelectContent>
              </Select>
              <FieldError errors={toFieldErrors(field.state.meta.errors)} />
            </Field>
          )}
        </form.Field>

        <div className="flex justify-end pt-4">
          <form.Subscribe
            selector={(state) => [state.canSubmit, state.isSubmitting]}
            children={([canSubmit, isSubmitting]) => (
              <Button
                type="submit"
                disabled={!canSubmit || isSubmitting || !roles || rolesError}
                className="min-w-[100px]"
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
              </Button>
            )}
          />
        </div>
      </form>
    </div>
  );
};

export default RolesUpdate;
