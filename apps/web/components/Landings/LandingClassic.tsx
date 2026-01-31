import { LoginBonusHandler } from '@/app/orgs/[orgslug]/(withmenu)/_components/LoginBonusHandler';
import NewCollectionButton from '@components/Objects/StyledElements/Buttons/NewCollectionButton';
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle';
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper';
import PermissionGuard from '@components/Security/PermissionGuard';
import { Actions, ResourceTypes } from '@/types/permissions';
import ContentPlaceHolderIfUserIsNotAdmin from '@components/Objects/ContentPlaceHolder';
import CollectionThumbnail from '@components/Objects/Thumbnails/CollectionThumbnail';
import { GamificationProvider } from '@/components/Contexts/GamificationContext';
import { HeroSection } from '@/components/Dashboard/Gamification/hero-section';
import type { DashboardData } from '@/types/gamification';
import { getUriWithOrg } from '@services/config/config';
import CreateCourseTrigger from './CreateCourseTrigger';
import { BookOpen, FolderKanban } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import CourseGridClient from './CourseGridClient';
import Link from '@/components/ui/ServerLink';
import { cn } from '@/lib/utils';

// Types
interface LandingClassicProps {
  courses: any[];
  totalCourses: number;
  collections: any[];
  orgslug: string;
  org_id: number;
  gamificationData?: DashboardData | null;
}

interface EmptyStateProps {
  t: any;
}

interface GridProps {
  collections: any[];
  orgslug: string;
  org_id: number;
}

// Empty State Components
const EmptyState = ({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: React.ElementType;
  title: string;
  description: React.ReactNode;
  className?: string;
}) => (
  <div className={cn('col-span-full flex items-center justify-center py-16', className)}>
    <div className="max-w-md space-y-4 text-center">
      <div className="from-muted to-muted/50 mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br shadow-sm">
        <Icon className="text-muted-foreground h-10 w-10" />
      </div>
      <div className="space-y-2">
        <h3 className="text-foreground text-xl font-semibold">{title}</h3>
        <p className="text-muted-foreground text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  </div>
);

const EmptyCollectionsState = ({ t }: EmptyStateProps) => (
  <EmptyState
    icon={FolderKanban}
    title={t('Collections.noContent')}
    description={<ContentPlaceHolderIfUserIsNotAdmin text={t('Collections.noContentUserAdmin')} />}
  />
);

const EmptyCoursesState = ({ t }: EmptyStateProps) => (
  <EmptyState
    icon={BookOpen}
    title={t('Courses.noContent')}
    description={<ContentPlaceHolderIfUserIsNotAdmin text={t('Courses.noContentUserAdmin')} />}
  />
);

// Collection Grid Component
const CollectionGrid = ({ collections, orgslug, org_id }: GridProps) => (
  <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {collections.map((collection: any) => (
      <div
        key={collection.collection_uuid}
        className="transition-transform duration-200 focus-within:scale-[1.02] hover:scale-[1.02]"
      >
        <CollectionThumbnail
          collection={collection}
          orgslug={orgslug}
          org_id={org_id}
        />
      </div>
    ))}
  </div>
);

// Section Header Component
const SectionHeader = ({ title, type, action }: { title: string; type: 'cou' | 'col'; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between gap-4">
    <TypeOfContentTitle
      title={title}
      type={type}
    />
    {action && <div className="flex-shrink-0">{action}</div>}
  </div>
);

// Main Component
const LandingClassic = async ({
  courses,
  totalCourses,
  collections,
  orgslug,
  org_id,
  gamificationData,
}: LandingClassicProps) => {
  const t = await getTranslations('HomePage');
  const gamificationProfile = gamificationData?.profile;
  const userRank = gamificationData?.user_rank;

  const hasCourses = courses.length > 0 || totalCourses > 0;
  const hasCollections = collections.length > 0;

  return (
    <GamificationProvider
      orgId={org_id}
      initialData={{ dashboard: gamificationData }}
    >
      <LoginBonusHandler orgId={org_id} />
      <div className="min-h-screen w-full">
        <GeneralWrapperStyled>
          <div className="space-y-12">
            {/* Gamification Hero Section */}
            {gamificationProfile && (
              <section className="animate-in fade-in slide-in-from-top-4 duration-500">
                <HeroSection
                  profile={gamificationProfile}
                  userRank={userRank}
                />
              </section>
            )}

            {/* Courses Section */}
            <section className="space-y-6">
              <SectionHeader
                title={t('Courses.title')}
                type="cou"
                action={
                  <CreateCourseTrigger
                    orgslug={orgslug}
                    org_id={org_id}
                  />
                }
              />

              <div className="min-h-[200px]">
                {hasCourses ? (
                  <CourseGridClient
                    initialCourses={courses}
                    initialTotal={totalCourses}
                    orgslug={orgslug}
                  />
                ) : (
                  <EmptyCoursesState t={t} />
                )}
              </div>
            </section>

            {/* Collections Section */}
            <section className="space-y-6 pb-12">
              <SectionHeader
                title={t('Collections.title')}
                type="col"
                action={
                  <PermissionGuard action={Actions.CREATE} resource={ResourceTypes.COLLECTION}>
                    <Link
                      prefetch={false}
                      href={getUriWithOrg(orgslug, '/collections/new')}
                      className="focus:ring-primary inline-block rounded transition-transform duration-200 hover:scale-105 focus:scale-105 focus:ring-2 focus:ring-offset-2 focus:outline-none"
                    >
                      <NewCollectionButton />
                    </Link>
                  </PermissionGuard>
                }
              />

              <div className="min-h-[200px]">
                {hasCollections ? (
                  <CollectionGrid
                    collections={collections}
                    orgslug={orgslug}
                    org_id={org_id}
                  />
                ) : (
                  <EmptyCollectionsState t={t} />
                )}
              </div>
            </section>
          </div>
        </GeneralWrapperStyled>
      </div>
    </GamificationProvider>
  );
};

export default LandingClassic;
