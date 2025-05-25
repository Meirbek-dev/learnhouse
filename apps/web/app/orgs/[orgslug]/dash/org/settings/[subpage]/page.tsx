'use client'
import BreadCrumbs from '@components/Dashboard/Misc/BreadCrumbs'
import { getUriWithOrg } from '@services/config/config'
import {
  ImageIcon,
  TextIcon,
  type LucideIcon,
  Share2Icon,
  LayoutDashboardIcon,
} from 'lucide-react'
import Link from 'next/link'
import { useState, useEffect, use } from 'react'
import { motion } from 'framer-motion'
import OrgEditGeneral from '@components/Dashboard/Pages/Org/OrgEditGeneral/OrgEditGeneral'
import OrgEditImages from '@components/Dashboard/Pages/Org/OrgEditImages/OrgEditImages'
import OrgEditSocials from '@components/Dashboard/Pages/Org/OrgEditSocials/OrgEditSocials'
import OrgEditLanding from '@components/Dashboard/Pages/Org/OrgEditLanding/OrgEditLanding'
import { useTranslations } from 'next-intl'

export type OrgParams = {
  subpage: string
  orgslug: string
}

interface TabItem {
  id: string
  label: string
  icon: LucideIcon
}

const SETTING_TABS: TabItem[] = [
  { id: 'general', label: 'general', icon: TextIcon },
  { id: 'landing', label: 'landing', icon: LayoutDashboardIcon },
  { id: 'previews', label: 'previews', icon: ImageIcon },
  { id: 'socials', label: 'socials', icon: Share2Icon },
]

function TabLink({
  tab,
  isActive,
  orgslug,
}: {
  tab: TabItem
  isActive: boolean
  orgslug: string
}) {
  const t = useTranslations('DashPage.OrgSettings')
  return (
    <Link href={`${getUriWithOrg(orgslug, '')}/dash/org/settings/${tab.id}`}>
      <div
        className={`w-fit border-black py-2 text-center transition-all ease-linear ${
          isActive ? 'border-b-4' : 'opacity-50'
        } cursor-pointer`}
      >
        <div className="mx-2.5 flex items-center space-x-2.5">
          <tab.icon size={16} />
          <div>{t(tab.label)}</div>
        </div>
      </div>
    </Link>
  )
}

function OrgPage(props: { params: Promise<OrgParams> }) {
  const t = useTranslations('DashPage.OrgSettings')
  const params = use(props.params)
  const [H1Label, setH1Label] = useState('')
  const [H2Label, setH2Label] = useState('')

  function handleLabels() {
    if (params.subpage == 'general') {
      setH1Label(t('generalTitle'))
      setH2Label(t('generalDescription'))
    } else if (params.subpage == 'previews') {
      setH1Label(t('previewsTitle'))
      setH2Label(t('previewsDescription'))
    } else if (params.subpage == 'socials') {
      setH1Label(t('socialsTitle'))
      setH2Label(t('socialsDescription'))
    } else if (params.subpage == 'landing') {
      setH1Label(t('landingTitle'))
      setH2Label(t('landingDescription'))
    }
  }

  useEffect(() => {
    handleLabels()
  }, [params.subpage, params])

  return (
    <div className="flex h-full w-full flex-col bg-[#f8f8f8]">
      <div className="nice-shadow flex-shrink-0 bg-[#fcfbfc] pl-10 pr-10 tracking-tight">
        <BreadCrumbs type="org" />
        <div className="my-2 py-2">
          <div className="w-100 flex flex-col space-y-1">
            <div className="flex pt-3 text-4xl font-bold tracking-tighter">
              {H1Label}
            </div>
            <div className="text-md flex font-medium text-gray-400">
              {H2Label}
            </div>
          </div>
        </div>
        <div className="flex space-x-0.5 text-sm font-black">
          {SETTING_TABS.map((tab) => (
            <TabLink
              key={tab.id}
              tab={tab}
              isActive={params.subpage === tab.id}
              orgslug={params.orgslug}
            />
          ))}
        </div>
      </div>
      <div className="h-6 flex-shrink-0" />
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.1, type: 'spring', stiffness: 80 }}
        className="flex-1 overflow-y-auto"
      >
        {params.subpage == 'general' ? <OrgEditGeneral /> : ''}
        {params.subpage == 'previews' ? <OrgEditImages /> : ''}
        {params.subpage == 'socials' ? <OrgEditSocials /> : ''}
        {params.subpage == 'landing' ? <OrgEditLanding /> : ''}
      </motion.div>
    </div>
  )
}

export default OrgPage
