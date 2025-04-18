'use client'

import { useOrg } from '@components/Contexts/OrgContext'
import PageLoading from '@components/Objects/Loaders/PageLoading'
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal'
import {
  getAPIUrl,
  getUriWithOrg,
  getUriWithoutOrg,
} from '@services/config/config'
import { swrFetcher } from '@services/utils/ts/requests'
import { Globe, Ticket, UserSquare, Users, X } from 'lucide-react'
import Link from 'next/link'
import React, { useEffect } from 'react'
import useSWR, { mutate } from 'swr'
import dayjs from 'dayjs'
import {
  changeSignupMechanism,
  deleteInviteCode,
} from '@services/organizations/invites'
import toast from 'react-hot-toast'
import { useRouter } from 'next/navigation'
import Modal from '@components/Objects/StyledElements/Modal/Modal'
import OrgInviteCodeGenerate from '@components/Objects/Modals/Dash/OrgAccess/OrgInviteCodeGenerate'
import { useLHSession } from '@components/Contexts/LHSessionContext'
import { useTranslations } from 'next-intl'

function OrgAccess() {
  const org = useOrg() as any
  const session = useLHSession() as any
  const access_token = session?.data?.tokens?.access_token
  const t = useTranslations('DashPage.UserSettings.signupsSection')
  const tNotify = useTranslations('Notifications')
  const tGeneral = useTranslations('General')

  const { data: invites } = useSWR(
    org ? `${getAPIUrl()}orgs/${org?.id}/invites` : null,
    (url) => swrFetcher(url, access_token)
  )
  const [isLoading, setIsLoading] = React.useState(true)
  const [joinMethod, setJoinMethod] = React.useState<
    null | 'open' | 'inviteOnly'
  >(null)
  const [invitesModal, setInvitesModal] = React.useState(false)
  const router = useRouter()

  useEffect(() => {
    if (org) {
      setJoinMethod(org.config.config.features.members.signup_mode)
    }
  }, [org])

  useEffect(() => {
    if (invites !== undefined && joinMethod !== null) {
      setIsLoading(false)
    }
  }, [invites, joinMethod])

  async function deleteInvite(invite: any) {
    const toastId = toast.loading(tNotify('deletingInvite'))
    try {
      let res = await deleteInviteCode(
        org.id,
        invite.invite_code_uuid,
        access_token
      )
      if (res.status == 200) {
        mutate(`${getAPIUrl()}orgs/${org.id}/invites`)
        toast.success(tNotify('inviteDeletedSuccess'), { id: toastId })
      } else {
        toast.error(tNotify('errors.deleteInviteFailed'), { id: toastId })
      }
    } catch (error) {
      toast.error(tNotify('errors.deleteInviteFailed'), { id: toastId })
    }
  }

  async function changeJoinMethod(method: 'open' | 'inviteOnly') {
    const toastId = toast.loading(tNotify('changingJoinMethod'))
    try {
      let res = await changeSignupMechanism(org.id, method, access_token)
      if (res.status == 200) {
        router.refresh()
        mutate(`${getAPIUrl()}orgs/slug/${org?.slug}`)
        toast.success(tNotify('joinMethodChangedSuccess', { method }), {
          id: toastId,
        })
        setJoinMethod(method)
      } else {
        toast.error(tNotify('errors.changeJoinMethodFailed'), { id: toastId })
      }
    } catch (error) {
      toast.error(tNotify('errors.changeJoinMethodFailed'), { id: toastId })
    }
  }

  return (
    <>
      {isLoading ? (
        <PageLoading />
      ) : (
        <>
          <div className="h-6"></div>
          <div className="ml-10 mr-10 mx-auto bg-white rounded-xl shadow-xs px-4 py-4">
            <div className="flex flex-col bg-gray-50 -space-y-1 px-5 py-3 rounded-md mb-3 ">
              <h1 className="font-bold text-xl text-gray-800">
                {t('joinMethodTitle')}
              </h1>
              <h2 className="text-gray-500 text-md">{t('description')}</h2>
            </div>
            <div className="flex space-x-2 mx-auto">
              <ConfirmationModal
                confirmationButtonText={t('changeToOpenButton')}
                confirmationMessage={t('changeToOpenConfirmation')}
                dialogTitle={t('changeToOpenModalTitle')}
                dialogTrigger={
                  <div className="w-full h-[160px] bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 ease-linear transition-all relative">
                    {joinMethod === 'open' && (
                      <div className="bg-green-200 text-green-600 font-bold w-fit my-3 mx-3 absolute top-0 left-0 text-sm px-3 py-1 rounded-lg">
                        {t('activeLabel')}
                      </div>
                    )}
                    <div className="flex flex-col space-y-1 justify-center items-center h-full">
                      <Globe className="text-slate-400" size={40}></Globe>
                      <div className="text-2xl text-slate-700 font-bold">
                        {t('openTitle')}
                      </div>
                      <div className="text-gray-400 text-center px-2">
                        {t('openDescription')}
                      </div>
                    </div>
                  </div>
                }
                functionToExecute={() => {
                  changeJoinMethod('open')
                }}
                status="info"
              />
              <ConfirmationModal
                confirmationButtonText={t('changeToClosedButton')}
                confirmationMessage={t('changeToClosedConfirmation')}
                dialogTitle={t('changeToClosedModalTitle')}
                dialogTrigger={
                  <div className="w-full h-[160px] bg-slate-100 rounded-lg cursor-pointer hover:bg-slate-200 ease-linear transition-all relative">
                    {joinMethod === 'inviteOnly' && (
                      <div className="bg-green-200 text-green-600 font-bold w-fit my-3 mx-3 absolute top-0 left-0 text-sm px-3 py-1 rounded-lg">
                        {t('activeLabel')}
                      </div>
                    )}
                    <div className="flex flex-col space-y-1 justify-center items-center h-full">
                      <Ticket className="text-slate-400" size={40}></Ticket>
                      <div className="text-2xl text-slate-700 font-bold">
                        {t('closedTitle')}
                      </div>
                      <div className="text-gray-400 text-center px-2">
                        {t('closedDescription')}
                      </div>
                    </div>
                  </div>
                }
                functionToExecute={() => {
                  changeJoinMethod('inviteOnly')
                }}
                status="info"
              />
            </div>
            <div
              className={
                joinMethod !== 'inviteOnly'
                  ? 'opacity-50 pointer-events-none'
                  : ''
              }
            >
              <div className="flex flex-col bg-gray-50 -space-y-1 px-5 py-3 rounded-md mt-3 mb-3 ">
                <h1 className="font-bold text-xl text-gray-800">
                  {t('inviteCodesTitle')}
                </h1>
                <h2 className="text-gray-500 text-md">
                  {t('inviteCodesDescription')}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="table-auto w-full text-left whitespace-nowrap rounded-md overflow-hidden">
                  <thead className="bg-gray-100 text-gray-500 rounded-xl uppercase">
                    <tr className="font-bolder text-sm">
                      <th className="py-3 px-4">{t('codeHeader')}</th>
                      <th className="py-3 px-4">{t('signupLinkHeader')}</th>
                      <th className="py-3 px-4">{t('typeHeader')}</th>
                      <th className="py-3 px-4">{t('expirationHeader')}</th>
                      <th className="py-3 px-4">{t('actionsHeader')}</th>
                    </tr>
                  </thead>
                  <tbody className="mt-5 bg-white rounded-md">
                    {invites?.map((invite: any) => (
                      <tr
                        key={invite.invite_code_uuid}
                        className="border-b border-gray-100 text-sm"
                      >
                        <td className="py-3 px-4">{invite.invite_code}</td>
                        <td className="py-3 px-4 ">
                          <Link
                            className="bg-gray-50 text-gray-600 px-2 py-1 rounded-md outline-gray-300 outline-dashed outline-1 hover:bg-gray-100 transition-colors"
                            target="_blank"
                            href={getUriWithoutOrg(
                              `/signup?inviteCode=${invite.invite_code}&orgslug=${org.slug}`
                            )}
                          >
                            {getUriWithoutOrg(
                              `/signup?inviteCode=${invite.invite_code}&orgslug=${org.slug}`
                            )}
                          </Link>
                        </td>
                        <td className="py-3 px-4">
                          {invite.usergroup_id ? (
                            <div className="flex space-x-2 items-center">
                              <UserSquare className="w-4 h-4" />
                              <span>{t('linkedUserGroupType')}</span>
                            </div>
                          ) : (
                            <div className="flex space-x-2 items-center">
                              <Users className="w-4 h-4" />
                              <span>{t('normalType')}</span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-4">
                          {dayjs(invite.expiration_date)
                            .add(1, 'year')
                            .format('DD/MM/YYYY')}{' '}
                        </td>
                        <td className="py-3 px-4">
                          <ConfirmationModal
                            confirmationButtonText={t('deleteCodeButton')}
                            confirmationMessage={t('deleteCodeModalMessage')}
                            dialogTitle={t('deleteCodeModalTitle')}
                            dialogTrigger={
                              <button className="mr-2 flex space-x-2 hover:cursor-pointer p-1 px-3 bg-rose-700 rounded-md font-bold items-center text-sm text-rose-100">
                                <X className="w-4 h-4" />
                                <span>{t('deleteCodeButton')}</span>
                              </button>
                            }
                            functionToExecute={() => {
                              deleteInvite(invite)
                            }}
                            status="warning"
                          />
                        </td>
                      </tr>
                    ))}
                    {(!invites || invites.length === 0) && (
                      <tr>
                        <td
                          colSpan={5}
                          className="text-center py-4 text-gray-500"
                        >
                          No invite codes generated yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-row-reverse mt-3 mr-2">
                <Modal
                  isDialogOpen={invitesModal}
                  onOpenChange={() => setInvitesModal(!invitesModal)}
                  minHeight="no-min"
                  minWidth="lg"
                  dialogContent={
                    <OrgInviteCodeGenerate setInvitesModal={setInvitesModal} />
                  }
                  dialogTitle={t('generateCodeModalTitle')}
                  dialogDescription={t('generateCodeModalDescription')}
                  dialogTrigger={
                    <button className=" flex space-x-2 hover:cursor-pointer p-1 px-3 bg-green-700 rounded-md font-bold items-center text-sm text-green-100">
                      <Ticket className="w-4 h-4" />
                      <span>{t('generateCodeButton')}</span>
                    </button>
                  }
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

export default OrgAccess
