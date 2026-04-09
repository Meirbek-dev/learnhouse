'use client';

import type { components } from '@/lib/api/generated';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { unlinkCourseFromProduct } from '@services/payments/products';
import { productCoursesQueryOptions } from '@/features/payments/queries/payments.query';
import { queryKeys } from '@/lib/react-query/queryKeys';
import Modal from '@/components/Objects/Elements/Modal/Modal';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import LinkCourseModal from './LinkCourseModal';

type CourseRead = components['schemas']['CourseRead'];

interface ProductLinkedCoursesProps {
  productId: number;
}

export default function ProductLinkedCourses({ productId }: ProductLinkedCoursesProps) {
  const queryClient = useQueryClient();
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const tNotify = useTranslations('DashPage.Notifications');
  const t = useTranslations('DashPage.Payments.LinkedCourses');

  const linkedCoursesKey = queryKeys.payments.productCourses(productId);

  const { data: linkedCoursesResponse, error } = useQuery(productCoursesQueryOptions(productId));
  const linkedCourses = linkedCoursesResponse?.data ?? [];

  // Show error toast if fetch fails
  useEffect(() => {
    if (error) {
      toast.error(tNotify('errors.fetchLinkedCoursesFailed'));
    }
  }, [error, tNotify]);

  const handleUnlinkCourse = async (courseId: number) => {
    const prev = linkedCourses;
    queryClient.setQueryData(
      linkedCoursesKey,
      prev.filter((course: CourseRead) => course.id !== courseId),
    );

    try {
      const response = await unlinkCourseFromProduct(productId, courseId);
      if (response.success) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.payments.products() }),
          queryClient.invalidateQueries({ queryKey: linkedCoursesKey }),
        ]);
        toast.success(tNotify('courseUnlinkedSuccess'));
      } else {
        queryClient.setQueryData(linkedCoursesKey, prev);
        toast.error(
          tNotify('errors.unlinkCourseFailed', {
            error: response.data?.message || '',
          }),
        );
      }
    } catch {
      queryClient.setQueryData(linkedCoursesKey, prev);
      toast.error(tNotify('errors.unlinkCourseFailed', { error: '' }));
    }
  };

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-foreground text-sm font-semibold">{t('title')}</h3>
        <Modal
          isDialogOpen={isLinkModalOpen}
          onOpenChange={setIsLinkModalOpen}
          dialogTitle={t('linkModalTitle')}
          dialogDescription={t('linkModalDescription')}
          dialogContent={
            <LinkCourseModal
              productId={productId}
              onSuccess={() => {
                setIsLinkModalOpen(false);
                void queryClient.invalidateQueries({ queryKey: linkedCoursesKey });
              }}
            />
          }
          dialogTrigger={
            <span>
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-2"
              >
                <Plus size={16} />
                <span>{t('linkCourseButton')}</span>
              </Button>
            </span>
          }
        />
      </div>

      <div className="space-y-2">
        {!linkedCourses || linkedCourses.length === 0 ? (
          <div className="text-muted-foreground flex items-center gap-2 text-sm">
            <BookOpen size={16} />
            <span>{t('noCoursesLinked')}</span>
          </div>
        ) : (
          linkedCourses.map((course: CourseRead) => (
            <div
              key={course.id}
              className="bg-muted flex items-center justify-between rounded-md p-2"
            >
              <span className="text-sm font-medium">{course.name}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleUnlinkCourse(course.id)}
                className="text-red-500 hover:text-red-700"
              >
                <Trash2 size={16} />
              </Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
