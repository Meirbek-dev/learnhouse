'use client';

import type { components } from '@/lib/api/generated';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  ChevronUp,
  Info,
  Loader2,
  Pencil,
  Plus,
  RefreshCcw,
  SquareCheck,
} from 'lucide-react';
import { Select, SelectContent, SelectGroup, SelectItem, SelectTrigger, SelectValue } from '@components/ui/select';
import UnconfiguredPaymentsDisclaimer from '@components/Pages/Payments/UnconfiguredPaymentsDisclaimer';
import { archiveProduct, getProducts, updateProduct } from '@services/payments/products';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import ProductLinkedCourses from './SubComponents/ProductLinkedCourses';
import { Field, FieldError, FieldLabel } from '@components/ui/field';
import { getPaymentsProductsSwrKey } from '@services/payments/keys';
import CreateProductForm from './SubComponents/CreateProductForm';
import { getPaymentConfigs } from '@services/payments/payments';
import { usePaymentsEnabled } from '@hooks/usePaymentsEnabled';
import Modal from '@/components/Objects/Elements/Modal/Modal';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { Controller, useForm } from 'react-hook-form';
import type { SubmitHandler } from 'react-hook-form';
import { Textarea } from '@components/ui/textarea';
import { useState, useTransition } from 'react';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { Badge } from '@components/ui/badge';
import currencyCodes from '@/lib/currencies';
import { useTranslations } from 'next-intl';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';
import * as v from 'valibot';

type PaymentsConfigRead = components['schemas']['PaymentsConfigRead'];
type PaymentsProductRead = components['schemas']['PaymentsProductRead'];

const createValidationSchema = (t: (key: string, values?: any) => string) =>
  v.object({
    name: v.pipe(
      v.string(),
      v.minLength(
        1,
        t('Components.Form.requiredField', {
          fieldName: t('DashPage.Payments.ProductPage.editForm.nameLabel'),
        }),
      ),
    ),
    description: v.pipe(
      v.string(),
      v.minLength(
        1,
        t('Components.Form.requiredField', {
          fieldName: t('DashPage.Payments.ProductPage.editForm.descriptionLabel'),
        }),
      ),
    ),
    amount: v.pipe(v.number(), v.minValue(0, t('Components.Form.positiveNumber'))),
    benefits: v.optional(v.string()),
    currency: v.pipe(
      v.string(),
      v.minLength(
        1,
        t('Components.Form.requiredField', {
          fieldName: t('DashPage.Payments.ProductPage.editForm.currencyLabel'),
        }),
      ),
    ),
  });

type EditProductFormData = v.InferOutput<ReturnType<typeof createValidationSchema>>;

interface ArchiveProductButtonProps {
  productId: number;
  productName: string;
  onArchive: (productId: number) => Promise<void>;
  t: (key: string, values?: Record<string, string>) => string;
}

