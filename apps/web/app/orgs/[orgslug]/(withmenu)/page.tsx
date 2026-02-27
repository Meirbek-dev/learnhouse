import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getOrgThumbnailMediaDirectory } from '@services/media/media';
import { PageSuspense } from '@components/Utils/PageSuspense';
import { getTranslations } from 'next-intl/server';
import { LandingContent } from './LandingContent';
import type { Metadata } from 'next';

function CourseGridSkeleton() {
  return (
    <div className="mx-auto w-full max-w-[1800px] px-4 py-8">
      <div className="space-y-12">
        {/* Section header skeleton */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="bg-muted h-7 w-32 animate-pulse rounded" />
          </div>
          <div className="grid w-full grid-cols-1 justify-items-center gap-6 sm:grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className="flex w-full max-w-sm justify-center"
              >
                <div className="w-full animate-pulse overflow-hidden rounded-lg border shadow-md">
                  <div className="bg-muted aspect-video w-full" />
                  <div className="space-y-2 p-4">
                    <div className="bg-muted h-5 w-3/4 rounded" />
                    <div className="bg-muted h-4 w-full rounded" />
                    <div className="flex items-center gap-2 pt-1">
                      <div className="bg-muted h-8 w-8 rounded-full" />
                      <div className="bg-muted h-3 w-24 rounded" />
                    </div>
                  </div>
                  <div className="border-t p-3">
                    <div className="bg-muted h-8 w-full rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface MetadataProps {
  params: Promise<{ orgslug: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  // Get Org context information
  const org = await getOrganizationContextInfo(params.orgslug);
  const t = await getTranslations('General');

  // SEO
  return {
    title: `${t('home')} - Ashyq Bilim`,
    description: org.description,
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
      title: `${t('home')} - Ashyq Bilim`,
      description: org.description,
      type: 'website',
      images: [
        {
          url: getOrgThumbnailMediaDirectory(org?.org_uuid, org?.thumbnail_image),
          width: 800,
          height: 600,
          alt: org.name,
        },
      ],
    },
  };
}

const OrgHomePage = async (params: any) => {
  const { orgslug } = await params.params;

  return (
    <div className="w-full">
      <PageSuspense fallback={<CourseGridSkeleton />}>
        <LandingContent orgslug={orgslug} />
      </PageSuspense>
    </div>
  );
};

export default OrgHomePage;
