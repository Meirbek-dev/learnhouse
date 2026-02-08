import NewCollectionButton from '@components/Objects/StyledElements/Buttons/NewCollectionButton';
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle';
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper';
import ProtectedText from '@components/Objects/ContentPlaceHolder';
import CollectionThumbnail from '@components/Objects/Thumbnails/CollectionThumbnail';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { PermissionGuard } from '@components/Security/PermissionGuard';
import { getOrgThumbnailMediaDirectory } from '@services/media/media';
import { getOrgCollections } from '@services/courses/collections';
import { Actions, Resources, Scopes } from '@/types/permissions';
import { getUriWithOrg } from '@services/config/config';
import { getTranslations } from 'next-intl/server';
import Link from '@components/ui/AppLink';
import type { Metadata } from 'next';
import { auth } from '@/auth';

interface MetadataProps {
  params: Promise<{ orgslug: string; courseid: number }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  const t = await getTranslations('HomePage.Collections');
  const org = await getOrganizationContextInfo(params.orgslug);

  // SEO
  return {
    title: `${t('title')} — Ashyq Bilim`,
    description: `${t('collectionOfCourses', { orgName: 'Ashyq Bilim' })}`,
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
      title: `${t('title')} — Ashyq Bilim`,
      description: `${t('collectionOfCourses', { orgName: 'Ashyq Bilim' })}`,
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

const CollectionsPage = async (params: any) => {
  const t = await getTranslations('HomePage.Collections');
  const session = await auth();
  const access_token = session?.tokens?.access_token;
  const { orgslug } = await params.params;
  const org = await getOrganizationContextInfo(orgslug);
  const org_id = org.id;
  const collections = await getOrgCollections(org_id, access_token);

  return (
    <GeneralWrapperStyled>
      <div className="mb-8 flex flex-col space-y-4">
        <div className="flex items-center justify-between">
          <TypeOfContentTitle
            title={t('title')}
            type="col"
          />
          <PermissionGuard
            action={Actions.CREATE}
            resource={Resources.COLLECTION}
            scope={Scopes.ORG}
            fallback={null}
          >
            <Link href={getUriWithOrg(orgslug, '/collections/new')}>
              <NewCollectionButton />
            </Link>
          </PermissionGuard>
        </div>
        <div className="grid w-full grid-cols-2 gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4 2xl:grid-cols-4">
          {collections.map((collection: any) => (
            <div
              key={collection.collection_uuid}
              className="p-3"
            >
              <CollectionThumbnail
                collection={collection}
                orgslug={orgslug}
                org_id={org_id}
              />
            </div>
          ))}
          {collections.length === 0 && (
            <div className="col-span-full flex items-center justify-center py-8">
              <div className="text-center">
                <h1 className="mb-2 text-xl font-bold text-gray-600">{t('noContent')}</h1>
                <p className="text-base text-gray-400">
                  <ProtectedText
                    text={t('noContentUserAdmin')}
                    action={Actions.CREATE}
                    resource={Resources.COLLECTION}
                    scope={Scopes.ORG}
                  />
                </p>
                <div className="mt-4 flex justify-center">
                  <PermissionGuard
                    action={Actions.CREATE}
                    resource={Resources.COLLECTION}
                    scope={Scopes.ORG}
                    fallback={null}
                  >
                    <Link href={getUriWithOrg(orgslug, '/collections/new')}>
                      <NewCollectionButton />
                    </Link>
                  </PermissionGuard>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </GeneralWrapperStyled>
  );
};

export default CollectionsPage;
