'use client';
import { useQueryClient } from '@tanstack/react-query';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { getUserCertificates } from '@services/courses/certifications';
import { queryKeys } from '@/lib/react-query/queryKeys';
import { revalidateTags } from '@/lib/api-client';
import { Award, ExternalLink, Loader2 } from 'lucide-react';
import { removeCourse } from '@services/courses/activity';
import { getAbsoluteUrl } from '@services/config/config';
import { Card, CardContent } from '@components/ui/card';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';

interface TrailCourseElementProps {
  course: any;
  run: any;
}

const TrailCourseElement = ({ course, run }: TrailCourseElementProps) => {
  const queryClient = useQueryClient();
  const courseid = course.course_uuid.replace('course_', '');
  const router = useRouter();
  const t = useTranslations('Trail');
  const { course_total_steps } = run;
  const course_completed_steps = run.steps.length;
  const course_progress = course_total_steps > 0 ? Math.round((course_completed_steps / course_total_steps) * 100) : 0;
  const [courseCertificate, setCourseCertificate] = useState<any>(null);
  const [isLoadingCertificate, setIsLoadingCertificate] = useState(false);
  const fetchedCourseCertificateRef = useRef<Record<string, boolean>>({});

  async function quitCourse(course_uuid: string) {
    // Close activity
    await removeCourse(course_uuid);
    // Mutate course
    await revalidateTags(['courses']);
    router.refresh();

    await queryClient.invalidateQueries({ queryKey: queryKeys.trail.current() });
  }

  // Fetch certificate for this course
  useEffect(() => {
    // Avoid repeated fetches for the same course if we've already tried
    if (course_progress < 100) return;
    if (fetchedCourseCertificateRef.current[course.course_uuid]) return;

    const fetchCourseCertificate = async () => {
      fetchedCourseCertificateRef.current[course.course_uuid] = true;
      setIsLoadingCertificate(true);
      try {
        const result = await getUserCertificates(course.course_uuid);

        if (result.success && result.data && result.data.length > 0) {
          setCourseCertificate(result.data[0]);
        }
      } catch (error) {
        console.error('Error fetching course certificate:', error);
      } finally {
        setIsLoadingCertificate(false);
      }
    };

    fetchCourseCertificate();
  }, [course_progress, course.course_uuid]);

  return (
    <Card className="trailcoursebox border-border bg-card text-card-foreground flex rounded-xl border p-3 shadow-sm">
      <CardContent className="p-0">
        <Link
          prefetch={false}
          href={getAbsoluteUrl(`/course/${courseid}`)}
        >
          <div
            className="course_tumbnail ring-border relative inset-0 h-[50px] w-[72px] rounded-lg bg-cover bg-center ring-1 ring-inset"
            style={{
              backgroundImage: course.thumbnail_image
                ? `url(${getCourseThumbnailMediaDirectory(course.course_uuid, course.thumbnail_image)})`
                : `url('/empty_thumbnail.webp')`,
            }}
          />
        </Link>
        <div className="course_meta grow space-y-1 pl-5">
          <div className="course_top">
            <div className="course_info flex">
              <div className="course_basic flex-end flex flex-col -space-y-2">
                <p className="text-muted-foreground p-0 pb-1 text-sm font-bold">{t('courseLabel')}</p>
                <div className="flex items-center space-x-2">
                  <h2 className="text-foreground text-xl font-bold">{course.name}</h2>
                  <div className="bg-muted-foreground/30 h-[5px] w-[10px] rounded-full" />
                  <h2 className="text-foreground">{course_progress}%</h2>
                </div>
              </div>
              <div className="course_actions flex grow flex-row-reverse">
                <button
                  onClick={() => quitCourse(course.course_uuid)}
                  className="bg-destructive/10 text-destructive hover:bg-destructive/20 h-5 rounded-full px-2 text-xs font-semibold"
                >
                  {t('quitCourseButton')}
                </button>
              </div>
            </div>
          </div>
          <div className="indicator w-full">
            <div className="bg-muted h-1.5 w-full rounded-full">
              <div
                className="bg-primary h-1.5 rounded-full"
                style={{ width: `${course_progress}%` }}
              />
            </div>
          </div>

          {/* Certificate Section */}
          {course_progress === 100 && (
            <div className="border-border mt-2 border-t pt-2">
              {isLoadingCertificate ? (
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{t('loadingCertificate')}</span>
                </div>
              ) : courseCertificate ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Award className="text-primary h-3 w-3" />
                    <span className="text-foreground text-xs font-medium">{t('viewCertificate')}</span>
                  </div>
                  <Link
                    prefetch={false}
                    href={getAbsoluteUrl(
                      `/certificates/${courseCertificate.certificate_user.user_certification_uuid}/verify`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary hover:text-primary/80 inline-flex items-center gap-1 text-xs font-medium"
                  >
                    <span>{t('downloadCertificate')}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="text-muted-foreground flex items-center gap-1 text-xs">
                  <Award className="text-muted-foreground/40 h-3 w-3" />
                  <span>{t('noCertificateAvailable')}</span>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default TrailCourseElement;
