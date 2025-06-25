'use client';

import { addYears, format } from 'date-fns';
import { Globe, Ticket, Users, UserSquare, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import useSWR, { mutate } from 'swr';

import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { useOrg } from '@components/Contexts/OrgContext';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import OrgInviteCodeGenerate from '@components/Objects/Modals/Dash/OrgAccess/OrgInviteCodeGenerate';
import ConfirmationModal from '@components/Objects/StyledElements/ConfirmationModal/ConfirmationModal';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { getAPIUrl, getUriWithoutOrg } from '@services/config/config';
import { changeSignupMechanism, deleteInviteCode } from '@services/organizations/invites';
import { swrFetcher } from '@services/utils/ts/requests';

function OrgAccess() {
  const org = useOrg() as any;
  const session = useLHSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.UserSettings.signupsSection');
  const locale = useDateFnsLocale();

  const { data: invites } = useSWR(org ? `${getAPIUrl()}orgs/${org?.id}/invites` : null, (url) =>
    swrFetcher(url, access_token),
  );
  const [isLoading, setIsLoading] = useState(true);
  const [joinMethod, setJoinMethod] = useState<null | 'open' | 'inviteOnly'>(null);
  const [invitesModal, setInvitesModal] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (org) {
      setJoinMethod(org.config.config.features.members.signup_mode);
    }
  }, [org]);

  useEffect(() => {
    if (invites !== undefined && joinMethod !== null) {
      setIsLoading(false);
    }
  }, [invites, joinMethod]);

  async function deleteInvite(invite: any) {
    const toastId = toast.loading(t('deletingInvite'));
    try {
      const res = await deleteInviteCode(org.id, invite.invite_code_uuid, access_token);
      if (res.status === 200) {
        mutate(`${getAPIUrl()}orgs/${org.id}/invites`);
        toast.success(t('inviteDeletedSuccess'), { id: toastId });
      } else {
        toast.error(t('deleteInviteFailed'), { id: toastId });
      }
    } catch {
      toast.error(t('deleteInviteFailed'), { id: toastId });
    }
  }

  async function changeJoinMethod(method: 'open' | 'inviteOnly') {
    const toastId = toast.loading(t('changingJoinMethod'));
    try {
      const res = await changeSignupMechanism(org.id, method, access_token);
      if (res.status === 200) {
        router.refresh();
        mutate(`${getAPIUrl()}orgs/slug/${org?.slug}`);
        toast.success(t('joinMethodChangedSuccess', { method }), {
          id: toastId,
        });
        setJoinMethod(method);
      } else {
        toast.error(t('changeJoinMethodFailed'), { id: toastId });
      }
    } catch {
      toast.error(t('changeJoinMethodFailed'), { id: toastId });
    }
  }

  return (
    <>
      {isLoading ? (
        <PageLoading />
      ) : (
        <>
          <div className="h-6" />
          <div className="shadow-xs mx-auto ml-10 mr-10 rounded-xl bg-white px-4 py-4">
            <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
              <h1 className="text-xl font-bold text-gray-800">{t('joinMethodTitle')}</h1>
              <h2 className="text-md text-gray-500">{t('description')}</h2>
            </div>
            <div className="mx-auto flex space-x-2">
              <ConfirmationModal
                confirmationButtonText={t('changeToOpenButton')}
                confirmationMessage={t('changeToOpenConfirmation')}
                dialogTitle={t('changeToOpenModalTitle')}
                dialogTrigger={
                  <div className="relative h-[160px] w-full cursor-pointer rounded-lg bg-slate-100 transition-all ease-linear hover:bg-slate-200">
                    {joinMethod === 'open' && (
                      <div className="absolute left-0 top-0 mx-3 my-3 w-fit rounded-lg bg-green-200 px-3 py-1 text-sm font-bold text-green-600">
                        {t('activeLabel')}
                      </div>
                    )}
                    <div className="flex h-full flex-col items-center justify-center space-y-1">
                      <Globe
                        className="text-slate-400"
                        size={40}
                      />
                      <div className="text-2xl font-bold text-slate-700">{t('openTitle')}</div>
                      <div className="px-2 text-center text-gray-400">{t('openDescription')}</div>
                    </div>
                  </div>
                }
                functionToExecute={() => {
                  changeJoinMethod('open');
                }}
                status="info"
              />
              <ConfirmationModal
                confirmationButtonText={t('changeToClosedButton')}
                confirmationMessage={t('changeToClosedConfirmation')}
                dialogTitle={t('changeToClosedModalTitle')}
                dialogTrigger={
                  <div className="relative h-[160px] w-full cursor-pointer rounded-lg bg-slate-100 transition-all ease-linear hover:bg-slate-200">
                    {joinMethod === 'inviteOnly' && (
                      <div className="absolute left-0 top-0 mx-3 my-3 w-fit rounded-lg bg-green-200 px-3 py-1 text-sm font-bold text-green-600">
                        {t('activeLabel')}
                      </div>
                    )}
                    <div className="flex h-full flex-col items-center justify-center space-y-1">
                      <Ticket
                        className="text-slate-400"
                        size={40}
                      />
                      <div className="text-2xl font-bold text-slate-700">{t('closedTitle')}</div>
                      <div className="px-2 text-center text-gray-400">{t('closedDescription')}</div>
                    </div>
                  </div>
                }
                functionToExecute={() => {
                  changeJoinMethod('inviteOnly');
                }}
                status="info"
              />
            </div>
            <div className={joinMethod !== 'inviteOnly' ? 'pointer-events-none opacity-50' : ''}>
              <div className="mb-3 mt-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
                <h1 className="text-xl font-bold text-gray-800">{t('inviteCodesTitle')}</h1>
                <h2 className="text-md text-gray-500">{t('inviteCodesDescription')}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full table-auto overflow-hidden whitespace-nowrap rounded-md text-left">
                  <thead className="rounded-xl bg-gray-100 uppercase text-gray-500">
                    <tr className="font-bolder text-sm">
                      <th className="px-4 py-3">{t('codeHeader')}</th>
                      <th className="px-4 py-3">{t('signupLinkHeader')}</th>
                      <th className="px-4 py-3">{t('typeHeader')}</th>
                      <th className="px-4 py-3">{t('expirationHeader')}</th>
                      <th className="px-4 py-3">{t('actionsHeader')}</th>
                    </tr>
                  </thead>
                  <tbody className="mt-5 rounded-md bg-white">
                    {invites?.map((invite: any) => (
                      <tr
                        key={invite.invite_code_uuid}
                        className="border-b border-gray-100 text-sm"
                      >
                        <td className="px-4 py-3">{invite.invite_code}</td>
                        <td className="px-4 py-3">
                          <Link
                            className="rounded-md bg-gray-50 px-2 py-1 text-gray-600 outline-dashed outline-1 outline-gray-300 transition-colors hover:bg-gray-100"
                            target="_blank"
                            href={getUriWithoutOrg(`/signup?inviteCode=${invite.invite_code}&orgslug=${org.slug}`)}
                          >
                            {getUriWithoutOrg(`/signup?inviteCode=${invite.invite_code}&orgslug=${org.slug}`)}
                          </Link>
                        </td>
                        <td className="px-4 py-3">
                          {invite.usergroup_id ? (
                            <div className="flex items-center space-x-2">
                              <UserSquare className="h-4 w-4" />
                              <span>{t('linkedUserGroupType')}</span>
                            </div>
                          ) : (
                            <div className="flex items-center space-x-2">
                              <Users className="h-4 w-4" />
                              <span>{t('normalType')}</span>
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {format(addYears(new Date(invite.expiration_date), 1), 'dd/MM/yyyy', { locale })}{' '}
                        </td>
                        <td className="px-4 py-3">
                          <ConfirmationModal
                            confirmationButtonText={t('deleteCodeButton')}
                            confirmationMessage={t('deleteCodeModalMessage')}
                            dialogTitle={t('deleteCodeModalTitle')}
                            dialogTrigger={
                              <button className="mr-2 flex items-center space-x-2 rounded-md bg-rose-700 p-1 px-3 text-sm font-bold text-rose-100 hover:cursor-pointer">
                                <X className="h-4 w-4" />
                                <span>{t('deleteCodeButton')}</span>
                              </button>
                            }
                            functionToExecute={() => {
                              deleteInvite(invite);
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
                          className="py-4 text-center text-gray-500"
                        >
                          {t('noInviteCodesGenerated')}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="mr-2 mt-3 flex flex-row-reverse">
                <Modal
                  isDialogOpen={invitesModal}
                  onOpenChange={() => setInvitesModal(!invitesModal)}
                  minHeight="no-min"
                  minWidth="lg"
                  dialogContent={<OrgInviteCodeGenerate setInvitesModal={setInvitesModal} />}
                  dialogTitle={t('generateCodeModalTitle')}
                  dialogDescription={t('generateCodeModalDescription')}
                  dialogTrigger={
                    <button className="flex items-center space-x-2 rounded-md bg-green-700 p-1 px-3 text-sm font-bold text-green-100 hover:cursor-pointer">
                      <Ticket className="h-4 w-4" />
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
  );
}

export default OrgAccess;
