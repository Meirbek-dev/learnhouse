import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import NewCollection from './NewCollection';

export async function generateMetadata({ params }: { params: { orgslug: string } }): Promise<Metadata> {
  const t = await getTranslations('NewCollectionPage');
  const org = await getOrganizationContextInfo(params.orgslug, {
    revalidate: 0,
    tags: ['organizations'],
  });

  return {
    title: `${t('metaTitle')} — ${org.name}`,
    description: t('metaDescription', { orgName: org.name }),
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
      title: `${t('metaTitle')} — ${org.name}`,
      description: t('metaDescription', { orgName: org.name }),
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

export default function Page(props: any) {
  return <NewCollection {...props} />;
}
