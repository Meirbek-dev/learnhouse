import CertificatePreview from '@components/Dashboard/Pages/Course/EditCourseCertification/CertificatePreview';
import { ArrowLeft, BookOpen, Download, Loader2, Shield, Target, Trophy } from 'lucide-react';
import { useOptionalGamificationContext } from '@/components/Contexts/GamificationContext';
import { usePlatformSession } from '@components/Contexts/LHSessionContext';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { getUserCertificates } from '@services/courses/certifications';
import { useOrg } from '@components/Contexts/OrgContext';
import { getUriWithOrg } from '@services/config/config';
import { useLocale, useTranslations } from 'next-intl';
import { useWindowSize } from '@/hooks/useWindowSize';
import { useEffect, useRef, useState } from 'react';
// Gamification imports
import { LevelProgress } from '@/lib/gamification';
import Link from '@components/ui/ServerLink';
import ReactConfetti from 'react-confetti';
import html2canvas from 'html2canvas-pro';
import type { FC } from 'react';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';

interface CourseEndViewProps {
  courseName: string;
  orgslug: string;
  courseUuid: string;
  thumbnailImage: string;
  course: any;
  trailData: any;
}

const CourseEndView: FC<CourseEndViewProps> = ({
  courseName,
  orgslug,
  courseUuid,
  thumbnailImage,
  course,
  trailData,
}) => {
  const { width, height } = useWindowSize();
  const org = useOrg() as any;
  const session = usePlatformSession();
  const [userCertificate, setUserCertificate] = useState<any>(null);
  const [isLoadingCertificate, setIsLoadingCertificate] = useState(false);
  const [certificateError, setCertificateError] = useState<string | null>(null);
  const locale = useLocale();
  const t = useTranslations('Certificates.CourseEndView');
  const qrCodeLink = getUriWithOrg(
    orgslug,
    `/certificates/${userCertificate?.certificate_user.user_certification_uuid}/verify`,
  );

  // Gamification state via unified context
  const gamificationContext = useOptionalGamificationContext();
  const gamificationProfile = gamificationContext?.profile ?? null;
  const gamificationRefetch = gamificationContext?.refetch;

  // Refs to prevent repeated runs that may trigger network loops
  const fetchedCertificateRef = useRef(false);
  const refetchedOnMountRef = useRef(false);

  // Check if course is actually completed
  const isCourseCompleted = (() => {
    if (!(trailData && course)) return false;

    // Flatten all activities
    const allActivities = course.chapters.flatMap((chapter: any) =>
      chapter.activities.map((activity: any) => ({
        ...activity,
        chapterId: chapter.id,
      })),
    );

    // Check if all activities are completed
    const isActivityDone = (activity: any) => {
      const cleanCourseUuid = course.course_uuid?.replace('course_', '');
      const run = trailData?.runs?.find((run: any) => {
        const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
        return cleanRunCourseUuid === cleanCourseUuid;
      });

      if (run) {
        return run.steps.find((step: any) => step.activity_id === activity.id && step.complete === true);
      }
      return false;
    };

    const totalActivities = allActivities.length;
    const completedActivities = allActivities.filter((activity: any) => isActivityDone(activity)).length;
    return totalActivities > 0 && completedActivities === totalActivities;
  })();

  // Fetch user certificate when course is completed
  const isMountedFetchCertificateRef = useRef<boolean>(false);
  useEffect(() => {
    // Prevent repeated requests if we've already tried fetching the certificate
    if (!isCourseCompleted || fetchedCertificateRef.current) return;

    isMountedFetchCertificateRef.current = true;

    const fetchUserCertificate = async () => {
      // Mark as attempted to avoid loops; we can reset this manually if needed
      fetchedCertificateRef.current = true;

      if (!session?.data?.tokens?.access_token) {
        if (isMountedFetchCertificateRef.current) setCertificateError(t('authRequired'));
        return;
      }

      if (isMountedFetchCertificateRef.current) {
        setIsLoadingCertificate(true);
        setCertificateError(null);
      }

      try {
        const cleanCourseUuid = courseUuid.replace('course_', '');
        const result = await getUserCertificates(`course_${cleanCourseUuid}`, session.data.tokens.access_token);

        if (!isMountedFetchCertificateRef.current) return;

        if (result.success && result.data && result.data.length > 0) {
          setUserCertificate(result.data[0]);

          // Refetch gamification data to show course completion XP in recent activity
          if (typeof gamificationRefetch === 'function') {
            gamificationRefetch().catch((error) =>
              console.warn('Failed to refetch gamification after course completion:', error),
            );
          }
        } else {
          console.warn('No certificate found. Result:', result);
          setCertificateError(t('noCertificateFound'));
        }
      } catch (error) {
        console.error('Error fetching user certificate:', error);
        if (isMountedFetchCertificateRef.current) setCertificateError(t('loadingError'));
      } finally {
        if (isMountedFetchCertificateRef.current) setIsLoadingCertificate(false);
      }
    };

    fetchUserCertificate();

    // Only depend on stable primitives and the refetch function to avoid
    // triggering this effect when the whole context object identity changes.

    return () => {
      isMountedFetchCertificateRef.current = false;
    };
  }, [isCourseCompleted, courseUuid, session?.data?.tokens?.access_token, t, gamificationRefetch]);

  // Refetch gamification data on mount if course is completed
  // This ensures recent activity feed shows course completion XP
  useEffect(() => {
    if (!isCourseCompleted || typeof gamificationRefetch !== 'function') return;

    // Ensure we only trigger this refetch once on mount after completion
    if (refetchedOnMountRef.current) return;
    refetchedOnMountRef.current = true;

    const timer = setTimeout(() => {
      gamificationRefetch().catch((error) =>
        console.warn('Failed to refetch gamification on CourseEndView mount:', error),
      );
    }, 1000);
    return () => clearTimeout(timer);
  }, [isCourseCompleted, gamificationRefetch]);

  // Generate PDF using canvas
  const downloadCertificate = async () => {
    if (!userCertificate) return;

    try {
      // Helper function to get localized certification type
      const getCertificationTypeLabel = (type: string) => {
        switch (type) {
          case 'completion': {
            return t('certificationTypes.completion');
          }
          case 'achievement': {
            return t('certificationTypes.achievement');
          }
          case 'assessment': {
            return t('certificationTypes.assessment');
          }
          case 'participation': {
            return t('certificationTypes.participation');
          }
          case 'mastery': {
            return t('certificationTypes.mastery');
          }
          case 'professional': {
            return t('certificationTypes.professional');
          }
          case 'continuing': {
            return t('certificationTypes.continuing');
          }
          case 'workshop': {
            return t('certificationTypes.workshop');
          }
          case 'specialization': {
            return t('certificationTypes.specialization');
          }
          default: {
            return t('certificationTypes.completion');
          }
        }
      };

      // Create a temporary div for the certificate
      const certificateDiv = document.createElement('div');
      // Use a completely isolated style approach
      const baseStyle = `
        position: absolute !important;
        left: -9999px !important;
        top: 0 !important;
        width: 800px !important;
        height: 600px !important;
        background: #ffffff !important;
        padding: 40px !important;
        font-family: Arial, sans-serif !important;
        text-align: center !important;
        display: flex !important;
        flex-direction: column !important;
        justify-content: center !important;
        align-items: center !important;
        overflow: hidden !important;
        box-sizing: border-box !important;
        margin: 0 !important;
        border: none !important;
        outline: none !important;
        color: #000000 !important;
      `;
      certificateDiv.style.cssText = baseStyle;

      // Get theme colors based on pattern
      const getPatternTheme = (pattern: string) => {
        switch (pattern) {
          case 'royal': {
            return {
              primary: '#b45309',
              secondary: '#d97706',
              icon: '#d97706',
              iconLight: 'rgba(217, 119, 6, 0.2)',
              iconMedium: 'rgba(217, 119, 6, 0.4)',
              iconBorder: 'rgba(217, 119, 6, 0.2)',
            };
          }
          case 'tech': {
            return {
              primary: '#0e7490',
              secondary: '#0891b2',
              icon: '#0891b2',
              iconLight: 'rgba(8, 145, 178, 0.2)',
              iconMedium: 'rgba(8, 145, 178, 0.4)',
              iconBorder: 'rgba(8, 145, 178, 0.2)',
            };
          }
          case 'nature': {
            return {
              primary: '#15803d',
              secondary: '#16a34a',
              icon: '#16a34a',
              iconLight: 'rgba(22, 163, 74, 0.2)',
              iconMedium: 'rgba(22, 163, 74, 0.4)',
              iconBorder: 'rgba(22, 163, 74, 0.2)',
            };
          }
          case 'geometric': {
            return {
              primary: '#7c3aed',
              secondary: '#9333ea',
              icon: '#9333ea',
              iconLight: 'rgba(147, 51, 234, 0.2)',
              iconMedium: 'rgba(147, 51, 234, 0.4)',
              iconBorder: 'rgba(147, 51, 234, 0.2)',
            };
          }
          case 'vintage': {
            return {
              primary: '#c2410c',
              secondary: '#ea580c',
              icon: '#ea580c',
              iconLight: 'rgba(234, 88, 12, 0.2)',
              iconMedium: 'rgba(234, 88, 12, 0.4)',
              iconBorder: 'rgba(234, 88, 12, 0.2)',
            };
          }
          case 'waves': {
            return {
              primary: '#1d4ed8',
              secondary: '#2563eb',
              icon: '#2563eb',
              iconLight: 'rgba(37, 99, 235, 0.2)',
              iconMedium: 'rgba(37, 99, 235, 0.4)',
              iconBorder: 'rgba(37, 99, 235, 0.2)',
            };
          }
          case 'minimal': {
            return {
              primary: '#374151',
              secondary: '#4b5563',
              icon: '#4b5563',
              iconLight: 'rgba(75, 85, 99, 0.2)',
              iconMedium: 'rgba(75, 85, 99, 0.4)',
              iconBorder: 'rgba(75, 85, 99, 0.2)',
            };
          }
          case 'professional': {
            return {
              primary: '#334155',
              secondary: '#475569',
              icon: '#475569',
              iconLight: 'rgba(71, 85, 105, 0.2)',
              iconMedium: 'rgba(71, 85, 105, 0.4)',
              iconBorder: 'rgba(71, 85, 105, 0.2)',
            };
          }
          case 'academic': {
            return {
              primary: '#3730a3',
              secondary: '#4338ca',
              icon: '#4338ca',
              iconLight: 'rgba(67, 56, 202, 0.2)',
              iconMedium: 'rgba(67, 56, 202, 0.4)',
              iconBorder: 'rgba(67, 56, 202, 0.2)',
            };
          }
          case 'modern': {
            return {
              primary: '#1d4ed8',
              secondary: '#2563eb',
              icon: '#2563eb',
              iconLight: 'rgba(37, 99, 235, 0.2)',
              iconMedium: 'rgba(37, 99, 235, 0.4)',
              iconBorder: 'rgba(37, 99, 235, 0.2)',
            };
          }
          default: {
            return {
              primary: '#374151',
              secondary: '#4b5563',
              icon: '#4b5563',
              iconLight: 'rgba(75, 85, 99, 0.2)',
              iconMedium: 'rgba(75, 85, 99, 0.4)',
              iconBorder: 'rgba(75, 85, 99, 0.2)',
            };
          }
        }
      };

      const theme = getPatternTheme(userCertificate.certification.config.certificate_pattern);
      const certificateId = userCertificate.certificate_user.user_certification_uuid;
      const qrCodeData = qrCodeLink;

      // Generate QR code
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeData, {
        width: 120,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'M',
        type: 'image/png',
      });

      // Create certificate content
      certificateDiv.innerHTML = `
        <div style="
          position: absolute;
          top: 20px;
          left: 20px;
          font-size: 12px;
          color: ${theme.secondary};
          font-weight: 500;
        ">ID: ${certificateId}</div>

        <div style="
          position: absolute;
          top: 20px;
          right: 20px;
          width: 80px;
          height: 80px;
          border: 2px solid ${theme.secondary};
          border-radius: 8px;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        ">
          <img src="${qrCodeDataUrl}" alt="${t('qrCodeAlt')}" style="width: 100%; height: 100%; object-fit: contain;" />
        </div>

        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-bottom: 30px;
          font-size: 14px;
          color: ${theme.secondary};
          font-weight: 500;
          text-transform: uppercase;
          letter-spacing: 1px;
        ">
          <div style="width: 24px; height: 1px; background: linear-gradient(90deg, transparent, ${theme.secondary}, transparent);"></div>
          ${t('certificate')}
          <div style="width: 24px; height: 1px; background: linear-gradient(90deg, transparent, ${theme.secondary}, transparent);"></div>
        </div>

        <div style="
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, ${theme.iconLight} 0%, ${theme.iconMedium} 100%);
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 30px;
          font-size: 40px;
          line-height: 1;
        ">🏆</div>

        <div style="
          font-size: 32px;
          font-weight: bold;
          color: ${theme.primary};
          margin-bottom: 20px;
          line-height: 1.2;
          max-width: 600px;
        ">${userCertificate.certification.config.certification_name}</div>

        <div style="
          font-size: 18px;
          color: #6b7280;
          margin-bottom: 30px;
          line-height: 1.5;
          max-width: 500px;
        ">${userCertificate.certification.config.certification_description || t('defaultCertificationDescription')}</div>

        <div style="
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 4px;
          margin: 20px 0;
        ">
          <div style="width: 8px; height: 1px; background: ${theme.secondary}; opacity: 0.5;"></div>
          <div style="width: 4px; height: 4px; background: ${theme.primary}; border-radius: 50%; opacity: 0.6;"></div>
          <div style="width: 8px; height: 1px; background: ${theme.secondary}; opacity: 0.5;"></div>
        </div>

        <div style="
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 16px;
          color: ${theme.primary};
          background: ${theme.iconLight};
          padding: 12px 24px;
          border-radius: 20px;
          border: 1px solid ${theme.iconBorder};
          font-weight: 500;
          margin-bottom: 30px;
          white-space: nowrap;
        ">
          <span style="font-weight: bold; font-size: 18px;">✓</span>
          <span>${getCertificationTypeLabel(userCertificate.certification.config.certification_type)}</span>
        </div>

        <div style="
          margin-top: 30px;
          padding: 24px;
          background: #f8fafc;
          border-radius: 8px;
          border: 1px solid #e2e8f0;
          max-width: 400px;
        ">
          <div style="margin: 8px 0; font-size: 14px; color: #374151;">
            <strong style="color: ${theme.primary};">${t('certificateId')}:</strong> ${certificateId}
          </div>
          <div style="margin: 8px 0; font-size: 14px; color: #374151;">
            <strong style="color: ${theme.primary};">${t('labelAwarded')}:</strong> ${new Date(
              userCertificate.certificate_user.created_at,
            ).toLocaleDateString(locale, {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })}
          </div>
          ${
            userCertificate.certification.config.certificate_instructor
              ? `<div style="margin: 8px 0; font-size: 14px; color: #374151;">
              <strong style="color: ${theme.primary};">${t('instructor')}:</strong> ${userCertificate.certification.config.certificate_instructor}
            </div>`
              : ''
          }
        </div>

        <div style="
          margin-top: 20px;
          font-size: 12px;
          color: #6b7280;
        ">
          ${t('certificateCanBeVerified')} ${qrCodeLink}
        </div>
      `;

      // Add to document temporarily
      document.body.appendChild(certificateDiv);

      // Convert to canvas
      const canvas = await html2canvas(certificateDiv, {
        width: 800,
        height: 600,
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: '#ffffff',
        logging: false,
      });

      // Remove temporary div
      document.body.removeChild(certificateDiv);

      // Create PDF
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('landscape', 'mm', 'a4');

      // Calculate dimensions to center the certificate
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = 280; // mm
      const imgHeight = 210; // mm

      // Center the image
      const x = (pdfWidth - imgWidth) / 2;
      const y = (pdfHeight - imgHeight) / 2;

      pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);

      // Save the PDF
      const fileName = `${userCertificate.certification.config.certification_name.replaceAll(/[^\dA-Za-z]/g, '_')}_Certificate.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(t('errorGeneratingPDF'));
    }
  };

  // Calculate progress for incomplete courses
  const progressInfo = (() => {
    if (!(trailData && course) || isCourseCompleted) return null;

    const allActivities = course.chapters.flatMap((chapter: any) =>
      chapter.activities.map((activity: any) => ({
        ...activity,
        chapterId: chapter.id,
      })),
    );

    const isActivityDone = (activity: any) => {
      const cleanCourseUuid = course.course_uuid?.replace('course_', '');
      const run = trailData?.runs?.find((run: any) => {
        const cleanRunCourseUuid = run.course?.course_uuid?.replace('course_', '');
        return cleanRunCourseUuid === cleanCourseUuid;
      });

      if (run) {
        return run.steps.find((step: any) => step.activity_id === activity.id && step.complete === true);
      }
      return false;
    };

    const totalActivities = allActivities.length;
    const completedActivities = allActivities.filter((activity: any) => isActivityDone(activity)).length;
    const progressPercentage = Math.round((completedActivities / totalActivities) * 100);

    return {
      completed: completedActivities,
      total: totalActivities,
      percentage: progressPercentage,
    };
  })();

  if (isCourseCompleted) {
    // Show congratulations for completed course
    return (
      <div className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-4 text-center">
        <div className="pointer-events-none fixed inset-0">
          <ReactConfetti
            width={width}
            height={height}
            numberOfPieces={200}
            recycle={false}
            colors={['#6366f1', '#10b981', '#3b82f6']}
          />
        </div>

        <div className="soft-shadow relative z-10 mb-2 w-full space-y-6 rounded-2xl bg-white p-8">
          <div className="flex flex-col items-center space-y-6">
            {thumbnailImage ? (
              <img
                className="h-[114px] w-[200px] rounded-lg object-cover shadow-md"
                src={`${getCourseThumbnailMediaDirectory(org?.org_uuid, courseUuid, thumbnailImage)}`}
                alt={courseName}
              />
            ) : null}

            <div className="rounded-full bg-emerald-100 p-4">
              <Trophy className="h-16 w-16 text-emerald-600" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-gray-900">{t('congratulations')} 🎉</h1>

          <p className="text-xl text-gray-600">
            {t('courseCompleted')}
            <span className="font-semibold text-gray-900"> {courseName}</span>
          </p>

          <p className="text-gray-500">{t('completionDescription')}</p>

          {/* Gamification Celebration */}
          {gamificationProfile && (
            <div className="space-y-4 rounded-lg border border-yellow-200 bg-linear-to-br from-yellow-50 to-orange-50 p-6">
              <div className="flex items-center justify-center space-x-2">
                <Trophy className="h-6 w-6 text-yellow-600" />
                <h3 className="text-xl font-semibold text-gray-900">{t('learningAchievementUnlocked')}</h3>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <div className="text-center">
                    {gamificationProfile && (
                      <LevelProgress
                        profile={gamificationProfile}
                        showMilestones={false}
                        className="justify-center"
                      />
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-center space-x-2 text-green-600">
                    <Target className="h-5 w-5" />
                    <span className="font-semibold">{t('xpBonusMessage')}</span>
                  </div>
                  <div className="text-center text-sm text-gray-600">{t('keepLearningMessage')}</div>
                </div>
              </div>
            </div>
          )}

          {/* Certificate Display */}
          {isLoadingCertificate ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="ml-3 text-gray-600">{t('loadingCertificate')}</span>
            </div>
          ) : certificateError ? (
            <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
              <p className="text-yellow-800">{certificateError}</p>
            </div>
          ) : userCertificate ? (
            <div className="space-y-4">
              <h2 className="text-2xl font-semibold text-gray-900">{t('earnedCertificate')}</h2>
              <div
                className="mx-auto max-w-2xl"
                id="certificate-preview"
              >
                <div id="certificate-content">
                  <CertificatePreview
                    certificationName={userCertificate.certification.config.certification_name}
                    certificationDescription={userCertificate.certification.config.certification_description}
                    certificationType={userCertificate.certification.config.certification_type}
                    certificatePattern={userCertificate.certification.config.certificate_pattern}
                    certificateInstructor={userCertificate.certification.config.certificate_instructor}
                    certificateId={userCertificate.certificate_user.user_certification_uuid}
                    awardedDate={new Date(userCertificate.certificate_user.created_at).toLocaleDateString(locale, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                    qrCodeLink={qrCodeLink}
                  />
                </div>
              </div>
              <div className="flex justify-center space-x-4">
                <button
                  onClick={downloadCertificate}
                  className="inline-flex items-center space-x-2 rounded-full bg-green-600 px-6 py-3 text-white transition duration-200 hover:bg-green-700"
                >
                  <Download className="h-5 w-5" />
                  <span>{t('downloadCertificate')}</span>
                </button>
                <Link
                  prefetch={false}
                  href={getUriWithOrg(
                    orgslug,
                    `/certificates/${userCertificate.certificate_user.user_certification_uuid}/verify`,
                  )}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center space-x-2 rounded-full bg-blue-600 px-6 py-3 text-white transition duration-200 hover:bg-blue-700"
                >
                  <Shield className="h-5 w-5" />
                  <span>{t('verifyCertificate')}</span>
                </Link>
              </div>
            </div>
          ) : (
            <div className="rounded-lg bg-gray-50 p-6">
              <p className="text-gray-600">{t('noCertificateAvailable')}</p>
            </div>
          )}

          <div className="pt-6">
            <Link
              prefetch={false}
              href={getUriWithOrg(orgslug, `/course/${courseUuid.replace('course_', '')}`)}
              className="inline-flex items-center space-x-2 rounded-full bg-gray-800 px-6 py-3 text-white transition duration-200 hover:bg-gray-700"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>{t('backToCourse')}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }
  // Show progress and encouragement for incomplete course
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center">
      <div className="soft-shadow w-full max-w-2xl space-y-6 rounded-2xl bg-white p-8">
        <div className="flex flex-col items-center space-y-6">
          {thumbnailImage ? (
            <img
              className="h-[114px] w-[200px] rounded-lg object-cover shadow-md"
              src={`${getCourseThumbnailMediaDirectory(org?.org_uuid, courseUuid, thumbnailImage)}`}
              alt={courseName}
            />
          ) : null}

          <div className="rounded-full bg-blue-100 p-4">
            <Target className="h-16 w-16 text-blue-600" />
          </div>
        </div>

        <h1 className="text-4xl font-bold text-gray-900">{t('keepGoing')} 💪</h1>

        <p className="text-xl text-gray-600">
          {t('youAreMakingProgress')}
          <span className="font-semibold text-gray-900"> {courseName}</span>
        </p>

        {progressInfo ? (
          <div className="space-y-4 rounded-lg bg-gray-50 p-6">
            <div className="flex items-center justify-center space-x-2">
              <BookOpen className="h-5 w-5 text-gray-600" />
              <span className="text-lg font-semibold text-gray-700">{t('courseProgress')}</span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">{t('progress')}</span>
                <span className="font-semibold text-gray-900">{progressInfo.percentage}%</span>
              </div>

              <div className="h-3 w-full rounded-full bg-gray-200">
                <div
                  className="h-3 rounded-full bg-blue-600 transition-all duration-500"
                  style={{ width: `${progressInfo.percentage}%` }}
                />
              </div>

              <div className="text-sm text-gray-500">
                {t('progressCompleted', { completed: progressInfo.completed, total: progressInfo.total })}
              </div>
            </div>
          </div>
        ) : null}

        <p className="text-gray-500">{t('encouragementMessage')}</p>

        <div className="pt-6">
          <Link
            href={getUriWithOrg(orgslug, `/course/${courseUuid.replace('course_', '')}`)}
            className="inline-flex items-center space-x-2 rounded-full bg-blue-600 px-6 py-3 text-white transition duration-200 hover:bg-blue-700"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>{t('continueActivity')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CourseEndView;
