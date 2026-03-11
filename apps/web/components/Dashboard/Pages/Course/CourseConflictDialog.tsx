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
} from '@/components/ui/alert-dialog';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { useCourse } from '@components/Contexts/CourseContext';
import { useTranslations } from 'next-intl';

const CourseConflictDialog = () => {
  const course = useCourse();
  const t = useTranslations('CourseEdit.Conflict');

  return (
    <AlertDialog
      open={course.conflict.isOpen}
      onOpenChange={(open) => {
        if (!open) {
          course.dismissConflict();
        }
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-amber-50 text-amber-600 dark:bg-amber-950/20 dark:text-amber-400">
            <AlertTriangle className="size-8" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>
            {course.conflict.message || t('description')}
            <div className="mt-3 text-sm text-gray-500">{t('reloadWarning')}</div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t('reviewDraftButton')}</AlertDialogCancel>
          <AlertDialogAction
            onClick={() => {
              if (typeof globalThis.window !== 'undefined') {
                globalThis.window.location.reload();
              }
            }}
          >
            <RefreshCcw className="mr-2 size-4" />
            {t('reloadButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};

export default CourseConflictDialog;
