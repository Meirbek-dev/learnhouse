"use client";

import { Field, FieldError, FieldLabel } from "@components/ui/field";
import { useForm } from "@tanstack/react-form";
import { updateUserGroup } from "@services/usergroups/usergroups";
import { getAPIUrl } from "@services/config/config";
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import * as v from "valibot";
import { mutate } from "swr";
import { valibotFormValidator } from "@/lib/tanstack-form";

interface EditUserGroupProps {
  usergroup: {
    id: number;
    name: string;
    description: string;
  };
}

const createValidationSchema = (t: (key: string) => string) =>
  v.object({
    name: v.pipe(v.string(), v.minLength(1, t("nameRequiredError"))),
    description: v.optional(v.string()),
  });

type UserGroupFormValues = v.InferOutput<
  ReturnType<typeof createValidationSchema>
>;

const EditUserGroup = (props: EditUserGroupProps) => {
  const t = useTranslations("Components.EditUserGroup");
  const validationSchema = createValidationSchema(t);
  const formValidator = valibotFormValidator(validationSchema);

  const form = useForm({
    defaultValues: {
      name: props.usergroup.name,
      description: props.usergroup.description,
    },
    validators: {
      onChange: formValidator,
      onSubmit: formValidator,
    },
    onSubmit: async ({ value }) => {
      const res = await updateUserGroup(props.usergroup.id, value);

      if (res.status === 200) {
        toast.success(t("toastSuccess"));
        mutate(`${getAPIUrl()}usergroups`);
      } else {
        toast.error(t("toastError"));
      }
    },
  });

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <form.Field name="name">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>{t("nameLabel")}</FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              type="text"
              value={field.state.value}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <form.Field name="description">
        {(field) => (
          <Field>
            <FieldLabel htmlFor={field.name}>
              {t("descriptionLabel")}
            </FieldLabel>
            <Input
              id={field.name}
              name={field.name}
              type="text"
              value={field.state.value ?? ""}
              onBlur={field.handleBlur}
              onChange={(event) => field.handleChange(event.target.value)}
            />
            <FieldError errors={field.state.meta.errors} />
          </Field>
        )}
      </form.Field>

      <div className="flex py-4">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              className="w-full rounded-md p-2 text-center font-bold shadow-md hover:cursor-pointer"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? t("loadingButton") : t("saveButton")}
            </Button>
          )}
        />
      </div>
    </form>
  );
};

export default EditUserGroup;
