'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import currencyCodes from 'currency-codes';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import { mutate } from 'swr';
import { z } from 'zod';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import { Button } from '@components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { Input } from '@components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import { Textarea } from '@components/ui/textarea';
import { createProduct } from '@services/payments/products';

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  z.object({
    name: z.string().min(1, t('Payments.ProductForm.errors.nameRequired')),
    description: z.string().min(1, t('Payments.ProductForm.errors.descriptionRequired')),
    amount: z.coerce.number().min(1, t('Payments.ProductForm.errors.amountMin')),
    benefits: z.string().optional(),
    currency: z.string().min(1, t('Payments.ProductForm.errors.currencyRequired')),
    product_type: z.enum(['one_time', 'subscription'], {
      errorMap: () => ({ message: t('Payments.ProductForm.errors.productTypeRequired') }),
    }),
    price_type: z.enum(['fixed_price', 'customer_choice'], {
      errorMap: () => ({ message: t('Payments.ProductForm.errors.priceTypeRequired') }),
    }),
  });

type ProductFormValues = z.infer<ReturnType<typeof createValidationSchema>>;

const CreateProductForm: FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);
  const tNotify = useTranslations('DashPage.Notifications');
  const t = useTranslations('Payments.ProductForm');
  const validationSchema = useMemo(() => createValidationSchema(t), [t]);

  useEffect(() => {
    const allCurrencies = currencyCodes.data.map((currency) => ({
      code: currency.code,
      name: `${currency.code} - ${currency.currency}`,
    }));
    setCurrencies(allCurrencies);
  }, []);

  const form = useForm<ProductFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      name: '',
      description: '',
      product_type: 'one_time',
      price_type: 'fixed_price',
      benefits: '',
      amount: 1,
      currency: 'KZT',
    },
  });

  const handleSubmit = async (values: ProductFormValues) => {
    const loadingToast = toast.loading(tNotify('creatingProduct'));
    try {
      const res = await createProduct(org.id, values, session.data?.tokens?.access_token);
      if (res.success) {
        toast.success(tNotify('productCreatedSuccess'), { id: loadingToast });
        mutate([`/payments/${org.id}/products`, session.data?.tokens?.access_token]);
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
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-4"
      >
        <div className="flex-col space-y-3 px-1.5 py-2">
          <FormField
            control={form.control}
            name="name"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('nameLabel')}</FormLabel>
                <FormControl>
                  <Input
                    placeholder={t('namePlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="description"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('descriptionLabel')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t('descriptionPlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="product_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('productTypeLabel')}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('productTypePlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="one_time">{t('productTypes.one_time')}</SelectItem>
                    <SelectItem value="subscription">{t('productTypes.subscription')}</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="price_type"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('priceTypeLabel')}</FormLabel>
                <Select
                  onValueChange={field.onChange}
                  defaultValue={field.value}
                >
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder={t('priceTypePlaceholder')} />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="fixed_price">{t('priceTypes.fixed_price')}</SelectItem>
                    {form.watch('product_type') !== 'subscription' && (
                      <SelectItem value="customer_choice">{t('priceTypes.customer_choice')}</SelectItem>
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <div className="flex space-x-2">
            <div className="grow">
              <FormField
                control={form.control}
                name="amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {form.watch('price_type') === 'fixed_price' ? t('priceLabel') : t('minAmountLabel')}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        placeholder={form.watch('price_type') === 'fixed_price' ? t('priceLabel') : t('minAmountLabel')}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <div className="w-1/3">
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('currencyLabel')}</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      defaultValue={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('currencyPlaceholder')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {currencies.map((currency) => (
                          <SelectItem
                            key={currency.code}
                            value={currency.code}
                          >
                            {currency.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <FormField
            control={form.control}
            name="benefits"
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('benefitsLabel')}</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder={t('benefitsPlaceholder')}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
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
    </Form>
  );
};

export default CreateProductForm;
