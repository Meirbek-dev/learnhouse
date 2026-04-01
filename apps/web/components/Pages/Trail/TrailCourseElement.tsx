'use client';
import { usePlatformSession } from '@/components/Contexts/SessionContext';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { getUserCertificates } from '@services/courses/certifications';
import { revalidateTags } from '@services/utils/ts/requests';
import { Award, ExternalLink, Loader2 } from 'lucide-react';
import { removeCourse } from '@services/courses/activity';
import { getAbsoluteUrl } from '@services/config/config';
import { getTrailSwrKey } from '@services/courses/keys';
import { Card, CardContent } from '@components/ui/card';
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from '@components/ui/AppLink';
import { mutate } from 'swr';

interface TrailCourseElementProps {
  course: any;
  run: any;
}

const TrailCourseElement = ({ course, run }: TrailCourseElementProps) => {
  const session = usePlatformSession() as any;
  const access_token = session?.data?.tokens?.access_token;
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
    await removeCourse(course_uuid, access_token);
    // Mutate course
    await revalidateTags(['courses']);
    router.refresh();

    // Mutate
    mutate([getTrailSwrKey(), access_token]);
  }

  // Fetch certificate for this course
  useEffect(() => {
    // Avoid repeated fetches for the same course if we've already tried
    if (!access_token || course_progress < 100) return;
    if (fetchedCourseCertificateRef.current[course.course_uuid]) return;

    const fetchCourseCertificate = async () => {
      fetchedCourseCertificateRef.current[course.course_uuid] = true;
      setIsLoadingCertificate(true);
      try {
        const result = await getUserCertificates(course.course_uuid, access_token);

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
  }, [access_token, course_progress, course.course_uuid]);

  return (
    <Card
      className="trailcoursebox flex rounded-xl border border-border bg-card p-3 text-card-foreground shadow-sm"
    >
      <CardContent className="p-0">
        <Link
          prefetch={false}
          href={getAbsoluteUrl(`/course/${courseid}`)}
        >
          <div
            className="course_tumbnail relative inset-0 h-[50px] w-[72px] rounded-lg bg-cover bg-center ring-1 ring-border ring-inset"
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
                <p className="p-0 pb-1 text-sm font-bold text-muted-foreground">{t('courseLabel')}</p>
                <div className="flex items-center space-x-2">
                  <h2 className="text-xl font-bold text-foreground">{course.name}</h2>
                  <div className="h-[5px] w-[10px] rounded-full bg-muted-foreground/30" />
                  <h2 className="text-foreground">{course_progress}%</h2>
                </div>
              </div>
              <div className="course_actions flex grow flex-row-reverse">
                <button
                  onClick={() => quitCourse(course.course_uuid)}
                  className="h-5 rounded-full bg-destructive/10 px-2 text-xs font-semibold text-destructive hover:bg-destructive/20"
                >
                  {t('quitCourseButton')}
                </button>
              </div>
            </div>
          </div>
          <div className="indicator w-full">
            <div className="h-1.5 w-full rounded-full bg-muted">
              <div
                className="h-1.5 rounded-full bg-primary"
                style={{ width: `${course_progress}%` }}
              />
            </div>
          </div>

          {/* Certificate Section */}
          {course_progress === 100 && (
            <div className="mt-2 border-t border-border pt-2">
              {isLoadingCertificate ? (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Loader2 className="h-3 w-3 animate-spin" />
                  <span>{t('loadingCertificate')}</span>
                </div>
              ) : courseCertificate ? (
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1">
                    <Award className="h-3 w-3 text-primary" />
                    <span className="text-xs font-medium text-foreground">{t('viewCertificate')}</span>
                  </div>
                  <Link
                    prefetch={false}
                    href={getAbsoluteUrl(
                      `/certificates/${courseCertificate.certificate_user.user_certification_uuid}/verify`,
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:text-primary/80"
                  >
                    <span>{t('downloadCertificate')}</span>
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                </div>
              ) : (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Award className="h-3 w-3 text-muted-foreground/40" />
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
