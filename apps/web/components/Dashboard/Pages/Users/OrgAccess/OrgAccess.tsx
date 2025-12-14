'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import OrgInviteCodeGenerate from '@components/Objects/Modals/Dash/OrgAccess/OrgInviteCodeGenerate';
import { AlertTriangle, Globe, Info, Loader2, Ticket, UserSquare, Users, X } from 'lucide-react';
import { changeSignupMechanism, deleteInviteCode } from '@services/organizations/invites';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getAPIUrl, getUriWithoutOrg } from '@services/config/config';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { useCallback, useState, useTransition } from 'react';
import { useDateFnsLocale } from '@/hooks/useDateFnsLocale';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import useSWR, { mutate } from 'swr';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface JoinMethodCardProps {
  method: 'open' | 'inviteOnly';
  isActive: boolean;
  title: string;
  description: string;
  confirmTitle: string;
  confirmMessage: string;
  confirmButton: string;
  icon: React.ReactNode;
  onConfirm: () => Promise<void>;
}

function JoinMethodCard({
  isActive,
  title,
  description,
  confirmTitle,
  confirmMessage,
  confirmButton,
  icon,
  onConfirm,
}: JoinMethodCardProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleConfirm = useCallback(() => {
    startTransition(async () => {
      await onConfirm();
      setIsOpen(false);
    });
  }, [onConfirm]);

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <AlertDialogTrigger
        render={
          <div className="relative h-[160px] w-full cursor-pointer rounded-lg bg-slate-100 transition-all ease-linear hover:bg-slate-200">
            {isActive && (
              <div className="absolute top-0 left-0 mx-3 my-3 w-fit rounded-lg bg-green-200 px-3 py-1 text-sm font-bold text-green-600">
                Active
              </div>
            )}
            <div className="flex h-full flex-col items-center justify-center space-y-1">
              {icon}
              <div className="text-2xl font-bold text-slate-700">{title}</div>
              <div className="px-2 text-center text-gray-400">{description}</div>
            </div>
          </div>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <Info className="text-primary size-6" />
          </AlertDialogMedia>
          <AlertDialogTitle>{confirmTitle}</AlertDialogTitle>
          <AlertDialogDescription>{confirmMessage}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} />
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {confirmButton}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

interface DeleteInviteButtonProps {
  invite: { invite_code_uuid: string };
  onDelete: (invite: { invite_code_uuid: string }) => Promise<void>;
  t: (key: string) => string;
}

function DeleteInviteButton({ invite, onDelete, t }: DeleteInviteButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleDelete = useCallback(() => {
    startTransition(async () => {
      await onDelete(invite);
      setIsOpen(false);
    });
  }, [onDelete, invite]);

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <AlertDialogTrigger
        render={
          <button className="mr-2 flex items-center space-x-2 rounded-md bg-rose-700 p-1 px-3 text-sm font-bold text-rose-100 hover:cursor-pointer">
            <X className="h-4 w-4" />
            <span>{t('deleteCodeButton')}</span>
          </button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <AlertTriangle className="text-destructive size-6" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('deleteCodeModalTitle')}</AlertDialogTitle>
          <AlertDialogDescription>{t('deleteCodeModalMessage')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} />
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('deleteCodeButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const OrgAccess = () => {
  const org = useOrg() as any;
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.UserSettings.signupsSection');
  const locale = useDateFnsLocale();

  const { data: invites } = useSWR(org ? `${getAPIUrl()}orgs/${org?.id}/invites` : null, (url) =>
    swrFetcher(url, access_token),
  );
  const [invitesModal, setInvitesModal] = useState(false);
  const router = useRouter();

  // Derive joinMethod from org config
  const joinMethod = org?.config?.config?.features?.members?.signup_mode ?? null;

  // Derive loading state - loaded when both org and invites are available
  const isLoading = !org || invites === undefined;

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
        // joinMethod will update automatically from org mutation
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
          <div className="mx-auto mr-10 ml-10 rounded-xl bg-white px-4 py-4 shadow-xs">
            <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
              <h1 className="text-xl font-bold text-gray-800">{t('joinMethodTitle')}</h1>
              <h2 className="text-base text-gray-500">{t('description')}</h2>
            </div>
            <div className="mx-auto flex space-x-2">
              <JoinMethodCard
                method="open"
                isActive={joinMethod === 'open'}
                title={t('openTitle')}
                description={t('openDescription')}
                confirmTitle={t('changeToOpenModalTitle')}
                confirmMessage={t('changeToOpenConfirmation')}
                confirmButton={t('changeToOpenButton')}
                icon={
                  <Globe
                    className="text-slate-400"
                    size={40}
                  />
                }
                onConfirm={() => changeJoinMethod('open')}
              />
              <JoinMethodCard
                method="inviteOnly"
                isActive={joinMethod === 'inviteOnly'}
                title={t('closedTitle')}
                description={t('closedDescription')}
                confirmTitle={t('changeToClosedModalTitle')}
                confirmMessage={t('changeToClosedConfirmation')}
                confirmButton={t('changeToClosedButton')}
                icon={
                  <Ticket
                    className="text-slate-400"
                    size={40}
                  />
                }
                onConfirm={() => changeJoinMethod('inviteOnly')}
              />
            </div>
            <div className={joinMethod !== 'inviteOnly' ? 'pointer-events-none opacity-50' : ''}>
              <div className="mt-3 mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
                <h1 className="text-xl font-bold text-gray-800">{t('inviteCodesTitle')}</h1>
                <h2 className="text-base text-gray-500">{t('inviteCodesDescription')}</h2>
              </div>
              <div className="overflow-x-auto">
                <Table className="overflow-hidden">
                  <TableHeader className="uppercase">
                    <TableRow>
                      <TableHead>{t('codeHeader')}</TableHead>
                      <TableHead>{t('signupLinkHeader')}</TableHead>
                      <TableHead>{t('typeHeader')}</TableHead>
                      <TableHead>{t('expirationHeader')}</TableHead>
                      <TableHead>{t('actionsHeader')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {invites?.map((invite: any) => (
                      <TableRow key={invite.invite_code_uuid}>
                        <TableCell>{invite.invite_code}</TableCell>
                        <TableCell>
                          <Link
                            className="rounded-md bg-gray-50 px-2 py-1 text-gray-600 outline-1 outline-gray-300 transition-colors outline-dashed hover:bg-gray-100"
                            target="_blank"
                            href={getUriWithoutOrg(`/signup?inviteCode=${invite.invite_code}&orgslug=${org.slug}`)}
                          >
                            {getUriWithoutOrg(`/signup?inviteCode=${invite.invite_code}&orgslug=${org.slug}`)}
                          </Link>
                        </TableCell>
                        <TableCell>
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
                        </TableCell>
                        <TableCell>
                          {invite.expiration_date
                            ? format(new Date(invite.expiration_date), 'dd/MM/yyyy', {
                                locale,
                              })
                            : '-'}
                        </TableCell>
                        <TableCell>
                          <DeleteInviteButton
                            invite={invite}
                            onDelete={deleteInvite}
                            t={t}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                    {(!invites || invites.length === 0) && (
                      <TableRow>
                        <TableCell
                          colSpan={5}
                          className="py-4 text-center text-gray-500"
                        >
                          {t('noInviteCodesGenerated')}
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
              <div className="mt-3 mr-2 flex flex-row-reverse">
                <Modal
                  isDialogOpen={invitesModal}
                  onOpenChange={() => {
                    setInvitesModal(!invitesModal);
                  }}
                  minHeight="no-min"
                  minWidth="lg"
                  dialogContent={<OrgInviteCodeGenerate setInvitesModal={setInvitesModal} />}
                  dialogTitle={t('generateCodeModalTitle')}
                  dialogDescription={t('generateCodeModalDescription')}
                  dialogTrigger={
                    <span>
                      <button className="flex items-center space-x-2 rounded-md bg-green-700 p-1 px-3 text-sm font-semibold text-green-100 hover:cursor-pointer">
                        <Ticket className="h-4 w-4" />
                        <span>{t('generateCodeButton')}</span>
                      </button>
                    </span>
                  }
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  );
};

export default OrgAccess;
