'use client';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { verifyStripeConnection } from '@services/payments/payments';
import { useRouter, useSearchParams } from 'next/navigation';
import { Check, Loader2, AlertTriangle } from 'lucide-react';
import touEmblemDark from 'public/tou_emblem_dark.png';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import Image from 'next/image';

function StripeConnectCallback() {
  const t = useTranslations('Stripe');
  const router = useRouter();
  const searchParams = useSearchParams();
  const session = useLHSession() as any;
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('');

  useEffect(() => {
    const verifyConnection = async () => {
      try {
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const orgId = state?.split('=')[1]; // Extract org_id value after '='

        if (!(code && orgId)) {
          throw new Error(t('missingParameters'));
        }

        const _response = await verifyStripeConnection(
          Number.parseInt(orgId, 10),
          code,
          session?.data?.tokens?.access_token,
        );

        await new Promise((resolve) => setTimeout(resolve, 1000));

        setStatus('success');
        setMessage(t('connectionSuccess'));

        setTimeout(() => {
          window.close();
        }, 2000);
      } catch (error) {
        console.error('Error verifying Stripe connection:', error);
        setStatus('error');
        setMessage(t('connectionFailed'));
        toast.error(t('connectError'));
      }
    };

    if (session) {
      verifyConnection();
    }
  }, [session, router, searchParams, t]);

  return (
    <div className="flex h-screen w-full items-center justify-center bg-[#f8f8f8]">
      <div className="flex flex-col items-center">
        <div className="mb-10">
          <Image
            quality={100}
            width={50}
            height={50}
            src={touEmblemDark}
            alt="OpenU logo"
          />
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="nice-shadow mx-4 w-full max-w-md rounded-xl bg-white p-8"
        >
          <div className="flex flex-col items-center space-y-4 text-center">
            {status === 'processing' && (
              <>
                <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
                <h2 className="text-xl font-semibold text-gray-800">{t('completing')}</h2>
                <p className="text-gray-500">{t('pleaseWait')}</p>
              </>
            )}

            {status === 'success' && (
              <>
                <div className="rounded-full bg-green-100 p-3">
                  <Check className="h-8 w-8 text-green-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">{message}</h2>
                <p className="text-gray-500">{t('returnToDashboard')}</p>
              </>
            )}

            {status === 'error' && (
              <>
                <div className="rounded-full bg-red-100 p-3">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <h2 className="text-xl font-semibold text-gray-800">{message}</h2>
                <p className="text-gray-500">{t('tryAgainOrContact')}</p>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}

export default StripeConnectCallback;
