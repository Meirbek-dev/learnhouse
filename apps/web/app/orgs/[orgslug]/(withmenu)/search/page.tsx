import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getOrgThumbnailMediaDirectory } from '@services/media/media';
import { getTranslations } from 'next-intl/server';
import type { Metadata } from 'next';

import SearchPage from './search';

interface MetadataProps {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  const searchParams = await props.searchParams;
  const t = await getTranslations('General');

  const org = await getOrganizationContextInfo(params.orgslug, {
    cache: 'no-store',
    tags: ['organizations'],
  });

  const searchQuery = Array.isArray(searchParams.q) ? searchParams.q[0] : searchParams.q || '';
  const searchType = Array.isArray(searchParams.type) ? searchParams.type[0] : searchParams.type || 'all';

  // Build dynamic title and description based on search parameters
  let title = `${t('search')} — МООК`;
  let description = `${t('searchContent')} ${org.name}. ${t('discoverCourses')}, ${t('collections')}, ${t('andUsers')}.`;

  if (searchQuery) {
    title = `${t('searchResults')} "${searchQuery}" — МООК`;
    description = `${t('searchResultsFor')} "${searchQuery}" ${t('in')} ${org.name}. ${t('findCourses')}, ${t('collections')}, ${t('andUsers')}.`;
  }

  if (searchType !== 'all' && searchType) {
    const typeLabel = t(searchType as 'courses' | 'collections' | 'users');
    title = searchQuery ? `${typeLabel} ${t('searchResults')} "${searchQuery}" — МООК` : `${typeLabel} — МООК`;
    description = searchQuery
      ? `${t('searchResultsFor')} "${searchQuery}" ${t('in')} ${typeLabel.toLowerCase()} ${t('at')} ${org.name}.`
      : `${t('browse')} ${typeLabel.toLowerCase()} ${t('at')} ${org.name}.`;
  }

  // SEO keywords
  const keywords = [
    org.name,
    t('search'),
    t('courses'),
    t('collections'),
    t('users'),
    t('learning'),
    t('education'),
    t('onlineLearning'),
    t('edu'),
    searchQuery,
  ]
    .filter(Boolean)
    .join(', ');

  return {
    title,
    description,
    keywords,
    robots: {
      index: true,
      follow: true,
      nocache: true,
      googleBot: {
        'index': true,
        'follow': true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: org.name,
      images: [
        {
          url: getOrgThumbnailMediaDirectory(org?.org_uuid, org?.thumbnail_image),
          width: 800,
          height: 600,
          alt: `${org.name} - ${t('search')}`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [getOrgThumbnailMediaDirectory(org?.org_uuid, org?.thumbnail_image)],
    },
    alternates: {
      canonical: searchQuery
        ? `/orgs/${params.orgslug}/search?q=${encodeURIComponent(searchQuery)}`
        : `/orgs/${params.orgslug}/search`,
    },
  };
}

const SearchPageWrapper = async (_params: any) => {
  return (
    <div>
      <SearchPage />
    </div>
  );
};

export default SearchPageWrapper;
