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
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@components/ui/table';
import RolesUpdate from '@components/Objects/Modals/Dash/OrgUsers/RolesUpdate';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';

import { AlertTriangle, KeyRound, Loader2, LogOut, Search } from 'lucide-react';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import PageLoading from '@components/Objects/Loaders/PageLoading';
import { removeUserFromOrg } from '@services/organizations/orgs';
import useAdminStatus from '@components/Hooks/useAdminStatus';
import { useOrg } from '@components/Contexts/OrgContext';
import { swrFetcher } from '@services/utils/ts/requests';
import { getAPIUrl } from '@services/config/config';
import React, { useMemo, useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { Input } from '@/components/ui/input';
import useSWR, { mutate } from 'swr';
import { toast } from 'sonner';

const USERS_PER_PAGE = 20;

interface RemoveUserButtonProps {
  userId: number;
  username: string;
  onRemove: (userId: number) => Promise<void>;
  t: (key: string, values?: Record<string, string>) => string;
}

function RemoveUserButton({ userId, username, onRemove, t }: RemoveUserButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleRemove() {
    startTransition(async () => {
      await onRemove(userId);
      setIsOpen(false);
    });
  }

  return (
    <AlertDialog
      open={isOpen}
      onOpenChange={setIsOpen}
    >
      <AlertDialogTrigger
        render={
          <button className="mr-2 flex items-center space-x-2 rounded-md bg-rose-700 p-1 px-3 text-sm font-bold text-rose-100 hover:cursor-pointer">
            <LogOut className="h-4 w-4" />
            <span>{t('removeFromOrgButton')}</span>
          </button>
        }
      />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia>
            <AlertTriangle className="text-destructive size-6" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('removeUserModalTitle', { username })}</AlertDialogTitle>
          <AlertDialogDescription>{t('removeUserModalMessage')}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending} />
          <AlertDialogAction
            variant="destructive"
            onClick={handleRemove}
            disabled={isPending}
          >
            {isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            {t('removeUserButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

const OrgUsers = () => {
  const org = useOrg() as any;
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
  const t = useTranslations('DashPage.UserSettings.usersSection');
  const { userRoles } = useAdminStatus();

  const getRolePriority = (roleObj: any) => {
    if (!roleObj) return 0;
    // roleObj may be the role itself or wrapped under `role`
    const role = roleObj.role || roleObj;
    const { role_uuid } = role;
    const { id } = role;
    const name = role.name || '';

    if (
      role_uuid === 'role_global_admin' ||
      id === 1 ||
      name === 'Админ' ||
      name === 'Администратор' ||
      name === 'Admin'
    )
      return 4;
    if (role_uuid === 'role_global_maintainer' || id === 2 || name === 'Maintainer' || name === 'Мейнтейнер') return 3;
    if (role_uuid === 'role_global_instructor' || id === 3 || name === 'Instructor' || name === 'Инструктор') return 2;
    return 1;
  };

  const currentUserPriority = (() => {
    try {
      if (!userRoles || userRoles.length === 0 || !org) return 0;
      const orgRoles = userRoles.filter((r: any) => r.org?.id === org?.id);
      if (!orgRoles || orgRoles.length === 0) return 0;
      // return highest priority among user's roles in this org
      return Math.max(...orgRoles.map((r: any) => getRolePriority(r.role || r)));
    } catch {
      return 0;
    }
  })();

  const [searchQuery, setSearchQuery] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  const {
    data: orgUsersData,
    error,
    isLoading,
  } = useSWR(
    org ? `${getAPIUrl()}orgs/${org?.id}/users?page=${currentPage}&per_page=${USERS_PER_PAGE}` : null,
    (url) => swrFetcher(url, access_token)
  );

  const totalUsers = orgUsersData?.total ?? 0;
  const totalPages = orgUsersData?.total_pages ?? 1;

  // Client-side search filtering
  const filteredUsers = useMemo(() => {
    const orgUsers = orgUsersData?.users ?? [];
    if (!orgUsers || !searchQuery.trim()) return orgUsers;

    const query = searchQuery.toLowerCase().trim();
    return orgUsers.filter((user: any) => {
      const fullName = [user.user.first_name, user.user.middle_name, user.user.last_name]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      const username = (user.user.username || '').toLowerCase();
      const email = (user.user.email || '').toLowerCase();
      return fullName.includes(query) || username.includes(query) || email.includes(query);
    });
  }, [orgUsersData?.users, searchQuery]);

  const [rolesModal, setRolesModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);

  // Reset to page 1 when search changes (but don't need to refetch since filtering is client-side)
  const handleSearchChange = (value: string) => {
    setSearchQuery(value);
  };

  const handleRolesModal = (user: any) => {
    setSelectedUser(user);
    setRolesModal(true);
  };

  const handleCloseRolesModal = () => {
    setSelectedUser(null);
    setRolesModal(false);
  };

  const handleRemoveUser = async (user_id: number) => {
    const toastId = toast.loading(t('removingUser'));
    try {
      const res = await removeUserFromOrg(org.id, user_id, access_token);
      if (res.status === 200) {
        // Revalidate the current page data
        await mutate(`${getAPIUrl()}orgs/${org.id}/users?page=${currentPage}&per_page=${USERS_PER_PAGE}`);
        toast.success(t('userRemovedSuccess'), { id: toastId });
      } else {
        toast.error(t('errors.removeUserFailed'), { id: toastId });
      }
    } catch {
      toast.error(t('errors.removeUserFailed'), { id: toastId });
    }
  };

  return (
    <div>
      {isLoading ? (
        <div>
          <PageLoading />
        </div>
      ) : (
        <>
          <div className="h-6" />
          <div className="mx-auto mr-10 ml-10 rounded-xl bg-white px-4 py-4 shadow-xs">
            <div className="mb-3 flex flex-col -space-y-1 rounded-md bg-gray-50 px-5 py-3">
              <h1 className="text-xl font-bold text-gray-800">{t('activeUsersTitle')}</h1>
              <h2 className="text-base text-gray-500"> {t('description')}</h2>
            </div>
            <div className="relative mb-4 px-1">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2" />
              <Input
                type="text"
                placeholder={t('searchPlaceholder')}
                value={searchQuery}
                onChange={(e) => handleSearchChange(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="overflow-x-auto">
              <Table className="overflow-hidden">
                <TableHeader className="uppercase">
                  <TableRow>
                    <TableHead>{t('userHeader')}</TableHead>
                    <TableHead>{t('roleHeader')}</TableHead>
                    <TableHead>{t('actionsHeader')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers?.map((user: any) => (
                    <TableRow key={user.user.id}>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <span>
                            {[user.user.first_name, user.user.middle_name, user.user.last_name]
                              .filter(Boolean)
                              .join(' ')}
                          </span>
                          <span className="rounded-full bg-neutral-100 p-1 px-2 text-xs font-semibold text-neutral-400">
                            @{user.user.username}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell>{user.role.name}</TableCell>
                      <TableCell>
                        <div className="flex items-end space-x-2">
                          {(() => {
                            const isSelf =
                              session?.data?.user?.user_uuid === user.user.user_uuid ||
                              session?.data?.user?.id === user.user.id;
                            const targetPriority = getRolePriority(user.role);
                            const canManage =
                              !isSelf && currentUserPriority >= targetPriority && user.role.name !== 'Админ';

                            if (!canManage) {
                              // Determine specific disabled reason for clearer messaging
                              if (user.role.name === 'Админ')
                                return <div className="text-neutral-500">{t('noActionsForAdministrators')}</div>;
                              if (currentUserPriority <= targetPriority)
                                return <div className="text-neutral-500">{t('cannotManageHigherRole')}</div>;
                              if (isSelf) return <div className="text-neutral-500">{t('cannotEditSelf')}</div>;
                              return <div className="text-neutral-500">{t('noActionsForAdministrators')}</div>;
                            }

                            return (
                              <>
                                <Modal
                                  isDialogOpen={
                                    rolesModal ? selectedUser?.user?.user_uuid === user.user.user_uuid : false
                                  }
                                  onOpenChange={(isOpen) => {
                                    if (!isOpen) handleCloseRolesModal();
                                  }}
                                  minHeight="no-min"
                                  dialogContent={
                                    selectedUser ? (
                                      <RolesUpdate
                                        alreadyAssignedRole={selectedUser.role.role_uuid}
                                        setRolesModal={setRolesModal}
                                        user={selectedUser}
                                      />
                                    ) : null
                                  }
                                  dialogTitle={t('updateRoleModalTitle')}
                                  dialogDescription={t('updateRoleModalDescription', {
                                    username: user.user.username,
                                  })}
                                  dialogTrigger={
                                    <span>
                                      <button
                                        className="flex items-center space-x-2 rounded-md bg-yellow-700 p-1 px-3 text-sm font-bold text-yellow-100 hover:cursor-pointer"
                                        onClick={() => {
                                          handleRolesModal(user);
                                        }}
                                      >
                                        <KeyRound className="h-4 w-4" />
                                        <span>{t('editRoleButton')}</span>
                                      </button>
                                    </span>
                                  }
                                />

                                <RemoveUserButton
                                  userId={user.user.id}
                                  username={user.user.username}
                                  onRemove={handleRemoveUser}
                                  t={t}
                                />
                              </>
                            );
                          })()}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {(!filteredUsers || filteredUsers.length === 0) && (
                    <TableRow>
                      <TableCell
                        colSpan={3}
                        className="py-4 text-center text-gray-500"
                      >
                        {searchQuery ? t('noSearchResults') : t('noUsersFound')}
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between px-2">
                <div className="text-muted-foreground text-sm">
                  {t('paginationInfo', {
                    start: String((currentPage - 1) * USERS_PER_PAGE + 1),
                    end: String(Math.min(currentPage * USERS_PER_PAGE, totalUsers)),
                    total: String(totalUsers),
                  })}
                </div>
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious
                        onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        aria-disabled={currentPage === 1}
                        className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter((page) => {
                        if (totalPages <= 7) return true;
                        if (page === 1 || page === totalPages) return true;
                        if (Math.abs(page - currentPage) <= 1) return true;
                        return false;
                      })
                      .map((page, idx, arr) => {
                        const prev = arr[idx - 1];
                        const showEllipsisBefore = idx > 0 && prev != null && page - prev > 1;
                        return (
                          <React.Fragment key={page}>
                            {showEllipsisBefore && (
                              <PaginationItem>
                                <PaginationEllipsis />
                              </PaginationItem>
                            )}
                            <PaginationItem>
                              <PaginationLink
                                onClick={() => setCurrentPage(page)}
                                isActive={currentPage === page}
                                className="cursor-pointer"
                              >
                                {page}
                              </PaginationLink>
                            </PaginationItem>
                          </React.Fragment>
                        );
                      })}
                    <PaginationItem>
                      <PaginationNext
                        onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        aria-disabled={currentPage === totalPages}
                        className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default OrgUsers;
