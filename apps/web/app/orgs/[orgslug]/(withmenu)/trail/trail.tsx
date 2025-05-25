'use client'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useOrg } from '@components/Contexts/OrgContext'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import TrailCourseElement from '@components/Pages/Trail/TrailCourseElement'
import TypeOfContentTitle from '@components/Objects/StyledElements/Titles/TypeOfContentTitle'
import GeneralWrapperStyled from '@components/Objects/StyledElements/Wrappers/GeneralWrapper'
import { getAPIUrl } from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import { useEffect } from 'react'
import useSWR from 'swr'
import { useTranslations } from 'next-intl'

function Trail(params: any) {
  const orgslug = params.orgslug
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const org = useOrg() as any
  const orgID = org?.id
  const t = useTranslations('TrailPage')
  const { data: trail, error } = useSWR(
    `${getAPIUrl()}trail/org/${orgID}/trail`,
    (url) => swrFetcher(url, access_token)
  )

  useEffect(() => {}, [trail, org])

  return (
    <GeneralWrapperStyled>
      <TypeOfContentTitle title={t('title')} type="tra" />
      {!trail ? (
        <PageLoading />
      ) : (
        <div className="space-y-6">
          {trail.runs.map((run: any) => (
            <>
              <TrailCourseElement
                run={run}
                key={run.org_id}
                course={run.course}
                orgslug={orgslug}
              />
            </>
          ))}
        </div>
      )}
    </GeneralWrapperStyled>
  )
}

export default Trail
