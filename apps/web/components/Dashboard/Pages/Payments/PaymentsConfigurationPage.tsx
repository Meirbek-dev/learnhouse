'use client';

import { useQueryClient } from '@tanstack/react-query';
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
  deletePaymentConfig,
  getStripeOnboardingLink,
  initializePaymentConfig,
  updateStripeAccountID,
} from '@services/payments/payments';
import { usePaymentConfigs } from '@/features/payments/hooks/usePayments';
import {
  AlertTriangle,
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
import { useEffect, useState, useTransition } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@components/ui/alert';
import { Field, FieldContent, FieldError, FieldLabel } from '@components/ui/field';
import { queryKeys } from '@/lib/react-query/queryKeys';
import Modal from '@/components/Objects/Elements/Modal/Modal';
import { valibotResolver } from '@hookform/resolvers/valibot';
import { SiStripe } from '@icons-pack/react-simple-icons';
import { getAbsoluteUrl } from '@services/config/config';
import { Controller, useForm } from 'react-hook-form';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import type { FC } from 'react';
import { toast } from 'sonner';
import * as v from 'valibot';

interface ConfirmDeleteStripeConfigProps {
  onDelete: () => Promise<void>;
  t: (key: string) => string;
}

function ConfirmDeleteStripeConfig({ onDelete, t }: ConfirmDeleteStripeConfigProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    startTransition(async () => {
      await onDelete();
      setIsOpen(false);
    });
  };

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <AlertDialogTrigger
        nativeButton
        render={
          <Button className="bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center space-x-2 rounded-full text-sm transition duration-300 disabled:cursor-not-allowed disabled:opacity-50">
            <Trash2 size={16} />
            <span>{t('removeConnectionButton')}</span>
          </Button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <AlertTriangle className="text-destructive size-6" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('removeConnectionTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('removeConnectionConfirmation')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} />
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('removeConnectionButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const PaymentsConfigurationPage: FC = () => {
  const queryClient = useQueryClient();
  const { data: paymentConfigs, error, isLoading } = usePaymentConfigs();

  const stripeConfig = paymentConfigs?.find((config: any) => config.provider === 'stripe');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isOnboarding, setIsOnboarding] = useState(false);
  const [isOnboardingLoading, setIsOnboardingLoading] = useState(false);
  const [_isPending, startTransition] = useTransition();
  const t = useTranslations('Payments.Configuration');

  const enableStripe = async () => {
    const loadingToast = toast.loading(t('enablingStripe'));
    try {
      setIsOnboarding(true);
      const newConfig = { provider: 'stripe' as const, enabled: true };
      const _config = await initializePaymentConfig(newConfig, 'stripe');
      toast.success(t('stripeEnabledSuccess'), { id: loadingToast });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payments.config() });
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
      if (!stripeConfig) {
        throw new Error('Stripe config not found');
      }

      await deletePaymentConfig(stripeConfig.id);
      toast.success(t('stripeConfigDeletedSuccess'), { id: loadingToast });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payments.config() });
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
      startTransition(() => setIsOnboardingLoading(true));
      const { connect_url } = await getStripeOnboardingLink(getAbsoluteUrl('/payments/stripe/connect/oauth'));
      window.open(connect_url, '_blank');
      toast.dismiss(loadingToast);
    } catch (error) {
      console.error('Error getting onboarding link:', error);
      toast.error(t('errors.startStripeOnboardingFailed'), {
        id: loadingToast,
      });
    } finally {
      startTransition(() => setIsOnboardingLoading(false));
    }
  };

  if (isLoading) {
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
  }

  if (error) {
    return <div>{t('errorLoading')}</div>;
  }

  return (
    <div>
      <div className="bg-card ring-border mx-auto mr-10 ml-10 rounded-xl p-4 shadow-sm ring-1">
        <div className="bg-muted mb-3 flex flex-col -space-y-1 rounded-md px-5 py-3">
          <h1 className="text-foreground text-xl font-bold">{t('pageTitle')}</h1>
          <h2 className="text-muted-foreground text-base">{t('pageDescription')}</h2>
        </div>

        <Alert className="border-primary/20 bg-primary/10 mb-3 border p-6">
          <AlertTitle className="mb-2 flex items-center space-x-2 text-lg font-semibold">
            <Info className="h-5 w-5" />
            <span>{t('aboutStripe.title')}</span>
          </AlertTitle>
          <AlertDescription className="space-y-5">
            <div className="pl-2">
              <ul className="text-muted-foreground list-inside list-disc space-y-1 pl-2">
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
              className="text-primary hover:text-primary/80 inline-flex items-center pl-2 font-medium transition-colors duration-200"
            >
              {t('aboutStripe.learnMore')}
              <ExternalLink className="ml-1.5 h-4 w-4" />
            </a>
          </AlertDescription>
        </Alert>

        <div className="subtle-shadow flex flex-col rounded-lg">
          {stripeConfig ? (
            <div className="bg-card flex items-center justify-between rounded-lg border p-6 shadow-sm">
              <div className="flex items-center space-x-3">
                <SiStripe
                  className="text-foreground"
                  size={32}
                />
                <div className="flex flex-col">
                  <div className="flex items-center space-x-2">
                    <span className="text-foreground text-xl font-semibold">Stripe</span>
                    {stripeConfig.provider_specific_id && stripeConfig.active ? (
                      <div className="flex items-center space-x-1 rounded-full bg-emerald-500/20 px-2 py-0.5">
                        <div className="h-2 w-2 rounded-full bg-emerald-500" />
                        <span className="text-foreground text-xs">{t('connectedStatus')}</span>
                      </div>
                    ) : (
                      <div className="bg-destructive/20 flex items-center space-x-1 rounded-full px-2 py-0.5">
                        <div className="bg-destructive h-2 w-2 rounded-full" />
                        <span className="text-destructive-foreground text-xs">{t('notConnectedStatus')}</span>
                      </div>
                    )}
                  </div>
                  <span className="text-muted-foreground text-sm">
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
                    className="border-primary/30 bg-primary text-primary-foreground hover:bg-primary/90 flex items-center space-x-2 rounded-full border px-4 py-2 text-sm shadow-md transition duration-300 disabled:cursor-not-allowed disabled:opacity-50"
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
                <ConfirmDeleteStripeConfig
                  onDelete={deleteConfig}
                  t={t}
                />
              </div>
            </div>
          ) : (
            <Button
              onClick={enableStripe}
              className="bg-primary text-primary-foreground hover:bg-primary/90 flex items-center justify-center space-x-2 rounded-lg p-3 px-6 shadow-sm transition duration-300 disabled:cursor-not-allowed disabled:opacity-50"
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
      {stripeConfig ? (
        <EditStripeConfigModal
          isOpen={isModalOpen}
          initialStripeAccountId={stripeConfig.provider_specific_id ?? ''}
          onClose={() => {
            setIsModalOpen(false);
          }}
        />
      ) : null}
    </div>
  );
};

interface EditStripeConfigModalProps {
  isOpen: boolean;
  initialStripeAccountId: string;
  onClose: () => void;
}

const createStripeConfigSchema = (t: (key: string) => string) =>
  v.object({
    stripeAccountId: v.pipe(v.string(), v.minLength(1, t('stripeAccountIdRequired'))),
  });

type StripeConfigFormValues = v.InferOutput<ReturnType<typeof createStripeConfigSchema>>;
type StripeConfigInputValues = v.InferInput<ReturnType<typeof createStripeConfigSchema>>;

const EditStripeConfigModal: FC<EditStripeConfigModalProps> = ({ isOpen, initialStripeAccountId, onClose }) => {
  const queryClient = useQueryClient();
  const t = useTranslations('Payments.Configuration');
  const validationSchema = createStripeConfigSchema(t);

  const form = useForm<StripeConfigInputValues, any, StripeConfigFormValues>({
    resolver: valibotResolver(validationSchema),
    defaultValues: {
      stripeAccountId: '',
    },
  });

  useEffect(() => {
    if (isOpen) {
      form.reset({ stripeAccountId: initialStripeAccountId });
    }
  }, [form, initialStripeAccountId, isOpen]);

  const handleSubmit = async (values: StripeConfigFormValues) => {
    const loadingToast = toast.loading(t('updatingConfig'));
    try {
      const stripe_config = {
        stripe_account_id: values.stripeAccountId,
      };
      await updateStripeAccountID(stripe_config);
      toast.success(t('configUpdatedSuccess'), { id: loadingToast });
      await queryClient.invalidateQueries({ queryKey: queryKeys.payments.config() });
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
        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          className="space-y-4"
        >
          <Controller
            control={form.control}
            name="stripeAccountId"
            render={({ field, fieldState }) => (
              <Field>
                <FieldLabel htmlFor={field.name}>{t('stripeAccountIdLabel')}</FieldLabel>
                <FieldContent>
                  <Input
                    id={field.name}
                    type="text"
                    placeholder="acct_..."
                    {...field}
                  />
                </FieldContent>
                <FieldError errors={[fieldState.error]} />
              </Field>
            )}
          />
          <div className="flex justify-end pt-4">
            <Button
              type="submit"
              className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-lg px-4 py-2 transition duration-300"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? t('saving') : t('saveButton')}
            </Button>
          </div>
        </form>
      }
    />
  );
};

export default PaymentsConfigurationPage;
