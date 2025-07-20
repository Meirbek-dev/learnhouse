'use client';

import CertificatePreview from '@components/Dashboard/Pages/Course/EditCourseCertification/CertificatePreview';
import { getUserCertificates } from '@services/courses/certifications';
import { useLHSession } from '@components/Contexts/LHSessionContext';
import { getUriWithOrg } from '@services/config/config';
import { ArrowLeft, Download } from 'lucide-react';
import { useEffect, useState } from 'react';
import html2canvas from 'html2canvas';
import { useLocale } from 'next-intl';
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

  // Fetch user certificate
  useEffect(() => {
    const fetchCertificate = async () => {
      if (!session?.data?.tokens?.access_token) {
        setError('Authentication required to view certificate');
        setIsLoading(false);
        return;
      }

      try {
        const cleanCourseId = courseid.replace('course_', '');
        const result = await getUserCertificates(`course_${cleanCourseId}`, session.data.tokens.access_token);

        if (result.success && result.data && result.data.length > 0) {
          setUserCertificate(result.data[0]);
        } else {
          setError('No certificate found for this course');
        }
      } catch (error) {
        console.error('Error fetching certificate:', error);
        setError('Failed to load certificate. Please try again later.');
      } finally {
        setIsLoading(false);
      }
    };

    fetchCertificate();
  }, [courseid, session?.data?.tokens?.access_token]);

  // Generate PDF using canvas
  const downloadCertificate = async () => {
    if (!userCertificate) return;

    try {
      // Create a temporary div for the certificate
      const certificateDiv = document.createElement('div');
      certificateDiv.style.position = 'absolute';
      certificateDiv.style.left = '-9999px';
      certificateDiv.style.top = '0';
      certificateDiv.style.width = '800px';
      certificateDiv.style.height = '600px';
      certificateDiv.style.background = 'white';
      certificateDiv.style.padding = '40px';
      certificateDiv.style.fontFamily = 'Arial, sans-serif';
      certificateDiv.style.textAlign = 'center';
      certificateDiv.style.display = 'flex';
      certificateDiv.style.flexDirection = 'column';
      certificateDiv.style.justifyContent = 'center';
      certificateDiv.style.alignItems = 'center';
      certificateDiv.style.position = 'relative';
      certificateDiv.style.overflow = 'hidden';

      // Get theme colors based on pattern
      const getPatternTheme = (pattern: string) => {
        switch (pattern) {
          case 'royal':
            return { primary: '#b45309', secondary: '#d97706', icon: '#d97706' };
          case 'tech':
            return { primary: '#0e7490', secondary: '#0891b2', icon: '#0891b2' };
          case 'nature':
            return { primary: '#15803d', secondary: '#16a34a', icon: '#16a34a' };
          case 'geometric':
            return { primary: '#7c3aed', secondary: '#9333ea', icon: '#9333ea' };
          case 'vintage':
            return { primary: '#c2410c', secondary: '#ea580c', icon: '#ea580c' };
          case 'waves':
            return { primary: '#1d4ed8', secondary: '#2563eb', icon: '#2563eb' };
          case 'minimal':
            return { primary: '#374151', secondary: '#4b5563', icon: '#4b5563' };
          case 'professional':
            return { primary: '#334155', secondary: '#475569', icon: '#475569' };
          case 'academic':
            return { primary: '#3730a3', secondary: '#4338ca', icon: '#4338ca' };
          case 'modern':
            return { primary: '#1d4ed8', secondary: '#2563eb', icon: '#2563eb' };
          default:
            return { primary: '#374151', secondary: '#4b5563', icon: '#4b5563' };
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
          <img src="${qrCodeDataUrl}" alt="QR Code" style="width: 100%; height: 100%; object-fit: contain;" />
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
          Certificate
          <div style="width: 24px; height: 1px; background: linear-gradient(90deg, transparent, ${theme.secondary}, transparent);"></div>
        </div>

        <div style="
          width: 80px;
          height: 80px;
          background: linear-gradient(135deg, ${theme.icon}20 0%, ${theme.icon}40 100%);
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
        ">${userCertificate.certification.config.certification_description || 'This is to certify that the course has been successfully completed.'}</div>

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
          background: ${theme.icon}10;
          padding: 12px 24px;
          border-radius: 20px;
          border: 1px solid ${theme.icon}20;
          font-weight: 500;
          margin-bottom: 30px;
          white-space: nowrap;
        ">
          <span style="font-weight: bold; font-size: 18px;">✓</span>
          <span>${
            userCertificate.certification.config.certification_type === 'completion'
              ? 'Course Completion'
              : userCertificate.certification.config.certification_type === 'achievement'
                ? 'Achievement Based'
                : userCertificate.certification.config.certification_type === 'assessment'
                  ? 'Assessment Based'
                  : userCertificate.certification.config.certification_type === 'participation'
                    ? 'Participation'
                    : userCertificate.certification.config.certification_type === 'mastery'
                      ? 'Skill Mastery'
                      : userCertificate.certification.config.certification_type === 'professional'
                        ? 'Professional Development'
                        : userCertificate.certification.config.certification_type === 'continuing'
                          ? 'Continuing Education'
                          : userCertificate.certification.config.certification_type === 'workshop'
                            ? 'Workshop Attendance'
                            : userCertificate.certification.config.certification_type === 'specialization'
                              ? 'Specialization'
                              : 'Course Completion'
          }</span>
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
            <strong style="color: ${theme.primary};">Certificate ID:</strong> ${certificateUUID}
          </div>
          <div style="margin: 8px 0; font-size: 14px; color: #374151;">
            <strong style="color: ${theme.primary};">Awarded:</strong> ${new Date(
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
              <strong style="color: ${theme.primary};">Instructor:</strong> ${userCertificate.certification.config.certificate_instructor}
            </div>`
              : ''
          }
        </div>

        <div style="
          margin-top: 20px;
          font-size: 12px;
          color: #6b7280;
        ">
          This certificate can be verified at ${qrCodeData.replace('https://', '').replace('http://', '')}
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
      const fileName = `${userCertificate.certification.config.certification_name.replace(/[^a-zA-Z0-9]/g, '_')}_Certificate.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Failed to generate PDF. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-b-2 border-blue-600" />
          <p className="text-gray-600">Loading certificate...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="mx-auto max-w-md p-6 text-center">
          <div className="rounded-lg border border-red-200 bg-red-50 p-6">
            <h2 className="mb-2 text-xl font-semibold text-red-800">Certificate Not Available</h2>
            <p className="mb-4 text-red-600">{error}</p>
            <Link
              href={getUriWithOrg(orgslug, '') + `/course/${courseid}`}
              className="inline-flex items-center space-x-2 rounded-full bg-blue-600 px-6 py-3 text-white transition duration-200 hover:bg-blue-700"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Course</span>
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
            <h2 className="mb-2 text-xl font-semibold text-yellow-800">No Certificate Found</h2>
            <p className="mb-4 text-yellow-600">
              No certificate is available for this course. Please contact your instructor for more information.
            </p>
            <Link
              href={getUriWithOrg(orgslug, '') + `/course/${courseid}`}
              className="inline-flex items-center space-x-2 rounded-full bg-blue-600 px-6 py-3 text-white transition duration-200 hover:bg-blue-700"
            >
              <ArrowLeft className="h-5 w-5" />
              <span>Back to Course</span>
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
            href={getUriWithOrg(orgslug, '') + `/course/${courseid}`}
            className="inline-flex items-center space-x-2 text-gray-600 transition duration-200 hover:text-gray-900"
          >
            <ArrowLeft className="h-5 w-5" />
            <span>Back to Course</span>
          </Link>

          <div className="flex items-center space-x-4">
            <button
              onClick={downloadCertificate}
              className="inline-flex items-center space-x-2 rounded-full bg-green-600 px-6 py-3 text-white transition duration-200 hover:bg-green-700"
            >
              <Download className="h-5 w-5" />
              <span>Download PDF</span>
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
          <p className="mb-2">Click "Download PDF" to generate and download a high-quality certificate PDF.</p>
          <p className="text-sm">The PDF includes a scannable QR code for certificate verification.</p>
        </div>
      </div>
    </div>
  );
};

export default CertificatePage;
