'use client';

import { getCoursesLinkedToProduct, unlinkCourseFromProduct } from '@services/payments/products';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { useOrg } from '@components/Contexts/OrgContext';
import { BookOpen, Plus, Trash2 } from 'lucide-react';
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import { toast } from 'react-hot-toast';
import useSWR, { mutate } from 'swr';

import LinkCourseModal from './LinkCourseModal';

interface ProductLinkedCoursesProps {
  productId: string;
}

export default function ProductLinkedCourses({ productId }: ProductLinkedCoursesProps) {
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const accessToken = session?.data?.tokens?.access_token;
  const orgId = org?.id;
  const tNotify = useTranslations('DashPage.Notifications');
  const t = useTranslations('DashPage.Payments.LinkedCourses');

  // Use SWR to fetch linked courses
  const {
    data: linkedCourses,
    mutate: mutateLinkedCourses,
    error,
  } = useSWR(
    orgId && accessToken && productId ? [`/payments/${orgId}/products/${productId}/courses`, accessToken] : null,
    async ([, token]) => {
      const response = await getCoursesLinkedToProduct(orgId, productId, token);
      return response.data || [];
    },
  );

  // Show error toast if fetch fails
  useEffect(() => {
    if (error) {
      toast.error(tNotify('errors.fetchLinkedCoursesFailed'));
    }
  }, [error, tNotify]);

  const handleUnlinkCourse = async (courseId: string) => {
    try {
      const response = await unlinkCourseFromProduct(orgId, productId, courseId, accessToken);
      if (response.success) {
        await mutateLinkedCourses();
        mutate([`/payments/${orgId}/products`, accessToken]);
        toast.success(tNotify('courseUnlinkedSuccess'));
      } else {
        toast.error(
          tNotify('errors.unlinkCourseFailed', {
            error: response.data?.detail || '',
          }),
        );
      }
    } catch {
      toast.error(tNotify('errors.unlinkCourseFailed', { error: '' }));
    }
  };

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-700">{t('title')}</h3>
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
                mutateLinkedCourses();
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
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <BookOpen size={16} />
            <span>{t('noCoursesLinked')}</span>
          </div>
        ) : (
          linkedCourses.map((course) => (
            <div
              key={course.id}
              className="flex items-center justify-between rounded-md bg-gray-50 p-2"
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
