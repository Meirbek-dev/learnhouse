'use client';

import { useForm, useStore } from '@tanstack/react-form';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Field, FieldError, FieldLabel } from '@components/ui/field';
import { getPaymentsProductsSwrKey } from '@services/payments/keys';
import { createProduct } from '@services/payments/products';
import { Textarea } from '@components/ui/textarea';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import currencyCodes from '@/lib/currencies';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { toast } from 'sonner';
import * as v from 'valibot';
import { mutate } from 'swr';

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  v.object({
    name: v.pipe(
      v.string(),
      v.minLength(1, t("Payments.ProductForm.errors.nameRequired")),
    ),
    description: v.pipe(
      v.string(),
      v.minLength(1, t("Payments.ProductForm.errors.descriptionRequired")),
    ),
    amount: v.pipe(
      v.number(),
      v.minValue(1, t("Payments.ProductForm.errors.amountMin")),
    ),
    benefits: v.optional(v.string()),
    currency: v.pipe(
      v.string(),
      v.minLength(1, t("Payments.ProductForm.errors.currencyRequired")),
    ),
    product_type: v.picklist(
      ["one_time", "subscription"] as const,
      t("Payments.ProductForm.errors.productTypeRequired"),
    ),
    price_type: v.picklist(
      ["fixed_price", "customer_choice"] as const,
      t("Payments.ProductForm.errors.priceTypeRequired"),
    ),
  });

type ProductFormValues = v.InferOutput<ReturnType<typeof createValidationSchema>>;

const CreateProductForm: FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);
  const tNotify = useTranslations('DashPage.Notifications');
  const t = useTranslations('Payments.ProductForm');
  const validationSchema = createValidationSchema(t);

  useEffect(() => {
    const allCurrencies = currencyCodes.data.map((currency) => ({
      code: currency.code,
      name: `${currency.code} - ${currency.currency}`,
    }));
    setCurrencies(allCurrencies);
  }, []);

  const defaultValues: ProductFormValues = {
    name: '',
    description: '',
    product_type: 'one_time',
    price_type: 'fixed_price',
    benefits: '',
    amount: 1,
    currency: 'KZT',
  };

  const form = useForm({
    defaultValues,
    validators: {
      onChange: validationSchema,
      onSubmit: validationSchema,
    },
    onSubmit: async ({ value }) => {
      const loadingToast = toast.loading(tNotify('creatingProduct'));
      try {
        const res = await createProduct({
          ...value,
          benefits: value.benefits ?? '',
        });
        if (res.success) {
          toast.success(tNotify('productCreatedSuccess'), { id: loadingToast });
          mutate(getPaymentsProductsSwrKey());
          form.reset();
          onSuccess();
        } else {
          toast.error(tNotify('errors.createProductFailed'), {
            id: loadingToast,
          });
        }
      } catch (error) {
        console.error('Error creating product:', error);
        toast.error(tNotify('errors.createProductError'), { id: loadingToast });
      }
    },
  });

  const productType = useStore(form.store, (state) => state.values.product_type);
  const priceType = useStore(form.store, (state) => state.values.price_type);

  const productTypeItems = [
    { value: 'one_time', label: t('productTypes.one_time') },
    { value: 'subscription', label: t('productTypes.subscription') },
  ];

  const priceTypeOptions =
    productType !== 'subscription'
      ? [
          { value: 'fixed_price', label: t('priceTypes.fixed_price') },
          { value: 'customer_choice', label: t('priceTypes.customer_choice') },
        ]
      : [{ value: 'fixed_price', label: t('priceTypes.fixed_price') }];

  const currencyItems = currencies.map((currency) => ({
    value: currency.code,
    label: currency.name,
  }));

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        event.stopPropagation();
        void form.handleSubmit();
      }}
      className="space-y-4"
    >
      <div className="flex-col space-y-3 px-1.5 py-2">
        <form.Field name="name">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>{t('nameLabel')}</FieldLabel>
              <Input
                id={field.name}
                name={field.name}
                placeholder={t('namePlaceholder')}
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
              <FieldLabel htmlFor={field.name}>{t('descriptionLabel')}</FieldLabel>
              <Textarea
                id={field.name}
                name={field.name}
                placeholder={t('descriptionPlaceholder')}
                value={field.state.value}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>

        <form.Field name="product_type">
          {(field) => (
            <Field>
              <FieldLabel>{t('productTypeLabel')}</FieldLabel>
              <Select
                onValueChange={(value) => field.handleChange(value as ProductFormValues['product_type'])}
                value={field.state.value}
                items={productTypeItems}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('productTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {productTypeItems.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>

        <form.Field name="price_type">
          {(field) => (
            <Field>
              <FieldLabel>{t('priceTypeLabel')}</FieldLabel>
              <Select
                onValueChange={(value) => field.handleChange(value as ProductFormValues['price_type'])}
                value={field.state.value}
                items={priceTypeOptions}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('priceTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectGroup>
                    {priceTypeOptions.map((item) => (
                      <SelectItem
                        key={item.value}
                        value={item.value}
                      >
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectGroup>
                </SelectContent>
              </Select>
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>

        <div className="flex space-x-2">
          <div className="grow">
            <form.Field name="amount">
              {(field) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {priceType === 'fixed_price' ? t('priceLabel') : t('minAmountLabel')}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    name={field.name}
                    type="number"
                    placeholder={priceType === 'fixed_price' ? t('priceLabel') : t('minAmountLabel')}
                    value={field.state.value}
                    onBlur={field.handleBlur}
                    onChange={(event) => field.handleChange(Number(event.target.value))}
                  />
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </div>
          <div className="w-1/3">
            <form.Field name="currency">
              {(field) => (
                <Field>
                  <FieldLabel>{t('currencyLabel')}</FieldLabel>
                  <Select
                    onValueChange={(value) => {
                      if (value) {
                        field.handleChange(value);
                      }
                    }}
                    value={field.state.value}
                    items={currencyItems}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t('currencyPlaceholder')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        {currencyItems.map((currency) => (
                          <SelectItem
                            key={currency.value}
                            value={currency.value}
                          >
                            {currency.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FieldError errors={field.state.meta.errors} />
                </Field>
              )}
            </form.Field>
          </div>
        </div>

        <form.Field name="benefits">
          {(field) => (
            <Field>
              <FieldLabel htmlFor={field.name}>{t('benefitsLabel')}</FieldLabel>
              <Textarea
                id={field.name}
                name={field.name}
                placeholder={t('benefitsPlaceholder')}
                value={field.state.value ?? ''}
                onBlur={field.handleBlur}
                onChange={(event) => field.handleChange(event.target.value)}
              />
              <FieldError errors={field.state.meta.errors} />
            </Field>
          )}
        </form.Field>
      </div>

      <div className="flex justify-end">
        <form.Subscribe
          selector={(state) => [state.canSubmit, state.isSubmitting]}
          children={([canSubmit, isSubmitting]) => (
            <Button
              type="submit"
              disabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? t('submittingButton') : t('submitButton')}
            </Button>
          )}
        />
      </div>
    </form>
  );
};

export default CreateProductForm;
