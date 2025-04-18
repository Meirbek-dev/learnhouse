'use client'
import React from 'react'
import useAdminStatus from '../Hooks/useAdminStatus'
import { useTranslations } from 'next-intl'

// Terrible name and terible implementation, need to be refactored asap
function ContentPlaceHolderIfUserIsNotAdmin({ text }: { text: string }) {
  const t = useTranslations('General')
  const isUserAdmin = useAdminStatus() as any
  return <span>{isUserAdmin.isAdmin ? text : t('noContentYet')}</span>
}

export default ContentPlaceHolderIfUserIsNotAdmin
