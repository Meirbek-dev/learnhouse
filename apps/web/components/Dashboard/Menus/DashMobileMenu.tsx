'use client'
import { useOrg } from '@components/Contexts/OrgContext'
import {
  Backpack,
  BadgeDollarSign,
  BookCopy,
  Home,
  School,
  Settings,
  Users,
} from 'lucide-react'
import Link from 'next/link'
import AdminAuthorization from '@components/Security/AdminAuthorization'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import ToolTip from '@components/Objects/StyledElements/Tooltip/Tooltip'
import { useTranslations } from 'next-intl'

function DashMobileMenu() {
  const _org = useOrg() as any
  const session = useLHSession() as any
  const t = useTranslations('DashboardMenu')

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 text-white shadow-xl backdrop-blur-lg">
      <div className="flex h-16 items-center justify-around px-2">
        <AdminAuthorization authorizationMode="component">
          <ToolTip
            content={t('tooltips.home')}
            slateBlack
            sideOffset={8}
            side="top"
          >
            <Link href={'/'} className="flex flex-col items-center p-2">
              <Home size={20} />
              <span className="mt-1 text-xs">{t('mobile.home')}</span>
            </Link>
          </ToolTip>
          <ToolTip
            content={t('tooltips.courses')}
            slateBlack
            sideOffset={8}
            side="top"
          >
            <Link
              href={'/dash/courses'}
              className="flex flex-col items-center p-2"
            >
              <BookCopy size={20} />
              <span className="mt-1 text-xs">{t('mobile.courses')}</span>
            </Link>
          </ToolTip>
          <ToolTip
            content={t('tooltips.assignments')}
            slateBlack
            sideOffset={8}
            side="top"
          >
            <Link
              href={'/dash/assignments'}
              className="flex flex-col items-center p-2"
            >
              <Backpack size={20} />
              <span className="mt-1 text-xs">{t('mobile.assignments')}</span>
            </Link>
          </ToolTip>
          <ToolTip
            content={t('tooltips.payments')}
            slateBlack
            sideOffset={8}
            side="top"
          >
            <Link
              href={'/dash/payments/customers'}
              className="flex flex-col items-center p-2"
            >
              <BadgeDollarSign size={20} />
              <span className="mt-1 text-xs">{t('mobile.payments')}</span>
            </Link>
          </ToolTip>
          <ToolTip
            content={t('tooltips.users')}
            slateBlack
            sideOffset={8}
            side="top"
          >
            <Link
              href={'/dash/users/settings/users'}
              className="flex flex-col items-center p-2"
            >
              <Users size={20} />
              <span className="mt-1 text-xs">{t('mobile.users')}</span>
            </Link>
          </ToolTip>
          <ToolTip
            content={t('tooltips.organization')}
            slateBlack
            sideOffset={8}
            side="top"
          >
            <Link
              href={'/dash/org/settings/general'}
              className="flex flex-col items-center p-2"
            >
              <School size={20} />
              <span className="mt-1 text-xs">{t('mobile.org')}</span>
            </Link>
          </ToolTip>
        </AdminAuthorization>
        <ToolTip
          content={t('tooltips.userSettings', {
            username: session.data.user.username,
          })}
          slateBlack
          sideOffset={8}
          side="top"
        >
          <Link
            href={'/dash/user-account/settings/general'}
            className="flex flex-col items-center p-2"
          >
            <Settings size={20} />
            <span className="mt-1 text-xs">{t('mobile.settings')}</span>
          </Link>
        </ToolTip>
      </div>
    </div>
  )
}

export default DashMobileMenu
