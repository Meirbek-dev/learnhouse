'use client';

import { CodeIcon, ImageIcon, LayoutDashboardIcon, Share2Icon, TextIcon } from 'lucide-react';
import OrgEditSocials from '@components/Dashboard/Pages/Org/OrgEditSocials/OrgEditSocials';
import OrgEditLanding from '@components/Dashboard/Pages/Org/OrgEditLanding/OrgEditLanding';
import OrgEditGeneral from '@components/Dashboard/Pages/Org/OrgEditGeneral/OrgEditGeneral';
import OrgEditImages from '@components/Dashboard/Pages/Org/OrgEditImages/OrgEditImages';
import SettingsHeader from '@components/Dashboard/Misc/SettingsHeader';
import SettingsTabs from '@components/Dashboard/Misc/SettingsTabs';
import { getUriWithOrg } from '@services/config/config';
import { AnimatePresence, motion } from 'motion/react';
import { Separator } from '@/components/ui/separator';
import type { LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { use, useMemo } from 'react';

export interface OrgParams {
  subpage: string;
  orgslug: string;
}

interface TabItem {
  id: string;
  label: string;
  icon: LucideIcon;
  titleKey: string;
  descriptionKey: string;
}

const SETTING_TABS: TabItem[] = [
  {
    id: 'general',
    label: 'general',
    icon: TextIcon,
    titleKey: 'generalTitle',
    descriptionKey: 'generalDescription',
  },
  {
    id: 'landing',
    label: 'landing',
    icon: LayoutDashboardIcon,
    titleKey: 'landingTitle',
    descriptionKey: 'landingDescription',
  },
  {
    id: 'previews',
    label: 'previews',
    icon: ImageIcon,
    titleKey: 'previewsTitle',
    descriptionKey: 'previewsDescription',
  },
  {
    id: 'socials',
    label: 'socials',
    icon: Share2Icon,
    titleKey: 'socialsTitle',
    descriptionKey: 'socialsDescription',
  },
];

const ContentRenderer = ({ subpage }: { subpage: string }) => {
  const content = useMemo(() => {
    switch (subpage) {
      case 'general': {
        return <OrgEditGeneral />;
      }
      case 'previews': {
        return <OrgEditImages />;
      }
      case 'socials': {
        return <OrgEditSocials />;
      }
      case 'landing': {
        return <OrgEditLanding />;
      }
      default: {
        return null;
      }
    }
  }, [subpage]);

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={subpage}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="flex-1 overflow-y-auto p-1"
      >
        {content}
      </motion.div>
    </AnimatePresence>
  );
};

const OrgPage = (props: { params: Promise<OrgParams> }) => {
  const t = useTranslations('DashPage.OrgSettings');
  const params = use(props.params);

  const currentTab = useMemo(
    () => SETTING_TABS.find((tab) => tab.id === params.subpage) || SETTING_TABS[0],
    [params.subpage],
  );

  const { titleKey } = currentTab!;
  const descKey = currentTab!.descriptionKey;

  const pageTitle = useMemo(() => t(titleKey), [t, titleKey]);
  const pageDescription = useMemo(() => t(descKey), [t, descKey]);

  return (
    <div className="bg-background flex h-full w-full flex-col">
      <SettingsHeader
        breadcrumbType="org"
        title={pageTitle}
        description={pageDescription}
      >
        <SettingsTabs
          value={params.subpage}
          tabs={SETTING_TABS.map((t) => ({ id: t.id, labelKey: t.label, icon: t.icon }))}
          getHref={(tab) => `${getUriWithOrg(params.orgslug, '')}/dash/org/settings/${tab.id}`}
          translationNamespace="DashPage.OrgSettings"
        />
      </SettingsHeader>

      <Separator />

      {/* Content Section */}
      <main className="flex-1 overflow-y-auto">
        <div className="container max-w-screen py-6 lg:py-8">
          <ContentRenderer subpage={params.subpage} />
        </div>
      </main>
    </div>
  );
};

export default OrgPage;
