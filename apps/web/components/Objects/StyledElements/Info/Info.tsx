'use client';
import { Diamond, Home, PersonStanding } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';

import { getUriWithoutOrg } from '@services/config/config';

function InfoUI({
  message,
  submessage,
  cta,
  href,
}: {
  message?: string;
  submessage?: string;
  cta?: string;
  href: string;
}) {
  const t = useTranslations('Components.InfoUI');
  return (
    <div className="bg-linear-to-b mx-auto flex flex-col items-center space-y-6 from-yellow-100 to-yellow-100/5 py-10 antialiased">
      <div className="flex flex-row items-center space-x-5 rounded-xl">
        <Diamond
          className="text-yellow-700"
          size={45}
        />
        <div className="flex flex-col">
          <p className="text-3xl font-bold text-yellow-700">{message || t('defaultMessage')}</p>
          {submessage && <p className="text-lg font-bold text-yellow-700">{submessage}</p>}
        </div>
      </div>
      {cta && (
        <div className="flex space-x-4">
          <Link
            href={href}
            className="flex items-center space-x-2 rounded-full bg-yellow-700 px-4 py-1 text-yellow-200 shadow-lg transition-all ease-linear hover:bg-yellow-800"
          >
            <PersonStanding
              className="text-yellow-200"
              size={17}
            />
            <span className="text-md font-bold">{cta}</span>
          </Link>
          <Link
            href={getUriWithoutOrg('/home')}
            className="flex items-center space-x-2 rounded-full bg-gray-700 px-4 py-1 text-gray-200 shadow-lg transition-all ease-linear hover:bg-gray-800"
          >
            <Home
              className="text-gray-200"
              size={17}
            />
            <span className="text-md font-bold">{t('homeButton')}</span>
          </Link>
        </div>
      )}
    </div>
  );
}

export default InfoUI;
