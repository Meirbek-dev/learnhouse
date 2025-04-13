'use client'
import { OrgProvider } from '@components/Contexts/OrgContext'
import ErrorUI from '@components/Objects/StyledElements/Error/Error'
import { useTranslations } from 'next-intl'
import { useSearchParams } from 'next/navigation'

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode
}) {
    const t = useTranslations('Auth.Layout')
    const searchParams = useSearchParams()
    const orgslug = searchParams.get('orgslug')
    if (orgslug) {
        return <OrgProvider orgslug={orgslug}>{children}</OrgProvider>
    } else {
        return <ErrorUI
            message={t('orgNotSpecified')}
            submessage={t('accessFromOrg')}
        />
    }
}
