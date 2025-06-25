'use client';
import { zodResolver } from '@hookform/resolvers/zod';
import { SiStripe } from '@icons-pack/react-simple-icons';
import {
  BarChart2,
  Coins,
  CreditCard,
  ExternalLink,
  Info,
  Loader2,
  RefreshCcw,
  Trash2,
  UnplugIcon,
} from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type { FC } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
import useSWR, { mutate } from 'swr';
import { z } from 'zod';

import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Button } from '@components/ui/button';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@components/ui/form';
import { Input } from '@components/ui/input';
import { getUriWithoutOrg } from '@services/config/config';
import {
  deletePaymentConfig,
  getPaymentConfigs,
  getStripeOnboardingLink,
  initializePaymentConfig,
  updateStripeAccountID,
} from '@services/payments/payments';

const PaymentsConfigurationPage: FC = () => {
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const _router = useRouter();
  const access_token = session?.data?.tokens?.access_token;
  const {
    data: paymentConfigs,
    error,
    isLoading,
  } = useSWR(
    () => (org && access_token ? [`/payments/${org.id}/config`, access_token] : null),
    ([_url, token]) => getPaymentConfigs(org.id, token),
  );

  const stripeConfig = paymentConfigs?.find((config: any) => config.provider === 'stripe');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(false);
  const t = useTranslations('Payments.Configuration');

  const enableStripe = async () => {
    const loadingToast = toast.loading(t('enablingStripe'));
    try {
      setIsOnboarding(true);
      const newConfig = { provider: 'stripe', enabled: true };
      const _config = await initializePaymentConfig(org.id, newConfig, 'stripe', access_token);
      toast.success(t('stripeEnabledSuccess'), { id: loadingToast });
      mutate([`/payments/${org.id}/config`, access_token]);
    } catch (error) {
      console.error('Error enabling Stripe:', error);
      toast.error(t('errors.enableStripeFailed'), { id: loadingToast });
    } finally {
      setIsOnboarding(false);
    }
  };

  const _editConfig = async () => {
    setIsModalOpen(true);
  };

  const deleteConfig = async () => {
    const loadingToast = toast.loading(t('deletingStripeConfig'));
    try {
      await deletePaymentConfig(org.id, stripeConfig.id, access_token);
      toast.success(t('stripeConfigDeletedSuccess'), { id: loadingToast });
      mutate([`/payments/${org.id}/config`, access_token]);
    } catch (error) {
      console.error('Error deleting Stripe configuration:', error);
      toast.error(t('errors.deleteStripeConfigFailed'), {
        id: loadingToast,
      });
    }
  };

  const handleStripeOnboarding = async () => {
    const loadingToast = toast.loading(t('startingStripeOnboarding'));
    try {
      setIsOnboardingLoading(true);
      const { connect_url } = await getStripeOnboardingLink(
        org.id,
        access_token,
        getUriWithoutOrg('/payments/stripe/connect/oauth'),
      );
      window.open(connect_url, '_blank');
      toast.dismiss(loadingToast);
    } catch (error) {
      console.error('Error getting onboarding link:', error);
      toast.error(t('errors.startStripeOnboardingFailed'), {
        id: loadingToast,
      });
    } finally {
      setIsOnboardingLoading(false);
    }
  };

  if (isLoading) {
    return <div>{t('loading')}</div>;
  }

  if (error) {
    return <div>{t('errorLoading')}</div>;
  }

  return (
    <div>
      <div className="nice-shadow mx-auto ml-10 mr-10 rounded-xl bg-white px-4 py-4">
        <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
          <h1 className="text-xl font-bold text-gray-800">{t('pageTitle')}</h1>
          <h2 className="text-md text-gray-500">{t('pageDescription')}</h2>
        </div>

        <Alert className="mb-3 border-2 border-blue-100 bg-blue-50/50 p-6">
          <AlertTitle className="mb-2 flex items-center space-x-2 text-lg font-semibold">
            <Info className="h-5 w-5" />
            <span>{t('aboutStripe.title')}</span>
          </AlertTitle>
          <AlertDescription className="space-y-5">
            <div className="pl-2">
              <ul className="list-inside list-disc space-y-1 pl-2 text-gray-600">
                <li className="flex items-center space-x-2">
                  <CreditCard className="h-4 w-4" />
                  <span>{t('aboutStripe.acceptPayments')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <RefreshCcw className="h-4 w-4" />
                  <span>{t('aboutStripe.manageSubscriptions')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <Coins className="h-4 w-4" />
                  <span>{t('aboutStripe.handleCurrencies')}</span>
                </li>
                <li className="flex items-center space-x-2">
                  <BarChart2 className="h-4 w-4" />
                  <span>{t('aboutStripe.accessAnalytics')}</span>
                </li>
              </ul>
            </div>
            <a
              href="https://stripe.com/docs"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center pl-2 font-medium text-blue-600 transition-colors duration-200 hover:text-blue-800"
            >
              {t('aboutStripe.learnMore')}
              <ExternalLink className="ml-1.5 h-4 w-4" />
            </a>
          </AlertDescription>
        </Alert>

        <div className="light-shadow flex flex-col rounded-lg">
          {stripeConfig ? (
            <div className="bg-linear-to-r flex items-center justify-between rounded-lg from-indigo-500 to-purple-600 p-6 shadow-md">
              <div className="flex items-center space-x-3">
                <SiStripe
                  className="text-white"
                  size={32}
                />
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    <span className="text-xl font-semibold text-white">Stripe</span>
                    {stripeConfig.provider_specific_id && stripeConfig.active ? (
                      <div className="flex items-center space-x-1 rounded-full bg-green-500/20 px-2 py-0.5">
                        <div className="h-2 w-2 rounded-full bg-green-500" />
                        <span className="text-xs text-green-100">{t('connectedStatus')}</span>
                      </div>
                    ) : (
                      <div className="flex items-center space-x-1 rounded-full bg-red-500/20 px-2 py-0.5">
                        <div className="h-2 w-2 rounded-full bg-red-500" />
                        <span className="text-xs text-red-100">{t('notConnectedStatus')}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-sm text-white/80">
                    {stripeConfig.provider_specific_id
                      ? `${t('linkedAccountLabel')}: ${stripeConfig.provider_specific_id}`
                      : t('accountNotConfigured')}
                  </span>
                </div>
              </div>
              <div className="flex space-x-2">
                {!(stripeConfig.provider_specific_id && stripeConfig.active) && (
                  <Button
                    onClick={handleStripeOnboarding}
                    className="flex items-center space-x-2 rounded-full border-2 border-green-400 bg-green-500 px-4 py-2 text-sm text-white shadow-md transition duration-300 hover:bg-green-600 disabled:cursor-not-allowed disabled:opacity-50"
                    disabled={isOnboardingLoading}
                  >
                    {isOnboardingLoading ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <UnplugIcon className="h-3 w-3" />
                    )}
                    <span className="font-semibold">{t('connectButton')}</span>
                  </Button>
                )}
                <ConfirmationModal
                  confirmationButtonText={t('removeConnectionButton')}
                  confirmationMessage={t('removeConnectionConfirmation')}
                  dialogTitle={t('removeConnectionTitle')}
                  dialogTrigger={
                    <Button className="flex items-center space-x-2 rounded-full bg-red-500 text-sm text-white transition duration-300 hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-50">
                      <Trash2 size={16} />
                      <span>{t('removeConnectionButton')}</span>
                    </Button>
                  }
                  functionToExecute={deleteConfig}
                  status="warning"
                />
              </div>
            </div>
          ) : (
            <Button
              onClick={enableStripe}
              className="bg-linear-to-r flex items-center justify-center space-x-2 rounded-lg from-indigo-500 to-purple-600 p-3 px-6 text-white shadow-md transition duration-300 hover:from-indigo-600 hover:to-purple-700 disabled:cursor-not-allowed disabled:opacity-50"
              disabled={isOnboarding}
            >
              {isOnboarding ? (
                <>
                  <Loader2
                    className="animate-spin"
                    size={24}
                  />
                  <span className="text-lg font-semibold">{t('connectingButton')}</span>
                </>
              ) : (
                <>
                  <SiStripe size={24} />
                  <span className="text-lg font-semibold">{t('enableButton')}</span>
                </>
              )}
            </Button>
          )}
        </div>
      </div>
      {stripeConfig && (
        <EditStripeConfigModal
          orgId={org.id}
          configId={stripeConfig.id}
          accessToken={access_token}
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
        />
      )}
    </div>
  );
};

interface EditStripeConfigModalProps {
  orgId: number;
  configId: string;
  accessToken: string;
  isOpen: boolean;
  onClose: () => void;
}

const createStripeConfigSchema = (t: (key: string) => string) =>
  z.object({
    stripeAccountId: z.string().min(1, t('stripeAccountIdRequired')),
  });

type StripeConfigFormValues = z.infer<ReturnType<typeof createStripeConfigSchema>>;

const EditStripeConfigModal: FC<EditStripeConfigModalProps> = ({ orgId, configId, accessToken, isOpen, onClose }) => {
  const t = useTranslations('Payments.Configuration');
  const validationSchema = createStripeConfigSchema(t);

  const form = useForm<StripeConfigFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: {
      stripeAccountId: '',
    },
  });

  useEffect(() => {
    const fetchConfig = async () => {
      try {
        const config = await getPaymentConfigs(orgId, accessToken);
        const stripeConfig = config.find((c: any) => c.id === configId);
        if (stripeConfig?.provider_specific_id) {
          form.setValue('stripeAccountId', stripeConfig.provider_specific_id || '');
        }
      } catch (error) {
        console.error('Error fetching Stripe configuration:', error);
        toast.error(t('errors.loadStripeConfigFailed'));
      }
    };

    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen, orgId, configId, accessToken, t, form]);

  const handleSubmit = async (values: StripeConfigFormValues) => {
    const loadingToast = toast.loading(t('updatingConfig'));
    try {
      const stripe_config = {
        stripe_account_id: values.stripeAccountId,
      };
      await updateStripeAccountID(orgId, stripe_config, accessToken);
      toast.success(t('configUpdatedSuccess'), { id: loadingToast });
      mutate([`/payments/${orgId}/config`, accessToken]);
      onClose();
    } catch (error) {
      console.error('Error updating config:', error);
      toast.error(t('errors.updateConfigFailed'), { id: loadingToast });
    }
  };

  return (
    <Modal
      isDialogOpen={isOpen}
      dialogTitle={t('editModalTitle')}
      dialogDescription={t('editModalDescription')}
      onOpenChange={onClose}
      dialogContent={
        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(handleSubmit)}
            className="space-y-4"
          >
            <FormField
              control={form.control}
              name="stripeAccountId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('stripeAccountIdLabel')}</FormLabel>
                  <FormControl>
                    <Input
                      type="text"
                      placeholder="acct_..."
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <div className="flex justify-end pt-4">
              <Button
                type="submit"
                className="rounded-lg bg-blue-500 px-4 py-2 text-white transition duration-300 hover:bg-blue-600"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting ? t('saving') : t('saveButton')}
              </Button>
            </div>
          </form>
        </Form>
      }
    />
  );
};

export default PaymentsConfigurationPage;