function ArchiveProductButton({ productId, productName, onArchive, t }: ArchiveProductButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleArchive = () => {
    startTransition(async () => {
      await onArchive(productId);
      setIsOpen(false);
    });
  };

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <AlertDialogTrigger
        render={
          <button
            className="text-destructive hover:text-destructive/80"
            title={t('archiveButton')}
          >
            <Archive size={16} />
          </button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <AlertTriangle className="text-destructive size-6" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('archiveConfirmationTitle', { productName })}</AlertDialogTitle>
          <AlertDialogDescription>{t('archiveConfirmationMessage')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} />
          <AlertDialogAction
            variant="destructive"
            onClick={handleArchive}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('archiveConfirmButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const PaymentsProductPage = () => {
  const session = usePlatformSession() as any;
  const accessToken = session?.data?.tokens?.access_token;
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});
  const { isEnabled, isLoading } = usePaymentsEnabled();
  const t = useTranslations('DashPage.Payments.ProductPage');

  const { data: products, error } = useSWR(
    () => (accessToken ? [getPaymentsProductsSwrKey(), accessToken] : null),
    ([_url, token]) => getProducts(token),
  );

  const { data: paymentConfigs, error: paymentConfigError } = useSWR(
    () => (accessToken ? ['/payments/config', accessToken] : null),
    ([_url, token]) => getPaymentConfigs(token),
  );

  const isStripeEnabled = paymentConfigs
    ? Boolean(paymentConfigs.find((config: PaymentsConfigRead) => config.provider === 'stripe'))
    : false;

  const handleArchiveProduct = async (productId: number) => {
    try {
      const res = await archiveProduct(productId, accessToken);
      mutate([getPaymentsProductsSwrKey(), accessToken]);
      if (res.status === 200) {
        toast.success(t('productArchivedSuccess'));
      } else {
        toast.error(
          t('errors.archiveProductFailed', {
            error: res.data?.message || '',
          }),
        );
      }
    } catch {
      toast.error(t('errors.archiveProductFailed', { error: '' }));
    }
  };

  const toggleProductExpansion = (productId: number) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  if (!(isEnabled || isLoading)) {
    return <UnconfiguredPaymentsDisclaimer />;
  }

  if (error) return <div>{t('loadError')}</div>;
  if (!products)
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="bg-muted text-muted-foreground flex animate-pulse items-center rounded-md px-4 py-2 text-sm font-medium">
          <Loader2
            size={16}
            className="mr-2 animate-spin"
          />
          <span>{t('loading')}</span>
        </div>
      </div>
    );

  const productItems = products.data ?? [];

  return (
    <div className="bg-muted h-full w-full">
      <div className="mx-auto pr-10 pl-10">
        <Modal
          isDialogOpen={isCreateModalOpen}
          onOpenChange={setIsCreateModalOpen}
          dialogTitle={t('createModalTitle')}
          dialogDescription={t('createModalDescription')}
          dialogContent={
            <CreateProductForm
              onSuccess={() => {
                setIsCreateModalOpen(false);
              }}
            />
          }
        />

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {productItems.map((product: PaymentsProductRead) => (
            <div
              key={product.id}
              className="bg-card ring-border flex h-full flex-col rounded-lg p-4 shadow-sm ring-1"
            >
              {editingProductId === product.id ? (
                <EditProductForm
                  product={product}
                  onSuccess={() => {
                    setEditingProductId(null);
                  }}
                  onCancel={() => {
                    setEditingProductId(null);
                  }}
                />
              ) : (
                <div className="flex h-full flex-col">
                  <div className="mb-2 flex items-start justify-between">
                    <div className="flex flex-col items-start space-y-1">
                      <Badge
                        className="flex w-fit items-center space-x-2"
                        variant="outline"
                      >
                        {product.product_type === 'subscription' ? <RefreshCcw size={12} /> : <SquareCheck size={12} />}
                        <span className="text-sm">
                          {product.product_type === 'subscription' ? t('subscriptionType') : t('oneTimeType')}
                        </span>
                      </Badge>
                      <h3 className="text-lg font-bold">{product.name}</h3>
                    </div>
                    <div className="flex space-x-2">
                      <button
                        onClick={() => {
                          setEditingProductId(product.id);
                        }}
                        className={`text-primary hover:text-primary/80 ${isStripeEnabled ? '' : 'cursor-not-allowed opacity-50'}`}
                        disabled={!isStripeEnabled}
                        title={t('editButton')}
                      >
                        <Pencil size={16} />
                      </button>
                      <ArchiveProductButton
                        productId={product.id}
                        productName={product.name}
                        onArchive={handleArchiveProduct}
                        t={t}
                      />
                    </div>
                  </div>
                  <div className="grow overflow-hidden">
                    <div
                      className={`transition-all duration-300 ease-in-out ${expandedProducts[product.id] ? 'max-h-[1000px]' : 'max-h-24'} overflow-hidden`}
                    >
                      <p className="text-muted-foreground">{product.description}</p>
                      {product.benefits ? (
                        <div className="mt-2">
                          <h4 className="text-foreground text-sm font-semibold">{t('benefitsLabel')}</h4>
                          <p className="text-muted-foreground text-sm">{product.benefits}</p>
                        </div>
                      ) : null}
                    </div>
                  </div>
                  <div className="mt-2">
                    <button
                      onClick={() => {
                        toggleProductExpansion(product.id);
                      }}
                      className="text-muted-foreground hover:text-foreground flex items-center text-sm"
                    >
                      {expandedProducts[product.id] ? (
                        <>
                          <ChevronUp size={16} />
                          <span>{t('showLess')}</span>
                        </>
                      ) : (
                        <>
                          <ChevronDown size={16} />
                          <span>{t('showMore')}</span>
                        </>
                      )}
                    </button>
                  </div>
                  <ProductLinkedCourses productId={product.id} />
                  <div className="bg-secondary/10 mt-2 flex items-center justify-between rounded-md p-2">
                    <span className="text-muted-foreground text-sm">{t('priceLabel')}</span>
                    <span className="text-foreground text-lg font-semibold">
                      {new Intl.NumberFormat(navigator.language, {
                        style: 'currency',
                        currency: product.currency,
                      }).format(product.amount)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        {productItems.length === 0 && (
          <div className="text-muted-foreground mx-auto mt-3 flex items-center space-x-2 font-semibold">
            <Info size={20} />
            <p>{t('noProducts')}</p>
          </div>
        )}

        <div className="flex items-center justify-center py-10">
          <button
            onClick={() => {
              setIsCreateModalOpen(true);
            }}
            className={`bg-primary text-primary-foreground mb-4 flex items-center space-x-2 rounded-lg border px-3 py-1.5 font-medium transition duration-300 ${
              isStripeEnabled ? 'hover:bg-primary/90' : 'cursor-not-allowed opacity-50'
            }`}
            disabled={!isStripeEnabled}
          >
            <Plus size={18} />
            <span className="text-sm font-bold">{t('createProductButton')}</span>
          </button>
        </div>
      </div>
    </div>
  );
};

const EditProductForm = ({
  product,
  onSuccess,
  onCancel,
}: {
  product: PaymentsProductRead;
  onSuccess: () => void;
  onCancel: () => void;
}) => {
  const session = usePlatformSession() as any;
  const currencies = currencyCodes.data.map((currency) => ({
    code: currency.code,
    name: `${currency.code} - ${currency.currency}`,
  }));
  const currencyItems = currencies.map((currency) => ({
    value: currency.code,
    label: currency.name,
  }));
  const t = useTranslations('DashPage.Payments.ProductPage.editForm');
  const validationSchema = createValidationSchema(t);

  const form = useForm<EditProductFormData>({
    resolver: valibotResolver(validationSchema),
    defaultValues: {
      name: product.name,
      description: product.description ?? '',
      amount: product.amount,
      benefits: product.benefits || '',
      currency: product.currency || '',
    },
    mode: 'onChange',
  });

  const handleSubmit: SubmitHandler<EditProductFormData> = async (values) => {
    try {
      await updateProduct(product.id, values, session.data?.tokens?.access_token);
      mutate([getPaymentsProductsSwrKey(), session.data?.tokens?.access_token]);
      onSuccess();
      toast.success(t('productUpdatedSuccess'));
    } catch {
      toast.error(t('updateProductFailed'));
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

        <div className="flex space-x-2">
          <div className="grow">
            <Controller
              control={form.control}
              name="amount"
              render={({ field, fieldState }) => (
                <Field>
                  <FieldLabel htmlFor={field.name}>{t('priceLabel')}</FieldLabel>
                  <Input
                    id={field.name}
                    type="number"
                    placeholder={t('pricePlaceholder')}
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

      <div className="flex justify-end space-x-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          {t('cancelButton')}
        </Button>
        <Button
          type="submit"
          disabled={form.formState.isSubmitting}
        >
          {form.formState.isSubmitting ? t('savingButton') : t('saveButton')}
        </Button>
      </div>
    </form>
  );
};

export default PaymentsProductPage;
