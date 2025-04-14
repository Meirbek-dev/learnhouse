'use client';
import React, { useEffect, useState } from 'react';
import { useOrg } from '@components/Contexts/OrgContext';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { createProduct } from '@services/payments/products';
import { Formik, Form, Field, ErrorMessage } from 'formik';
import * as Yup from 'yup';
import toast from 'react-hot-toast';
import { mutate } from 'swr';
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Textarea } from "@components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@components/ui/select";
import { Label } from "@components/ui/label";
import currencyCodes from 'currency-codes';
import { useTranslations } from 'next-intl';

const createValidationSchema = (t: (key: string, values?: any) => string) => Yup.object().shape({
  name: Yup.string().required(t('Payments.ProductForm.errors.nameRequired')),
  description: Yup.string().required(t('Payments.ProductForm.errors.descriptionRequired')),
  amount: Yup.number()
    .min(1, t('Payments.ProductForm.errors.amountMin'))
    .required(t('Payments.ProductForm.errors.amountRequired')),
  benefits: Yup.string(),
  currency: Yup.string().required(t('Payments.ProductForm.errors.currencyRequired')),
  product_type: Yup.string().oneOf(['one_time', 'subscription']).required(t('Payments.ProductForm.errors.productTypeRequired')),
  price_type: Yup.string().oneOf(['fixed_price', 'customer_choice']).required(t('Payments.ProductForm.errors.priceTypeRequired')),
});

interface ProductFormValues {
  name: string;
  description: string;
  product_type: 'one_time' | 'subscription';
  price_type: 'fixed_price' | 'customer_choice';
  benefits: string;
  amount: number;
  currency: string;
}

const CreateProductForm: React.FC<{ onSuccess: () => void }> = ({ onSuccess }) => {
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const [currencies, setCurrencies] = useState<{ code: string; name: string }[]>([]);
  const t = useTranslations('Payments.ProductForm');
  const tNotify = useTranslations('Notifications');
  const validationSchema = React.useMemo(() => createValidationSchema(t), [t]);

  useEffect(() => {
    const allCurrencies = currencyCodes.data.map(currency => ({
      code: currency.code,
      name: `${currency.code} - ${currency.currency}`
    }));
    setCurrencies(allCurrencies);
  }, []);

  const initialValues: ProductFormValues = {
    name: '',
    description: '',
    product_type: 'one_time',
    price_type: 'fixed_price',
    benefits: '',
    amount: 1,
    currency: 'USD',
  };

  const handleSubmit = async (values: ProductFormValues, { setSubmitting, resetForm }: any) => {
    const loadingToast = toast.loading(tNotify('creatingProduct'));
    try {
      const res = await createProduct(org.id, values, session.data?.tokens?.access_token);
      if (res.success) {
        toast.success(tNotify('productCreatedSuccess'), { id: loadingToast });
        mutate([`/payments/${org.id}/products`, session.data?.tokens?.access_token]);
        resetForm();
        onSuccess();
      } else {
        toast.error(tNotify('errors.createProductFailed'), { id: loadingToast });
      }
    } catch (error) {
      console.error('Error creating product:', error);
      toast.error(tNotify('errors.createProductError'), { id: loadingToast });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Formik
      initialValues={initialValues}
      validationSchema={validationSchema}
      onSubmit={handleSubmit}
    >
      {({ isSubmitting, values, setFieldValue }) => (
        <Form className="space-y-4">
          <div className='px-1.5 py-2 flex-col space-y-3'>
            <div>
              <Label htmlFor="name">{t('nameLabel')}</Label>
              <Field name="name" as={Input} placeholder={t('namePlaceholder')} />
              <ErrorMessage name="name" component="div" className="text-red-500 text-sm mt-1" />
            </div>

            <div>
              <Label htmlFor="description">{t('descriptionLabel')}</Label>
              <Field name="description" as={Textarea} placeholder={t('descriptionPlaceholder')} />
              <ErrorMessage name="description" component="div" className="text-red-500 text-sm mt-1" />
            </div>

            <div>
              <Label htmlFor="product_type">{t('productTypeLabel')}</Label>
              <Select
                value={values.product_type}
                onValueChange={(value) => setFieldValue('product_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('productTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="one_time">{t('productTypes.one_time')}</SelectItem>
                  <SelectItem value="subscription">{t('productTypes.subscription')}</SelectItem>
                </SelectContent>
              </Select>
              <ErrorMessage name="product_type" component="div" className="text-red-500 text-sm mt-1" />
            </div>

            <div>
              <Label htmlFor="price_type">{t('priceTypeLabel')}</Label>
              <Select
                value={values.price_type}
                onValueChange={(value) => setFieldValue('price_type', value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('priceTypePlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="fixed_price">{t('priceTypes.fixed_price')}</SelectItem>
                  {values.product_type !== 'subscription' && (
                    <SelectItem value="customer_choice">{t('priceTypes.customer_choice')}</SelectItem>
                  )}
                </SelectContent>
              </Select>
              <ErrorMessage name="price_type" component="div" className="text-red-500 text-sm mt-1" />
            </div>

            <div className="flex space-x-2">
              <div className="grow">
                <Label htmlFor="amount">
                  {values.price_type === 'fixed_price' ? t('priceLabel') : t('minAmountLabel')}
                </Label>
                <Field name="amount" as={Input} type="number" placeholder={values.price_type === 'fixed_price' ? t('priceLabel') : t('minAmountLabel')} />
                <ErrorMessage name="amount" component="div" className="text-red-500 text-sm mt-1" />
              </div>
              <div className="w-1/3">
                <Label htmlFor="currency">{t('currencyLabel')}</Label>
                <Select
                  value={values.currency}
                  onValueChange={(value) => setFieldValue('currency', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={t('currencyPlaceholder')} />
                  </SelectTrigger>
                  <SelectContent>
                    {currencies.map((currency) => (
                      <SelectItem key={currency.code} value={currency.code}>
                        {currency.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <ErrorMessage name="currency" component="div" className="text-red-500 text-sm mt-1" />
              </div>
            </div>

            <div>
              <Label htmlFor="benefits">{t('benefitsLabel')}</Label>
              <Field name="benefits" as={Textarea} placeholder={t('benefitsPlaceholder')} />
              <ErrorMessage name="benefits" component="div" className="text-red-500 text-sm mt-1" />
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t('submittingButton') : t('submitButton')}
            </Button>
          </div>
        </Form>
      )}
    </Formik>
  );
};

export default CreateProductForm;
