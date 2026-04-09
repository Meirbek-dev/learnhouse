'use client';

import type { components } from '@/lib/api/generated';
import { useQuery, useQueryClient } from '@tanstack/react-query';

import { getCoursesLinkedToProduct, linkCourseToProduct } from '@services/payments/products';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { getCourses } from '@services/courses/courses';
import { Button } from '@components/ui/button';
import { Input } from '@components/ui/input';
import { useTranslations } from 'next-intl';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

type CourseRead = components['schemas']['CourseRead'];

interface CoursePreviewData {
  id: number;
  name: string;
  description: string;
  thumbnail_image: string;
  course_uuid: string;
}

interface LinkCourseModalProps {
  productId: number;
  onSuccess: () => void;
}

interface CoursePreviewProps {
  course: CoursePreviewData;
  onLink: (courseId: number) => void;
  isLinked: boolean;
}

const CoursePreview = ({ course, onLink, isLinked }: CoursePreviewProps) => {
  const t = useTranslations('Payments.LinkCourseModal');

  const thumbnailImage = course.thumbnail_image
    ? getCourseThumbnailMediaDirectory(course.course_uuid, course.thumbnail_image)
    : '../empty_thumbnail.webp';

  return (
    <div className="border-border bg-card hover:border-border/80 flex gap-4 rounded-lg border p-4 transition-colors">
      {/* Thumbnail */}
      <div
        className="ring-border/40 h-[68px] w-[120px] shrink-0 rounded-md bg-cover bg-center ring-1 ring-inset"
        style={{ backgroundImage: `url(${thumbnailImage})` }}
      />

      {/* Content */}
      <div className="grow space-y-1">
        <h3 className="text-foreground line-clamp-1 font-medium">{course.name}</h3>
        <p className="text-muted-foreground line-clamp-2 text-sm">{course.description ?? ''}</p>
      </div>

      {/* Action Button */}
      <div className="flex shrink-0 items-center">
        {isLinked ? (
          <Button
            variant="outline"
            size="sm"
            disabled
            className="text-muted-foreground"
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
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const tNotify = useTranslations('DashPage.Notifications');
  const t = useTranslations('DashPage.Payments.LinkCourseModal');

  const { data: coursesData, error: coursesError } = useQuery({
    queryKey: queryKeys.platform.courses(),
    queryFn: () => getCourses(null),
  });

  const courses = coursesData?.courses;

  const { data: linkedCoursesData, error: linkedCoursesError } = useQuery({
    queryKey: queryKeys.payments.productCourses(productId),
    queryFn: () => getCoursesLinkedToProduct(productId),
  });

  const handleLinkCourse = async (courseId: number) => {
    try {
      const response = await linkCourseToProduct(productId, courseId);
      if (response.success) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: queryKeys.payments.products() }),
          queryClient.invalidateQueries({ queryKey: queryKeys.payments.productCourses(productId) }),
        ]);
        toast.success(tNotify('courseLinkedSuccess'));
        onSuccess();
      } else {
        toast.error(
          tNotify('errors.linkCourseFailed', {
            error: response.data?.message || '',
          }),
        );
      }
    } catch {
      toast.error(tNotify('errors.linkCourseFailed', { error: '' }));
    }
  };

  const linkedCourses = linkedCoursesData?.data ?? [];

  const isLinked = (courseId: number): boolean => linkedCourses.some((course) => course.id === courseId);

  const filteredCourses =
    courses?.filter(
      (course) =>
        course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (course.description ?? '').toLowerCase().includes(searchTerm.toLowerCase()),
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
          className="text-muted-foreground absolute top-1/2 left-6 -translate-y-1/2"
          size={20}
        />
      </div>

      <div className="max-h-[400px] space-y-2 overflow-y-auto px-3">
        {filteredCourses.map((course) => (
          <CoursePreview
            key={course.course_uuid}
            course={{
              id: course.id,
              name: course.name,
              description: course.description,
              thumbnail_image: course.thumbnail_image,
              course_uuid: course.course_uuid,
            }}
            onLink={handleLinkCourse}
            isLinked={isLinked(course.id)}
          />
        ))}

        {filteredCourses.length === 0 && (
          <div className="text-muted-foreground py-6 text-center">{t('noCoursesFound')}</div>
        )}
      </div>
    </div>
  );
}
