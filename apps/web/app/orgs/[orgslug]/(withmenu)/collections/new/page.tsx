import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getTranslations } from 'next-intl/server';
import NewCollection from './NewCollection';
import type { Metadata } from 'next';

export async function generateMetadata({ params }: { params: Promise<{ orgslug: string }> }): Promise<Metadata> {
  const { orgslug } = await params;
  const t = await getTranslations('NewCollectionPage');
  const org = await getOrganizationContextInfo(orgslug, {
    cache: 'no-store',
    tags: ['organizations'],
  });

  return {
    title: `${t('metaTitle')} — Ashyq Bilim`,
    description: t('metaDescription', { orgName: 'Ashyq Bilim' }),
    robots: {
      index: true,
      follow: true,
      nocache: true,
      googleBot: {
        'index': true,
        'follow': true,
        'max-image-preview': 'large',
      },
    },
    openGraph: {
      title: `${t('metaTitle')} — Ashyq Bilim`,
      description: t('metaDescription', { orgName: 'Ashyq Bilim' }),
      type: 'website',
      images: org.thumbnail_image
        ? [
            {
              url: org.thumbnail_image,
              width: 800,
              height: 600,
              alt: org.name,
            },
          ]
        : [],
    },
  };
}

export default async function Page(props: any) {
  const params = await props.params;
  return <NewCollection params={params} />;
}
