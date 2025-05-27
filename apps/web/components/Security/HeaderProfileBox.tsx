'use client'
import { useEffect } from 'react'
import styled from 'styled-components'
import Link from 'next/link'
import { Package2, Settings } from 'lucide-react'
import UserAvatar from '@components/Objects/UserAvatar'
import useAdminStatus from '@components/Hooks/useAdminStatus'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import { getUriWithoutOrg } from '@services/config/config'
import Tooltip from '@components/Objects/StyledElements/Tooltip/Tooltip'
import { useTranslations } from 'next-intl'

export const HeaderProfileBox = () => {
  const session = useLHSession() as any
  const isUserAdmin = useAdminStatus()
  const org = useOrg() as any
  const t = useTranslations('Header')

  useEffect(() => {}, [session])

  return (
    <ProfileArea>
      {session.status === 'unauthenticated' && (
        <UnidentifiedArea className="flex rounded-lg p-1.5 px-2 text-sm font-bold text-gray-700">
          <ul className="flex items-center space-x-3">
            <li>
              <Link
                href={{
                  pathname: getUriWithoutOrg('/login'),
                  query: org ? { orgslug: org.slug } : undefined,
                }}
              >
                {t('login')}
              </Link>
            </li>
            <li className="rounded-lg bg-black p-2 px-3 text-white shadow-md">
              <Link
                href={{
                  pathname: getUriWithoutOrg('/signup'),
                  query: org ? { orgslug: org.slug } : undefined,
                }}
              >
                {t('signUp')}
              </Link>
            </li>
          </ul>
        </UnidentifiedArea>
      )}
      {session.status === 'authenticated' && (
        <AccountArea className="space-x-0">
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              <p className="text-sm capitalize">{session.data.user.username}</p>
              {isUserAdmin.isAdmin && (
                <div className="rounded-md bg-rose-300 px-2 py-1 text-[10px] font-bold shadow-inner">
                  {t('adminBadge')}
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <Tooltip content={t('tooltips.ownedCourses')} sideOffset={15} side="bottom">
                <Link className="text-gray-600" href={'/dash/user-account/owned'}>
                  <Package2 size={14} />
                </Link>
              </Tooltip>
              <Tooltip content={t('tooltips.yourSettings')} sideOffset={15} side="bottom">
                <Link className="text-gray-600" href={'/dash'}>
                  <Settings size={14} />
                </Link>
              </Tooltip>
            </div>
            <div className="py-4">
              <UserAvatar border="border-4" rounded="rounded-lg" width={30} />
            </div>
          </div>
        </AccountArea>
      )}
    </ProfileArea>
  )
}

const AccountArea = styled.div`
  display: flex;
  align-items: center;
  img {
    width: 29px;
  }
`

const ProfileArea = styled.div`
  display: flex;
  align-items: center;
`

const UnidentifiedArea = styled.div`
  display: flex;
  flex-grow: 1;
  align-items: stretch;
`
