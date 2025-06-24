'use client';
import { getCoursesLinkedToProduct, unlinkCourseFromProduct } from '@services/payments/products';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import Modal from '@components/Objects/StyledElements/Modal/Modal';
import { useOrg } from '@components/Contexts/OrgContext';
import { Trash2, Plus, BookOpen } from 'lucide-react';
import LinkCourseModal from './LinkCourseModal';
import { Button } from '@components/ui/button';
import { useTranslations } from 'next-intl';
import { useEffect, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { mutate } from 'swr';

interface ProductLinkedCoursesProps {
  productId: string;
}

export default function ProductLinkedCourses({ productId }: ProductLinkedCoursesProps) {
  const [linkedCourses, setLinkedCourses] = useState<any[]>([]);
  const [isLinkModalOpen, setIsLinkModalOpen] = useState(false);
  const session = useLHSession() as any;
  const org = useOrg() as any;
  const tNotify = useTranslations('DashPage.Notifications');
  const t = useTranslations('DashPage.Payments.LinkedCourses');

  const fetchLinkedCourses = useCallback(async () => {
    try {
      const response = await getCoursesLinkedToProduct(org.id, productId, session.data?.tokens?.access_token);
      setLinkedCourses(response.data || []);
    } catch {
      toast.error(tNotify('errors.fetchLinkedCoursesFailed'));
    }
  }, [org.id, productId, session.data?.tokens?.access_token, tNotify]);

  const handleUnlinkCourse = async (courseId: string) => {
    try {
      const response = await unlinkCourseFromProduct(org.id, productId, courseId, session.data?.tokens?.access_token);
      if (response.success) {
        await fetchLinkedCourses();
        mutate([`/payments/${org.id}/products`, session.data?.tokens?.access_token]);
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

  useEffect(() => {
    if (org && session && productId) {
      fetchLinkedCourses();
    }
  }, [org, session, productId, fetchLinkedCourses]);

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
                fetchLinkedCourses();
              }}
            />
          }
          dialogTrigger={
            <Button
              variant="outline"
              size="sm"
              className="flex items-center gap-2"
            >
              <Plus size={16} />
              <span>{t('linkCourseButton')}</span>
            </Button>
          }
        />
      </div>

      <div className="space-y-2">
        {linkedCourses.length === 0 ? (
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
