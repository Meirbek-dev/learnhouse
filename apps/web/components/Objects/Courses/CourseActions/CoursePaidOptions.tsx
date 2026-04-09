'use client';

import type { components } from '@/lib/api/generated';
import { useQuery } from '@tanstack/react-query';

import { getProductsByCourse, getStripeProductCheckoutSession } from '@services/payments/products';
import { ChevronDown, ChevronUp, Loader2, RefreshCcw, SquareCheck } from 'lucide-react';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { useAuth } from '@/hooks/useAuth';
import { getAbsoluteUrl } from '@services/config/config';
import { useState, useTransition } from 'react';
import { Button } from '@components/ui/button';
import { Badge } from '@components/ui/badge';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';

type PaymentsProductRead = components['schemas']['PaymentsProductRead'];

interface CoursePaidOptionsProps {
  course: {
    id: number;
  };
}

const CoursePaidOptions = ({ course }: CoursePaidOptionsProps) => {
  const t = useTranslations('Courses.CoursePaidOptions');
  const { user: currentUser } = useAuth();
  const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});
  const [isProcessing, setIsProcessing] = useState<Record<number, boolean>>({});
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const { data: linkedProducts, error } = useQuery({
    queryKey: queryKeys.payments.courseProducts(course.id),
    queryFn: () => getProductsByCourse(course.id),
  });

  const handleCheckout = async (productId: number) => {
    if (!currentUser) {
      // Redirect to login if user is not authenticated
      router.push('/signup');
      return;
    }

    try {
      startTransition(() => setIsProcessing((prev) => ({ ...prev, [productId]: true })));
      const redirect_uri = getAbsoluteUrl('/courses');
      const response = await getStripeProductCheckoutSession(productId, redirect_uri);

      if (response.success && response.data?.checkout_url) {
        router.push(response.data.checkout_url);
      } else {
        toast.error(t('checkoutError'));
      }
    } catch {
      toast.error(t('requestError'));
    } finally {
      startTransition(() => setIsProcessing((prev) => ({ ...prev, [productId]: false })));
    }
  };

  const toggleProductExpansion = (productId: number) => {
    setExpandedProducts((prev) => ({
      ...prev,
      [productId]: !prev[productId],
    }));
  };

  if (error) return <div>{t('failedToLoad')}</div>;
  if (!linkedProducts)
    return (
      <div className="flex items-center justify-center p-8">
        <div className="bg-muted text-muted-foreground flex animate-pulse items-center rounded-md px-4 py-2 text-sm font-medium">
          <Loader2
            size={16}
            className="mr-2 animate-spin"
          />
          <span>{t('loading')}</span>
        </div>
      </div>
    );

  const productItems = linkedProducts.data ?? [];

  return (
    <div className="space-y-4 p-1">
      {productItems.map((product: PaymentsProductRead) => (
        <div
          key={product.id}
          className="bg-card ring-border flex flex-col rounded-lg p-4 shadow-sm ring-1"
        >
          <div className="mb-2 flex items-start justify-between">
            <div className="flex flex-col items-start space-y-1">
              <Badge
                className="flex w-fit items-center space-x-2"
                variant="outline"
              >
                {product.product_type === 'subscription' ? <RefreshCcw size={12} /> : <SquareCheck size={12} />}
                <span className="text-muted-foreground text-sm">
                  {product.product_type === 'subscription' ? t('subscription') : t('oneTimePayment')}
                  {product.product_type === 'subscription' && ` ${t('perMonth')}`}
                </span>
              </Badge>
              <h3 className="text-foreground text-lg font-bold">{product.name}</h3>
            </div>
          </div>

          <div className="grow overflow-hidden">
            <div
              className={`transition-all duration-300 ease-in-out ${
                expandedProducts[product.id] ? 'max-h-[1000px]' : 'max-h-24'
              } overflow-hidden`}
            >
              <p className="text-muted-foreground">{product.description}</p>
              {product.benefits ? (
                <div className="mt-2">
                  <h4 className="text-foreground text-sm font-semibold">{t('benefits')}</h4>
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

          <div className="bg-secondary/10 mt-2 flex items-center justify-between rounded-md p-2">
            <span className="text-muted-foreground text-sm">
              {product.price_type === 'customer_choice' ? t('minimumPrice') : t('price')}
            </span>
            <div className="flex flex-col items-end">
              <span className="text-foreground text-lg font-semibold">
                {new Intl.NumberFormat('en-US', {
                  style: 'currency',
                  currency: product.currency,
                }).format(product.amount)}
                {product.product_type === 'subscription' && (
                  <span className="text-muted-foreground ml-1 text-sm">{t('perMonthSuffix')}</span>
                )}
              </span>
              {product.price_type === 'customer_choice' && (
                <span className="text-muted-foreground text-sm">{t('choosePrice')}</span>
              )}
            </div>
          </div>

          <Button
            className="mt-4 w-full"
            variant="default"
            onClick={() => handleCheckout(product.id)}
            disabled={isProcessing[product.id] || isPending}
          >
            {isProcessing[product.id]
              ? t('processing')
              : product.product_type === 'subscription'
                ? t('subscribeNow')
                : t('purchaseNow')}
          </Button>
        </div>
      ))}
    </div>
  );
};

export default CoursePaidOptions;
