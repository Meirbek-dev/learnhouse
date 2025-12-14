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
import AuthenticatedClientElement from '@components/Security/AuthenticatedClientElement';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { deleteCollection } from '@services/courses/collections';
import { revalidateTags } from '@services/utils/ts/requests';
import { useCallback, useState, useTransition } from 'react';
import { useOrg } from '@components/Contexts/OrgContext';
import { AlertTriangle, Loader2, X } from 'lucide-react';
import { getUriWithOrg } from '@services/config/config';
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
  return (
    <div className="group relative overflow-hidden rounded-xl shadow-lg transition-all duration-300 hover:shadow-xl">
      <div className="bg-primary flex h-full w-full items-center justify-between p-4">
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

  const deleteCollectionUI = useCallback(async () => {
    startTransition(async () => {
      await deleteCollection(props.collection_uuid, session.data?.tokens?.access_token);
      await revalidateTags(['collections'], props.orgslug);
      setIsOpen(false);
      router.refresh();
    });
  }, [props.collection_uuid, session.data?.tokens?.access_token, props.orgslug, router]);

  return (
    <AuthenticatedClientElement
      action="delete"
      ressourceType="collections"
      orgId={props.org_id}
      checkMethod="roles"
    >
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
    </AuthenticatedClientElement>
  );
};

export default CollectionThumbnail;
