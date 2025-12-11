import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper';
import { getOrganizationContextInfo } from '@services/organizations/orgs';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { getCollectionById } from '@services/courses/collections';
import { getUriWithOrg } from '@services/config/config';
import { getTranslations } from 'next-intl/server';
import Link from '@/components/ui/ServerLink';
import type { Metadata } from 'next';
import { auth } from '@/auth';

interface MetadataProps {
  params: Promise<{ orgslug: string; courseid: number; collectionid: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export async function generateMetadata(props: MetadataProps): Promise<Metadata> {
  const params = await props.params;
  const session = await auth();
  const access_token = session?.tokens?.access_token || null;
  const t = await getTranslations('General');

  // Get Org context information
  const col = await getCollectionById(params.collectionid, access_token || '');

  // SEO
  return {
    title: `${t('collection')}: ${col.name} — Ashyq Bilim`,
    description: `${col.description}`,
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
      title: `${t('collection')}: ${col.name} — Ashyq Bilim`,
      description: `${col.description}`,
      type: 'website',
    },
  };
}

const CollectionPage = async (params: any) => {
  const t = await getTranslations('General');
  const session = await auth();
  const access_token = session?.tokens?.access_token;
  const resolvedParams = await params.params;
  const org = await getOrganizationContextInfo(resolvedParams.orgslug);
  const { orgslug } = resolvedParams;
  const col = await getCollectionById(resolvedParams.collectionid, access_token || '');

  const removeCoursePrefix = (courseid: string) => {
    return courseid.replace('course_', '');
  };

  return (
    <GeneralWrapperStyled>
      <h2 className="text-sm font-semibold text-gray-400">{t('collection')}</h2>
      <h1 className="text-3xl font-semibold">{col.name}</h1>
      <br />
      <div className="home_courses flex flex-wrap">
        {col.courses.map((course: any) => (
          <div
            className="pr-8"
            key={course.course_uuid}
          >
            <Link
              prefetch={false}
              href={getUriWithOrg(orgslug, `/course/${removeCoursePrefix(course.course_uuid)}`)}
            >
              <div
                className="relative inset-0 h-[131px] w-[249px] rounded-lg bg-cover shadow-xl ring-1 ring-black/10 ring-inset"
                style={{
                  backgroundImage: course.thumbnail_image
                    ? `url(${getCourseThumbnailMediaDirectory(
                        org.org_uuid,
                        course.course_uuid,
                        course.thumbnail_image,
                      )})`
                    : `url('/empty_thumbnail.webp')`,
                }}
              />
            </Link>
            <h2 className="w-[250px] py-2 text-lg font-semibold">{course.name}</h2>
          </div>
        ))}
      </div>
    </GeneralWrapperStyled>
  );
};

export default CollectionPage;
