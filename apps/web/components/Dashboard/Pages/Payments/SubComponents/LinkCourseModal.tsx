'use client';

import { getCoursesLinkedToProduct, linkCourseToProduct } from '@services/payments/products';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { getOrgCourses } from '@services/courses/courses';
import { useOrg } from '@components/Contexts/OrgContext';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { getPaymentsProductsSwrKey } from '@services/payments/keys';
import { useState } from 'react';
import { toast } from 'sonner';

interface LinkCourseModalProps {
  productId: string;
  onSuccess: () => void;
}

interface CoursePreviewProps {
  course: {
    id: string;
    name: string;
    description: string;
    thumbnail_image: string;
    course_uuid: string;
  };
  orgslug: string;
  onLink: (courseId: string) => void;
  isLinked: boolean;
}

const CoursePreview = ({ course, orgslug, onLink, isLinked }: CoursePreviewProps) => {
  const org = useOrg() as any;
  const t = useTranslations('Payments.LinkCourseModal');

  const thumbnailImage = course.thumbnail_image
    ? getCourseThumbnailMediaDirectory(org?.org_uuid, course.course_uuid, course.thumbnail_image)
    : '../empty_thumbnail.webp';

  return (
    <div className="flex gap-4 rounded-lg border border-gray-100 bg-white p-4 transition-colors hover:border-gray-200">
      {/* Thumbnail */}
      <div
        className="h-[68px] w-[120px] shrink-0 rounded-md bg-cover bg-center ring-1 ring-black/10 ring-inset"
        style={{ backgroundImage: `url(${thumbnailImage})` }}
      />

      {/* Content */}
      <div className="grow space-y-1">
        <h3 className="line-clamp-1 font-medium text-gray-900">{course.name}</h3>
        <p className="line-clamp-2 text-sm text-gray-500">{course.description}</p>
      </div>

      {/* Action Button */}
      <div className="flex shrink-0 items-center">
        {isLinked ? (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="text-gray-500"
          >
            {t('alreadyLinked')}
          </Button>
        ) : (
          <Button
            onClick={() => {
              onLink(course.id);
            }}
            size="sm"
          >
            {t('linkCourseButton')}
          </Button>
        )}
      </div>
    </div>
  );
};

export default function LinkCourseModal({ productId, onSuccess }: LinkCourseModalProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const org = useOrg() as any;
  const session = usePlatformSession() as any;
  const accessToken = session?.data?.tokens?.access_token;
  const orgId = org?.id;
  const tNotify = useTranslations('DashPage.Notifications');
  const t = useTranslations('DashPage.Payments.LinkCourseModal');

  const PRODUCTS_KEY = getPaymentsProductsSwrKey(orgId);

  const { data: coursesData, error: coursesError } = useSWR(
    () => (org?.slug && accessToken ? [org.slug, accessToken] : null),
    ([orgSlug, token]) => getOrgCourses(orgSlug, null, token),
  );


  const { data: linkedCoursesData, error: linkedCoursesError } = useSWR(
    () => (orgId && accessToken ? [`/payments/${orgId}/products/${productId}/courses`, accessToken] : null),
    ([_, token]) => getCoursesLinkedToProduct(orgId, productId, token),
  );

  const handleLinkCourse = async (courseId: string) => {
    try {
      const response = await linkCourseToProduct(orgId, productId, courseId, accessToken);
      if (response.success) {
        mutate([getPaymentsProductsSwrKey(orgId), accessToken]);
        toast.success(tNotify('courseLinkedSuccess'));
        onSuccess();
      } else {
        toast.error(
          tNotify('errors.linkCourseFailed', {
            error: response.data?.detail || '',
          }),
        );
      }
    } catch {
      toast.error(tNotify('errors.linkCourseFailed', { error: '' }));
    }
  };

  const isLinked = (courseId: number): boolean => {
    return Boolean(linkedCoursesData?.data?.some((course: any) => course.id === courseId));
  };

  const filteredCourses =
    coursesData?.filter(
      (course: any) =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        course.description.toLowerCase().includes(searchTerm.toLowerCase()),
    ) || [];

  return (
    <div className="space-y-4">
      <div className="relative px-3">
        <Input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value);
          }}
          className="w-full pl-10"
        />
        <Search
          className="absolute top-1/2 left-6 -translate-y-1/2 text-gray-400"
          size={20}
        />
      </div>

      <div className="max-h-[400px] space-y-2 overflow-y-auto px-3">
        {filteredCourses.map((course: any) => (
          <CoursePreview
            key={course.course_uuid}
            course={course}
            orgslug={org.slug}
            onLink={handleLinkCourse}
            isLinked={isLinked(course.id)}
          />
        ))}

        {filteredCourses.length === 0 && <div className="py-6 text-center text-gray-500">{t('noCoursesFound')}</div>}
      </div>
    </div>
  );
}
