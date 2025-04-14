'use client';
import React, { useState } from 'react';
import { useOrg } from '@components/Contexts/OrgContext';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { linkCourseToProduct } from '@services/payments/products';
import { Button } from "@components/ui/button";
import { Input } from "@components/ui/input";
import { Search } from 'lucide-react';
import toast from 'react-hot-toast';
import { mutate } from 'swr';
import useSWR from 'swr';
import { getOrgCourses } from '@services/courses/courses';
import { getCoursesLinkedToProduct } from '@services/payments/products';
import Link from 'next/link';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { getUriWithOrg } from '@services/config/config';
import { useTranslations } from 'next-intl';

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
    : '../empty_thumbnail.png';

  return (
    <div className="flex gap-4 p-4 bg-white rounded-lg border border-gray-100 hover:border-gray-200 transition-colors">
      {/* Thumbnail */}
      <div
        className="shrink-0 w-[120px] h-[68px] rounded-md bg-cover bg-center ring-1 ring-inset ring-black/10"
        style={{ backgroundImage: `url(${thumbnailImage})` }}
      />

      {/* Content */}
      <div className="grow space-y-1">
        <h3 className="font-medium text-gray-900 line-clamp-1">
          {course.name}
        </h3>
        <p className="text-sm text-gray-500 line-clamp-2">
          {course.description}
        </p>
      </div>

      {/* Action Button */}
      <div className="shrink-0 flex items-center">
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
            onClick={() => onLink(course.id)}
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
  const session = useLHSession() as any;
  const t = useTranslations('Payments.LinkCourseModal');
  const tNotify = useTranslations('Notifications');

  const { data: coursesData, error: coursesError } = useSWR(
    () => org && session ? [org.slug, session.data?.tokens?.access_token] : null,
    ([orgSlug, token]) => getOrgCourses(orgSlug, null, token)
  );

  const { data: linkedCoursesData, error: linkedCoursesError } = useSWR(
    () => org && session ? [`/payments/${org.id}/products/${productId}/courses`, session.data?.tokens?.access_token] : null,
    ([_, token]) => getCoursesLinkedToProduct(org.id, productId, token)
  );

  const handleLinkCourse = async (courseId: string) => {
    try {
      const response = await linkCourseToProduct(org.id, productId, courseId, session.data?.tokens?.access_token);
      if (response.success) {
        mutate([`/payments/${org.id}/products`, session.data?.tokens?.access_token]);
        toast.success(tNotify('courseLinkedSuccess'));
        onSuccess();
      } else {
        toast.error(tNotify('errors.linkCourseFailed', { error: response.data?.detail || '' }));
      }
    } catch (error) {
      toast.error(tNotify('errors.linkCourseFailed', { error: '' }));
    }
  };

  const isLinked = (courseId: string): boolean => {
    return !!linkedCoursesData?.data?.some((course: any) => course.id === courseId);
  };

  const filteredCourses = coursesData?.filter((course: any) =>
    course.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    course.description.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  return (
    <div className="space-y-4">
      <div className="relative px-3">
        <Input
          type="text"
          placeholder={t('searchPlaceholder')}
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full pl-10"
        />
        <Search className="absolute left-6 top-1/2 transform -translate-y-1/2 text-gray-400" size={20} />
      </div>

      <div className="max-h-[400px] overflow-y-auto space-y-2 px-3">
        {filteredCourses.map((course: any) => (
          <CoursePreview
            key={course.course_uuid}
            course={course}
            orgslug={org.slug}
            onLink={handleLinkCourse}
            isLinked={isLinked(course.id)}
          />
        ))}

        {filteredCourses.length === 0 && (
          <div className="text-center py-6 text-gray-500">
            {t('noCoursesFound')}
          </div>
        )}
      </div>
    </div>
  );
}
