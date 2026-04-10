'use client';

import { useStripeConnectionVerification } from '@/features/payments/hooks/usePayments';
import { useSession } from '@/hooks/useSession';
import { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Check, Loader2 } from 'lucide-react';
import platformLogo from '@public/platform_logo.svg';
import { useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion } from 'motion/react';
import Image from 'next/image';
import { toast } from 'sonner';

const StripeConnectCallback = () => {
  const t = useTranslations('Stripe');
  const searchParams = useSearchParams();
  const { isAuthenticated } = useSession();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('');
  const closeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resultHandledRef = useRef(false);
  const code = searchParams.get('code');
  const verificationQuery = useStripeConnectionVerification(code, {
    enabled: isAuthenticated,
  });

  useEffect(() => {
    if (!isAuthenticated) return;

    if (!code) {
      setStatus('error');
      setMessage(t('missingParameters'));
      return;
    }

    if (verificationQuery.isPending) {
      setStatus('processing');
      setMessage('');
      return;
    }

    if (resultHandledRef.current) return;

    if (verificationQuery.isError) {
      resultHandledRef.current = true;
      console.error('Error verifying Stripe connection:', verificationQuery.error);
      setStatus('error');
      setMessage(t('connectionFailed'));
      toast.error(t('connectError'));
      return;
    }

    if (!verificationQuery.isSuccess) return;

    resultHandledRef.current = true;

    const successTimeout = globalThis.setTimeout(() => {
      setStatus('success');
      setMessage(t('connectionSuccess'));

      closeTimeoutRef.current = globalThis.setTimeout(() => {
        window.close();
      }, 2000);
    }, 1000);

    return () => {
      clearTimeout(successTimeout);
    };
  }, [code, isAuthenticated, t, verificationQuery.error, verificationQuery.isError, verificationQuery.isPending, verificationQuery.isSuccess]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) clearTimeout(closeTimeoutRef.current);
    };
  }, []);

  return (
    <div className="bg-background text-foreground flex h-screen w-full items-center justify-center">
      <div className="flex flex-col items-center">
        <div className="mb-10">
          <Image
            quality={100}
            width={50}
            height={50}
            src={platformLogo}
            alt="Ashyq Bilim logo"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="soft-shadow border-border bg-card text-card-foreground mx-4 w-full max-w-md rounded-xl border p-8 shadow-sm"
        >
          <div className="flex flex-col items-center gap-4 text-center">
            {status === 'processing' && (
              <>
                <Loader2 className="text-primary h-12 w-12 animate-spin" />
                <h2 className="text-foreground text-xl font-semibold">{t('completing')}</h2>
                <p className="text-muted-foreground">{t('pleaseWait')}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="bg-primary/10 rounded-full p-3">
                  <Check className="text-primary h-8 w-8" />
                </div>
                <h2 className="text-foreground text-xl font-semibold">{message}</h2>
                <p className="text-muted-foreground">{t('returnToDashboard')}</p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="bg-destructive/10 rounded-full p-3">
                  <AlertTriangle className="text-destructive h-8 w-8" />
                </div>
                <h2 className="text-foreground text-xl font-semibold">{message}</h2>
                <p className="text-muted-foreground">{t('tryAgainOrContact')}</p>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default StripeConnectCallback;
