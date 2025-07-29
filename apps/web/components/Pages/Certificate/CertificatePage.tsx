'use client';

import CertificatePreview from '@components/Dashboard/Pages/Course/EditCourseCertification/CertificatePreview';
import { getUserCertificates } from '@services/courses/certifications';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { getUriWithOrg } from '@services/config/config';
import { useLocale, useTranslations } from 'next-intl';
import { ArrowLeft, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import html2canvas from 'html2canvas-pro';
import type React from 'react';
import Link from 'next/link';
import QRCode from 'qrcode';
import jsPDF from 'jspdf';

interface CertificatePageProps {
  orgslug: string;
  courseid: string;
  qrCodeLink: string;
}

const CertificatePage: React.FC<CertificatePageProps> = ({ orgslug, courseid, qrCodeLink }) => {
  const session = useLHSession() as any;
  const [userCertificate, setUserCertificate] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const locale = useLocale();
  const t = useTranslations('Certificates.CertificatePage');

  // Fetch user certificate
  useEffect(() => {
    const fetchCertificate = async () => {
      if (!session?.data?.tokens?.access_token) {
        setError(t('errorAuth'));
        setIsLoading(false);
        return;
      }

      try {
        const cleanCourseId = courseid.replace('course_', '');
        const result = await getUserCertificates(`course_${cleanCourseId}`, session.data.tokens.access_token);

        if (result.success && result.data && result.data.length > 0) {
          setUserCertificate(result.data[0]);
        } else {
          setError(t('noCertificate'));
        }
      } catch (error) {
        console.error('Error fetching certificate:', error);
        setError(t('error'));
      } finally {
        setIsLoading(false);
      }
    };

    fetchCertificate();
  }, [courseid, session?.data?.tokens?.access_token, t]);

  // Certificate type translation helper
  const getCertificationTypeLabel = (type: string): string => {
    const typeKey = type as keyof typeof t;
    return t(typeKey) || t('completion');
  };

  // Generate PDF using canvas
  const downloadCertificate = async () => {
    if (!userCertificate) return;

    try {
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
      const certificateUUID = userCertificate.certificate_user.user_certification_uuid;
      const qrCodeData = qrCodeLink;

      // Generate QR code
      const qrCodeDataUrl = await QRCode.toDataURL(qrCodeData, {
        width: 120,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
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
        ">ID: ${certificateUUID}</div>

        <div style="
          position: absolute;
          top: 20px;
          right: 20px;
          width: 80px;
          height: 80px;
          border: 2px solid ${theme.secondary};
          border-radius: 8px;
          background: white;
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
        ">${userCertificate.certification.config.certification_description || t('certificationDefaultDescription')}</div>

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
            <strong style="color: ${theme.primary};">${t('certificateId')}:</strong> ${certificateUUID}
          </div>
          <div style="margin: 8px 0; font-size: 14px; color: #374151;">
            <strong style="color: ${theme.primary};">${t('awarded')}:</strong> ${new Date(
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
          ${t('verificationNote')} ${qrCodeData.replace('https://', '').replace('http://', '')}
        </div>
      `;

      // Add to document temporarily
      document.body.appendChild(certificateDiv);

      // Convert to canvas
      const canvas = await html2canvas(certificateDiv, {
        width: 800,
        height: 600,
        scale: 2, // Higher resolution
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
      const fileName = `${userCertificate.certification.config.certification_name.replaceAll(/[^\dA-Za-z]/g, '_')}_${t('certificateFileName')}.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert(t('errorGeneratingPDF'));
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-gray-600">{t('loading')}</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="mx-auto max-w-md p-6 text-center">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h2 className="mb-2 text-xl font-semibold text-red-800">{t('errorNonAvailable')}</h2>
            <p className="mb-4 text-red-600">{error}</p>
            <Link
              href={`${getUriWithOrg(orgslug, '')}/course/${courseid}`}
              className="inline-flex items-center space-x-2 rounded-full bg-blue-600 px-6 py-3 text-white transition duration-200 hover:bg-blue-700"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>{t('backToHome')}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (!userCertificate) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="mx-auto max-w-md p-6 text-center">
          <div className="rounded-lg border border-yellow-200 bg-yellow-50 p-6">
            <h2 className="mb-2 text-xl font-semibold text-yellow-800">{t('noCertificate')}</h2>
            <p className="mb-4 text-yellow-600">{t('noCertificate')}</p>
            <Link
              href={`${getUriWithOrg(orgslug, '')}/course/${courseid}`}
              className="inline-flex items-center space-x-2 rounded-full bg-blue-600 px-6 py-3 text-white transition duration-200 hover:bg-blue-700"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>{t('backToHome')}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="mx-auto max-w-4xl px-4">
        {/* Header */}
        <div className="mb-8 flex items-center justify-between">
          <Link
            href={`${getUriWithOrg(orgslug, '')}/course/${courseid}`}
            className="inline-flex items-center space-x-2 text-gray-600 transition duration-200 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>{t('backToHome')}</span>
          </Link>

          <div className="flex items-center space-x-4">
            <button
              onClick={downloadCertificate}
              className="inline-flex items-center space-x-2 rounded-full bg-green-600 px-6 py-3 text-white transition duration-200 hover:bg-green-700"
            >
              <Download className="h-5 w-5" />
              <span>{t('downloadPDF')}</span>
            </button>
          </div>
        </div>

        {/* Certificate Display */}
        <div className="rounded-2xl bg-white p-8 shadow-lg">
          <div className="mx-auto max-w-2xl">
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

        {/* Instructions */}
        <div className="mt-8 text-center text-gray-600">
          <p className="mb-2">{t('downloadInstructions')}</p>
          <p className="text-sm">{t('qrCodeInstructions')}</p>
        </div>
      </div>
    </div>
  );
};

export default CertificatePage;
