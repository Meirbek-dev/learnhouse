'use client';

import type { components } from '@/lib/api/generated';

import UnconfiguredPaymentsDisclaimer from '@components/Pages/Payments/UnconfiguredPaymentsDisclaimer';
import { getUserAvatarMediaDirectory } from '@services/media/media';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { usePaymentsEnabled } from '@hooks/usePaymentsEnabled';
import { getCustomers } from '@services/payments/payments';
import UserAvatar from '@components/Objects/UserAvatar';
import type { ColumnDef } from '@tanstack/react-table';
import { RefreshCcw, SquareCheck } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import DataTable from '@components/ui/data-table';
import { Badge } from '@components/ui/badge';
import useSWR from 'swr';

type PaymentUserData = components['schemas']['PaymentsCustomerRead'];

const PaymentsUsersTable = ({ data }: { data: PaymentUserData[] }) => {
  const t = useTranslations('Payments.CustomersPage');
  const locale = useLocale();
  const columns: ColumnDef<PaymentUserData>[] = [
    {
      accessorFn: (item) =>
        [item.user?.first_name, item.user?.last_name, item.user?.username, item.user?.email].join(' '),
      id: 'user',
      header: t('userHeader'),
      cell: ({ row }) => (
        <div className="flex items-center space-x-3">
          <UserAvatar
            size="sm"
            variant="outline"
            avatar_url={
              row.original.user?.user_uuid && row.original.user?.avatar_image
                ? getUserAvatarMediaDirectory(row.original.user.user_uuid, row.original.user.avatar_image)
                : ''
            }
          />
          <div className="flex flex-col">
            <span className="font-medium">{row.original.user?.first_name || row.original.user?.username || '-'}</span>
            <span className="text-muted-foreground text-sm">{row.original.user?.email || '-'}</span>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'product.name',
      id: 'product',
      header: t('productHeader'),
      accessorFn: (item) => `${item.product?.name || ''} ${item.product?.description || ''}`,
      cell: ({ row }) => row.original.product?.name || '-',
    },
    {
      accessorFn: (item) => item.product?.product_type || '',
      id: 'type',
      header: t('typeHeader'),
      cell: ({ row }) => (
        <div className="flex items-center space-x-2">
          {row.original.product?.product_type === 'subscription' ? (
            <Badge
              variant="outline"
              className="flex items-center gap-1"
            >
              <RefreshCcw size={12} />
              <span>{t('subscriptionType')}</span>
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="flex items-center gap-1"
            >
              <SquareCheck size={12} />
              <span>{t('oneTimeType')}</span>
            </Badge>
          )}
        </div>
      ),
    },
    {
      accessorFn: (item) => item.product?.amount ?? 0,
      id: 'amount',
      header: t('amountHeader'),
      cell: ({ row }) => {
        if (!row.original.product) {
          return '-';
        }

        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: row.original.product.currency,
        }).format(row.original.product.amount);
      },
    },
    {
      accessorKey: 'status',
      header: t('statusHeader'),
      cell: ({ row }) => (
        <Badge
          variant={
            row.original.status === 'active' ? 'default' : row.original.status === 'completed' ? 'default' : 'secondary'
          }
        >
          {row.original.status}
        </Badge>
      ),
    },
    {
      accessorKey: 'creation_date',
      header: t('purchaseDateHeader'),
      cell: ({ row }) =>
        row.original.creation_date ? new Date(row.original.creation_date).toLocaleDateString(locale) : '-',
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={data}
      pageSize={10}
      storageKey="payments-customers"
      labels={{ emptyMessage: t('noCustomers') }}
    />
  );
};

const PaymentsCustomersPage = () => {
  const { isEnabled, isLoading } = usePaymentsEnabled();
  const t = useTranslations('Payments.CustomersPage');

  const { data: customers, error, isLoading: customersLoading } = useSWR('/payments/customers', () => getCustomers());

  if (!(isEnabled || isLoading)) {
    return <UnconfiguredPaymentsDisclaimer />;
  }

  if (isLoading || customersLoading) return <PageLoading />;
  if (error) return <div>{t('errors.loadCustomersFailed')}</div>;
  if (!customers) return <div>{t('noCustomerData')}</div>;

  return (
    <div className="soft-shadow border-border bg-card text-card-foreground mx-auto mr-10 ml-10 rounded-xl border px-4 py-4 shadow-sm">
      <div className="bg-muted mb-3 flex flex-col gap-1 rounded-md px-5 py-3">
        <h1 className="text-foreground text-xl font-bold">{t('title')}</h1>
        <h2 className="text-muted-foreground text-base">{t('description')}</h2>
      </div>

      <PaymentsUsersTable data={customers} />
    </div>
  );
};

export default PaymentsCustomersPage;
