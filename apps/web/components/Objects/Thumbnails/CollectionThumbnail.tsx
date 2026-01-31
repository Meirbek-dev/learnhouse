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
import { Tooltip, TooltipContent, TooltipTrigger } from '@components/ui/tooltip';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { deleteCollection } from '@services/courses/collections';
import { AlertTriangle, Crown, Loader2, X } from 'lucide-react';
import { revalidateTags } from '@services/utils/ts/requests';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUriWithOrg } from '@services/config/config';
import { useState, useTransition } from 'react';
import { Badge } from '@components/ui/badge';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';

interface PropsType {
  collection: any;
  orgslug: string;
  org_id: number;
}

const removeCollectionPrefix = (collectionid: string) => {
  return collectionid.replace('collection_', '');
};

const CollectionThumbnail = (props: PropsType) => {
  const t = useTranslations('Components.CollectionThumbnail');
  const org = useOrg() as any;

  // Use backend metadata for ownership and permissions
  const isOwner = props.collection.is_owner ?? false;
  const canDelete = props.collection.can_delete ?? false;
  const availableActions = props.collection.available_actions ?? [];

  return (
    <div className="group relative overflow-hidden rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl">
      <div className="bg-primary flex h-full w-full items-center justify-between p-4">
        {/* Owner badge - shown at top left */}
        {isOwner && (
          <Badge
            variant="default"
            className="absolute top-2 left-2 z-10 gap-1 backdrop-blur-sm"
          >
            <Crown className="h-3 w-3" />
            Owner
          </Badge>
        )}

        <div className="flex items-center space-x-2">
          <div className="flex -space-x-3">
            {props.collection.courses.slice(0, 3).map(
              (course: any, index: number) =>
                course.thumbnail_image && (
                  <div
                    key={course.course_uuid}
                    className="relative h-12 w-12 overflow-hidden rounded-full border-2 border-white shadow-md transition-all duration-300 hover:z-10 hover:scale-110"
                    style={{
                      backgroundImage: `url(${getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      zIndex: 3 - index,
                    }}
                  />
                ),
            )}
          </div>
          <div className="flex flex-col">
            <Link
              prefetch={false}
              href={getUriWithOrg(
                props.orgslug,
                `/collection/${removeCollectionPrefix(props.collection.collection_uuid)}`,
              )}
              className="text-lg font-bold text-white hover:underline"
            >
              {props.collection.name}
            </Link>
            <span className="mt-1 text-sm font-medium text-indigo-200">
              {t('courseCount', { count: props.collection.courses.length })}
            </span>
          </div>
        </div>
        <CollectionAdminEditsArea
          orgslug={props.orgslug}
          org_id={props.org_id}
          collection_uuid={props.collection.collection_uuid}
          collection={props.collection}
          canDelete={canDelete}
          availableActions={availableActions}
        />
      </div>
    </div>
  );
};

const CollectionAdminEditsArea = (props: any) => {
  const t = useTranslations('Components.CollectionThumbnail');
  const router = useRouter();
  const session = usePlatformSession() as any;
  const [isOpen, setIsOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Use backend metadata for permissions (passed as props)
  const canDelete = props.canDelete ?? false;

  async function deleteCollectionUI() {
    startTransition(async () => {
      await deleteCollection(props.collection_uuid, session.data?.tokens?.access_token);
      await revalidateTags(['collections'], props.orgslug);
      setIsOpen(false);
      router.refresh();
    });
  }

  // Don't show anything if user doesn't have delete permission
  if (!canDelete) {
    return (
      <Tooltip>
        <TooltipTrigger>
          <button
            disabled
            className="absolute top-2 right-2 cursor-not-allowed rounded-full bg-red-500/50 p-1 text-white opacity-50"
            aria-label={t('noDeletePermission', {
              defaultValue: "You don't have permission to delete this collection",
            })}
          >
            <X size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent side="left">
          <p className="text-sm">You don't have permission to delete this collection</p>
        </TooltipContent>
      </Tooltip>
    );
  }

  return (
    <div className="z-20 px-2">
      <AlertDialog
        open={isOpen}
        onOpenChange={setIsOpen}
      >
        <AlertDialogTrigger
          render={
            <button className="absolute top-2 right-2 rounded-full bg-red-500 p-1 text-white transition-colors duration-300 hover:bg-red-600">
              <X size={14} />
            </button>
          }
        />
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogMedia className="bg-red-50 text-red-600 dark:bg-red-950/20 dark:text-red-400">
              <AlertTriangle className="size-8" />
            </AlertDialogMedia>
            <AlertDialogTitle>
              {t('deleteConfirmationTitle', { collectionName: props.collection.name })}
            </AlertDialogTitle>
            <AlertDialogDescription>{t('deleteConfirmationMessage')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel />
            <AlertDialogAction
              variant="destructive"
              onClick={deleteCollectionUI}
              disabled={isPending}
            >
              {isPending ? (
                <div className="flex items-center gap-2">
                  <Loader2 className="size-4 animate-spin" />
                  {t('deleting')}
                </div>
              ) : (
                t('deleteButtonText')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default CollectionThumbnail;
