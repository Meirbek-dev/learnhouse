'use client';

import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { Field, FieldError, FieldLabel } from '@components/ui/field';
import { getPaymentsProductsSwrKey } from '@services/payments/keys';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { createProduct } from '@services/payments/products';
import { Controller, useForm } from 'react-hook-form';
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
    name: v.pipe(v.string(), v.minLength(1, t('Payments.ProductForm.errors.nameRequired'))),
    description: v.pipe(v.string(), v.minLength(1, t('Payments.ProductForm.errors.descriptionRequired'))),
    amount: v.pipe(v.number(), v.minValue(1, t('Payments.ProductForm.errors.amountMin'))),
    benefits: v.optional(v.string()),
    currency: v.pipe(v.string(), v.minLength(1, t('Payments.ProductForm.errors.currencyRequired'))),
    product_type: v.picklist(
      ['one_time', 'subscription'] as const,
      t('Payments.ProductForm.errors.productTypeRequired'),
    ),
    price_type: v.picklist(
      ['fixed_price', 'customer_choice'] as const,
      t('Payments.ProductForm.errors.priceTypeRequired'),
    ),
  });

type ProductFormValues = v.InferOutput<ReturnType<typeof createValidationSchema>>;

const CreateProductForm: FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const session = usePlatformSession() as any;
  const accessToken = session?.data?.tokens?.access_token;
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

  const form = useForm<ProductFormValues>({
    resolver: valibotResolver(validationSchema),
    defaultValues: {
      name: '',
      description: '',
      product_type: 'one_time',
      price_type: 'fixed_price',
      benefits: '',
      amount: 1,
      currency: 'KZT',
    },
    mode: 'onChange',
  });

  const productType = form.watch('product_type');
  const priceType = form.watch('price_type');

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

  const currencyItems = currencies.map((currency) => ({ value: currency.code, label: currency.name }));

  const handleSubmit = async (values: ProductFormValues) => {
    const loadingToast = toast.loading(tNotify('creatingProduct'));
    try {
      const res = await createProduct(values, accessToken);
      if (res.success) {
        toast.success(tNotify('productCreatedSuccess'), { id: loadingToast });
        mutate([getPaymentsProductsSwrKey(), accessToken]);
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
  };

  return (
    <form
      onSubmit={form.handleSubmit(handleSubmit)}
      className="space-y-4"
    >
      <div className="flex-col space-y-3 px-1.5 py-2">
        <Field>
          <FieldLabel htmlFor="name">{t('nameLabel')}</FieldLabel>
          <Input
            id="name"
            placeholder={t('namePlaceholder')}
            {...form.register('name')}
          />
          <FieldError errors={[form.formState.errors.name]} />
        </Field>

        <Field>
          <FieldLabel htmlFor="description">{t('descriptionLabel')}</FieldLabel>
          <Textarea
            id="description"
            placeholder={t('descriptionPlaceholder')}
            {...form.register('description')}
          />
          <FieldError errors={[form.formState.errors.description]} />
        </Field>

        <Controller
          control={form.control}
          name="product_type"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>{t('productTypeLabel')}</FieldLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
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
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <Controller
          control={form.control}
          name="price_type"
          render={({ field, fieldState }) => (
            <Field>
              <FieldLabel>{t('priceTypeLabel')}</FieldLabel>
              <Select
                onValueChange={field.onChange}
                value={field.value}
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
              <FieldError errors={[fieldState.error]} />
            </Field>
          )}
        />

        <div className="flex space-x-2">
          <div className="grow">
            <Controller
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>
                    {priceType === 'fixed_price' ? t('priceLabel') : t('minAmountLabel')}
                  </FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
                    placeholder={priceType === 'fixed_price' ? t('priceLabel') : t('minAmountLabel')}
                    {...field}
                    onChange={(e) => {
                      field.onChange(Number(e.target.value));
                    }}
                  />
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </div>
          <div className="w-1/3">
            <Controller
              control={form.control}
              name="currency"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel>{t('currencyLabel')}</FieldLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
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
                  <FieldError errors={[fieldState.error]} />
                </Field>
              )}
            />
          </div>
        </div>

        <Field>
          <FieldLabel htmlFor="benefits">{t('benefitsLabel')}</FieldLabel>
          <Textarea
            id="benefits"
            placeholder={t('benefitsPlaceholder')}
            {...form.register('benefits')}
          />
          <FieldError errors={[form.formState.errors.benefits]} />
        </Field>
      </div>

      <div className="flex justify-end">
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? t('submittingButton') : t('submitButton')}
        </Button>
      </div>
    </form>
  );
};

export default CreateProductForm;
