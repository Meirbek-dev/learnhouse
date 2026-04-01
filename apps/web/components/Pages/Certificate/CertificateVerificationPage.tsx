'use client';

import CertificatePreview from '@components/Dashboard/Pages/Course/EditCourseCertification/CertificatePreview';
import { AlertTriangle, ArrowLeft, CheckCircle, Loader2, Shield, XCircle } from 'lucide-react';
import { getCourseThumbnailMediaDirectory } from '@services/media/media';
import { getCertificateByUuid } from '@services/courses/certifications';
import { useEffect, useEffectEvent, useState } from 'react';
import { getAbsoluteUrl } from '@services/config/config';
import { useLocale, useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';
import Link from '@components/ui/AppLink';
import type React from 'react';

interface CertificateVerificationPageProps {
  certificateUuid: string;
}

const CertificateVerificationPage: React.FC<CertificateVerificationPageProps> = ({ certificateUuid }) => {
  const [certificateData, setCertificateData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [verificationStatus, setVerificationStatus] = useState<'valid' | 'invalid' | 'loading'>('loading');
  const locale = useLocale();
  const t = useTranslations('Certificates.CertificateVerificationPage');
  // Certificate type translation helper
  const getCertificationTypeLabel = (type: string): string => {
    const typeKey = type as keyof typeof t;
    return t(typeKey) || t('completion');
  };

  // Fetch certificate data
  const fetchCertificateEvent = useEffectEvent(async (signal?: AbortSignal) => {
    try {
      const result = await getCertificateByUuid(certificateUuid);

      if (signal?.aborted) return;

      if (result.success && result.data) {
        setCertificateData(result.data);
        setVerificationStatus('valid');
      } else {
        setError(t('certificateNotFound'));
        setVerificationStatus('invalid');
      }
    } catch (error) {
      console.error('Error fetching certificate:', error);
      if (signal?.aborted) return;
      setError(t('verificationFailed'));
      setVerificationStatus('invalid');
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  });

  useEffect(() => {
    const controller = new AbortController();
    setIsLoading(true);
    fetchCertificateEvent(controller.signal);
    return () => controller.abort();
  }, [certificateUuid]);

  const getVerificationStatusIcon = () => {
    switch (verificationStatus) {
      case 'valid': {
        return <CheckCircle className="h-8 w-8 text-green-600" />;
      }
      case 'invalid': {
        return <XCircle className="h-8 w-8 text-red-600" />;
      }
      case 'loading': {
        return <AlertTriangle className="h-8 w-8 text-yellow-600" />;
      }
      default: {
        return <AlertTriangle className="h-8 w-8 text-yellow-600" />;
      }
    }
  };

  const getVerificationStatusText = () => {
    switch (verificationStatus) {
      case 'valid': {
        return t('certificateVerified');
      }
      case 'invalid': {
        return t('certificateNotFound');
      }
      case 'loading': {
        return t('verifyingCertificate');
      }
      default: {
        return t('verificationStatusUnknown');
      }
    }
  };

  const getVerificationStatusColor = () => {
    switch (verificationStatus) {
      case 'valid': {
        return 'text-green-600 bg-green-50 border-green-200';
      }
      case 'invalid': {
        return 'text-red-600 bg-red-50 border-red-200';
      }
      case 'loading': {
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      }
      default: {
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      }
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <div className="soft-shadow w-full max-w-4xl space-y-6 rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-sm">
          <div className="flex items-center justify-center">
            <Loader2 className="h-12 w-12 animate-spin" />
          </div>
          <div className="text-center">
            <h1 className="mb-2 text-2xl font-bold text-foreground">{t('verifyingCertificate')}</h1>
            <p className="text-muted-foreground">{t('loadingCertificate')}</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || verificationStatus === 'invalid') {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background text-foreground">
        <div className="soft-shadow w-full max-w-2xl space-y-6 rounded-2xl border border-border bg-card p-8 text-card-foreground shadow-sm">
          <div className="flex flex-col items-center space-y-4">
            <div className="rounded-full bg-destructive/10 p-4">
              <XCircle className="h-16 w-16 text-destructive" />
            </div>
            <h1 className="text-center text-3xl font-bold text-foreground">{t('certificateNotFound')}</h1>
            <p className="text-center text-muted-foreground">{t('verificationFailed')}</p>
            <span className="rounded bg-muted px-2 py-1 font-mono text-foreground">{certificateUuid}</span>
            <div className="w-full rounded-lg border border-destructive/20 bg-destructive/10 p-4">
              <p className="text-sm text-destructive">{t('verificationFailedReasons')}</p>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-destructive">
                <li>{t('incorrectId')}</li>
                <li>{t('revokedCertificate')}</li>
                <li>{t('expiredCertificate')}</li>
                <li>{t('differentOrganization')}</li>
              </ul>
            </div>
            <div className="pt-4">
              <Link
                href="/"
                className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground transition duration-200 hover:bg-primary/90"
              >
                <ArrowLeft className="h-5 w-5" />
                <span>{t('backToHome')}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!certificateData) {
    return null;
  }

  const qrCodeLink = getAbsoluteUrl(`/certificates/${certificateData.certificate_user.user_certification_uuid}/verify`);

  return (
    <div className="min-h-screen bg-background py-8 text-foreground">
      <div className="mx-auto max-w-6xl px-4">
        {/* Header */}
        <div className="soft-shadow mb-8 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="rounded-full bg-primary/10 p-3">
                <Shield className="h-8 w-8 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-foreground">{t('certificateInformation')}</h1>
                <p className="text-muted-foreground">{t('authenticityGuaranteed')}</p>
              </div>
            </div>

            <div
              className={`flex items-center space-x-3 rounded-full border px-4 py-2 ${getVerificationStatusColor()}`}
            >
              {getVerificationStatusIcon()}
              <span className="font-semibold">{getVerificationStatusText()}</span>
            </div>
          </div>
        </div>

        {/* Certificate Details */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Certificate Preview and Course Info */}
          <div className="space-y-6 lg:col-span-2">
            {/* Certificate Preview */}
            <div className="soft-shadow rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-foreground">{t('certificatePreview')}</h2>
              <div
                className="mx-auto max-w-2xl"
                id="certificate-preview"
              >
                <CertificatePreview
                  certificationName={certificateData.certification.config.certification_name}
                  certificationDescription={certificateData.certification.config.certification_description}
                  certificationType={certificateData.certification.config.certification_type}
                  certificatePattern={certificateData.certification.config.certificate_pattern}
                  certificateInstructor={certificateData.certification.config.certificate_instructor}
                  certificateId={certificateData.certificate_user.user_certification_uuid}
                  awardedDate={new Date(certificateData.certificate_user.created_at).toLocaleDateString(locale, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                  qrCodeLink={qrCodeLink}
                />
              </div>
            </div>

            {/* Course Information */}
            <div className="overflow-hidden rounded-lg border border-border bg-card p-4 shadow-sm">
              <div className="flex items-start gap-4">
                {/* Course Thumbnail */}
                <div className="shrink-0">
                  <div className="h-12 w-20 overflow-hidden rounded-lg bg-muted ring-1 ring-border ring-inset">
                    {certificateData.course.thumbnail_image ? (
                      <img
                        src={getCourseThumbnailMediaDirectory(
                          certificateData.course.course_uuid,
                          certificateData.course.thumbnail_image,
                        )}
                        alt={`${certificateData.course.name} ${t('courseThumbnailAlt')}`}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center bg-muted">
                        <svg
                          className="h-6 w-6 text-muted-foreground"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.246 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                          />
                        </svg>
                      </div>
                    )}
                  </div>
                </div>

                {/* Course Details */}
                <div className="min-w-0 flex-1">
                  <div className="space-y-1">
                    <div>
                      <h4 className="text-base leading-tight font-semibold text-foreground">
                        {certificateData.course.name}
                      </h4>
                      {certificateData.course.description ? (
                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{certificateData.course.description}</p>
                      ) : null}
                    </div>

                    {certificateData.course.authors && certificateData.course.authors.length > 0 ? (
                      <div className="flex items-center gap-1 text-sm font-normal text-muted-foreground">
                        <span>{t('byLabel')}</span>
                        <div className="flex items-center gap-1">
                          {certificateData.course.authors
                            .filter((author: any) => author.authorship_status === 'ACTIVE')
                            .slice(0, 2)
                            .map((author: any, index: number) => (
                              <span
                                key={author.user.user_uuid}
                                className="text-foreground"
                              >
                                {[author.user.first_name, author.user.middle_name, author.user.last_name]
                                  .filter(Boolean)
                                  .join(' ')}
                                {index <
                                  Math.min(
                                    2,
                                    certificateData.course.authors.filter((a: any) => a.authorship_status === 'ACTIVE')
                                      .length - 1,
                                  ) && ', '}
                              </span>
                            ))}
                          {certificateData.course.authors.filter((author: any) => author.authorship_status === 'ACTIVE')
                            .length > 2 && (
                            <span className="text-muted-foreground">
                              +
                              {certificateData.course.authors.filter(
                                (author: any) => author.authorship_status === 'ACTIVE',
                              ).length - 2}{' '}
                              {t('moreAuthors')}
                            </span>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>

                {/* View Course Link */}
                <div className="shrink-0">
                  <Link
                    href={getAbsoluteUrl(`/course/${certificateData.course.course_uuid.replace('course_', '')}`)}
                    className="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
                  >
                    <span>{t('viewCourse')}</span>
                    <svg
                      className="h-3 w-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* Certificate Details */}
          <div className="space-y-6">
            <div className="soft-shadow rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
              <h2 className="mb-4 text-xl font-semibold text-foreground">{t('certificationDetails')}</h2>

              <div className="space-y-4">
                <div>
                  <Label className="mb-1 block text-sm font-medium text-foreground">{t('certificateId')}</Label>
                  <div className="rounded-lg bg-muted p-3">
                    <code className="text-sm break-all text-foreground">
                      {certificateData.certificate_user.user_certification_uuid}
                    </code>
                  </div>
                </div>

                <div>
                  <Label className="mb-1 block text-sm font-medium text-foreground">{t('courseName')}</Label>
                  <div className="rounded-lg bg-muted p-3">
                    <span className="text-foreground">{certificateData.course.name}</span>
                  </div>
                </div>

                <div>
                  <Label className="mb-1 block text-sm font-medium text-foreground">{t('certificateType')}</Label>
                  <div className="rounded-lg bg-muted p-3">
                    <span className="text-foreground">
                      {getCertificationTypeLabel(certificateData.certification.config.certification_type)}
                    </span>
                  </div>
                </div>

                <div>
                  <Label className="mb-1 block text-sm font-medium text-foreground">{t('completionDate')}</Label>
                  <div className="rounded-lg bg-muted p-3">
                    <span className="text-foreground">
                      {new Date(certificateData.certificate_user.created_at).toLocaleDateString(locale, {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>
                </div>

                {certificateData.certification.config.certificate_instructor ? (
                  <div>
                    <Label className="mb-1 block text-sm font-medium text-foreground">{t('instructor')}</Label>
                    <div className="rounded-lg bg-muted p-3">
                      <span className="text-foreground">
                        {certificateData.certification.config.certificate_instructor}
                      </span>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-6">
              <div className="mb-3 flex items-center gap-3">
                <Shield className="h-6 w-6 text-primary" />
                <h3 className="text-lg font-semibold text-foreground">{t('verificationNote')}</h3>
              </div>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>• {t('authenticityVerified')}</li>
                <li>• {t('scanQRCode')}</li>
                <li>• {t('cryptographicallySecure')}</li>
                <li>• {t('timestampVerified')}</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-primary-foreground transition duration-200 hover:bg-primary/90"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>{t('backToHome')}</span>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default CertificateVerificationPage;
