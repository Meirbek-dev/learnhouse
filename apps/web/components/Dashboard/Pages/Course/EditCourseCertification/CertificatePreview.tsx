import { Award, Building, Calendar, CheckCircle, Hash, QrCode, User } from 'lucide-react';
import { getOrgLogoMediaDirectory } from '@services/media/media';
import { useOrg } from '@components/Contexts/OrgContext';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';
import type React from 'react';
import QRCode from 'qrcode';

interface CertificatePreviewProps {
  certificationName: string;
  certificationDescription: string;
  certificationType: string;
  certificatePattern: string;
  certificateInstructor?: string;
  certificateId?: string;
  awardedDate?: string;
  qrCodeLink?: string;
}

const CertificatePreview: React.FC<CertificatePreviewProps> = ({
  certificationName,
  certificationDescription,
  certificationType,
  certificatePattern,
  certificateInstructor,
  certificateId,
  awardedDate,
  qrCodeLink,
}) => {
  const [qrCodeUrl, setQrCodeUrl] = useState<string>('');
  const org = useOrg() as any;
  const tTypes = useTranslations('Certificates.EditCourseCertification.certificationTypes');
  const t = useTranslations('Certificates.CertificatePreview');

  // Generate QR code
  useEffect(() => {
    const generateQRCode = async () => {
      try {
        const certificateData = qrCodeLink || `${certificateId}`;
        const qrUrl = await QRCode.toDataURL(certificateData, {
          width: 185,
          margin: 1,
          color: {
            dark: '#000000',
            light: '#FFFFFF',
          },
          errorCorrectionLevel: 'M',
          type: 'image/png',
        });
        setQrCodeUrl(qrUrl);
      } catch (error) {
        console.error('Error generating QR code:', error);
      }
    };

    generateQRCode();
  }, [certificateId, qrCodeLink]);
  // Function to get theme colors for each pattern
  const getPatternTheme = (pattern: string) => {
    switch (pattern) {
      case 'royal':
        return {
          primary: 'text-amber-700',
          secondary: 'text-amber-600',
          icon: 'text-amber-600',
          badge: 'bg-amber-50 text-amber-700 border-amber-200',
        };
      case 'tech':
        return {
          primary: 'text-cyan-700',
          secondary: 'text-cyan-600',
          icon: 'text-cyan-600',
          badge: 'bg-cyan-50 text-cyan-700 border-cyan-200',
        };
      case 'nature':
        return {
          primary: 'text-green-700',
          secondary: 'text-green-600',
          icon: 'text-green-600',
          badge: 'bg-green-50 text-green-700 border-green-200',
        };
      case 'geometric':
        return {
          primary: 'text-purple-700',
          secondary: 'text-purple-600',
          icon: 'text-purple-600',
          badge: 'bg-purple-50 text-purple-700 border-purple-200',
        };
      case 'vintage':
        return {
          primary: 'text-orange-700',
          secondary: 'text-orange-600',
          icon: 'text-orange-600',
          badge: 'bg-orange-50 text-orange-700 border-orange-200',
        };
      case 'waves':
        return {
          primary: 'text-blue-700',
          secondary: 'text-blue-600',
          icon: 'text-blue-600',
          badge: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      case 'minimal':
        return {
          primary: 'text-gray-700',
          secondary: 'text-gray-600',
          icon: 'text-gray-600',
          badge: 'bg-gray-50 text-gray-700 border-gray-200',
        };
      case 'professional':
        return {
          primary: 'text-slate-700',
          secondary: 'text-slate-600',
          icon: 'text-slate-600',
          badge: 'bg-slate-50 text-slate-700 border-slate-200',
        };
      case 'academic':
        return {
          primary: 'text-indigo-700',
          secondary: 'text-indigo-600',
          icon: 'text-indigo-600',
          badge: 'bg-indigo-50 text-indigo-700 border-indigo-200',
        };
      case 'modern':
        return {
          primary: 'text-blue-700',
          secondary: 'text-blue-600',
          icon: 'text-blue-600',
          badge: 'bg-blue-50 text-blue-700 border-blue-200',
        };
      default:
        return {
          primary: 'text-gray-700',
          secondary: 'text-gray-600',
          icon: 'text-gray-600',
          badge: 'bg-gray-50 text-gray-700 border-gray-200',
        };
    }
  };

  // Function to render different certificate patterns
  const renderCertificatePattern = (pattern: string) => {
    switch (pattern) {
      case 'royal':
        return (
          <>
            {/* Royal ornate border with crown elements */}
            <div className="absolute inset-3 rounded-lg border-4 border-amber-200 opacity-60" />
            <div className="absolute inset-4 rounded-md border-2 border-amber-300 opacity-40" />

            {/* Crown-like decorations in corners */}
            <div className="absolute top-1 left-1/2 -translate-x-1/2 transform">
              <div
                className="h-4 w-8 bg-amber-200 opacity-50"
                style={{
                  clipPath: 'polygon(0% 100%, 20% 0%, 40% 100%, 60% 0%, 80% 100%, 100% 0%, 100% 100%)',
                }}
              />
            </div>
            <div className="absolute bottom-1 left-1/2 -translate-x-1/2 rotate-180 transform">
              <div
                className="h-4 w-8 bg-amber-200 opacity-50"
                style={{
                  clipPath: 'polygon(0% 100%, 20% 0%, 40% 100%, 60% 0%, 80% 100%, 100% 0%, 100% 100%)',
                }}
              />
            </div>

            {/* Royal background pattern */}
            <div className="absolute inset-0 opacity-3">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    'radial-gradient(circle at 25% 25%, #f59e0b 2px, transparent 2px), radial-gradient(circle at 75% 75%, #f59e0b 1px, transparent 1px)',
                  backgroundSize: '16px 16px',
                }}
              />
            </div>
          </>
        );

      case 'tech':
        return (
          <>
            {/* Tech circuit board borders */}
            <div className="absolute inset-3 border-2 border-cyan-200 opacity-50" />

            {/* Circuit-like corner elements */}
            <div className="absolute top-3 left-3 h-6 w-6 border-t-2 border-l-2 border-cyan-300 opacity-60" />
            <div className="absolute top-3 left-5 h-2 w-2 bg-cyan-300 opacity-60" />
            <div className="absolute top-5 left-3 h-2 w-2 bg-cyan-300 opacity-60" />

            <div className="absolute top-3 right-3 h-6 w-6 border-t-2 border-r-2 border-cyan-300 opacity-60" />
            <div className="absolute top-3 right-5 h-2 w-2 bg-cyan-300 opacity-60" />
            <div className="absolute top-5 right-3 h-2 w-2 bg-cyan-300 opacity-60" />

            <div className="absolute bottom-3 left-3 h-6 w-6 border-b-2 border-l-2 border-cyan-300 opacity-60" />
            <div className="absolute bottom-3 left-5 h-2 w-2 bg-cyan-300 opacity-60" />
            <div className="absolute bottom-5 left-3 h-2 w-2 bg-cyan-300 opacity-60" />

            <div className="absolute right-3 bottom-3 h-6 w-6 border-r-2 border-b-2 border-cyan-300 opacity-60" />
            <div className="absolute right-5 bottom-3 h-2 w-2 bg-cyan-300 opacity-60" />
            <div className="absolute right-3 bottom-5 h-2 w-2 bg-cyan-300 opacity-60" />

            {/* Tech grid background */}
            <div className="absolute inset-0 opacity-4">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, #06b6d4 1px, transparent 1px), linear-gradient(0deg, #06b6d4 1px, transparent 1px)',
                  backgroundSize: '8px 8px',
                }}
              />
            </div>
          </>
        );

      case 'nature':
        return (
          <>
            {/* Nature organic border */}
            <div className="absolute inset-3 rounded-2xl border-2 border-green-200 opacity-50" />

            {/* Leaf-like decorations */}
            <div className="absolute top-2 left-2 h-6 w-4 rotate-45 transform rounded-full bg-green-200 opacity-50" />
            <div className="absolute top-2 left-4 h-4 w-3 rotate-12 transform rounded-full bg-green-300 opacity-40" />

            <div className="absolute top-2 right-2 h-6 w-4 -rotate-45 transform rounded-full bg-green-200 opacity-50" />
            <div className="absolute top-2 right-4 h-4 w-3 -rotate-12 transform rounded-full bg-green-300 opacity-40" />

            <div className="absolute bottom-2 left-2 h-6 w-4 -rotate-45 transform rounded-full bg-green-200 opacity-50" />
            <div className="absolute bottom-2 left-4 h-4 w-3 -rotate-12 transform rounded-full bg-green-300 opacity-40" />

            <div className="absolute right-2 bottom-2 h-6 w-4 rotate-45 transform rounded-full bg-green-200 opacity-50" />
            <div className="absolute right-4 bottom-2 h-4 w-3 rotate-12 transform rounded-full bg-green-300 opacity-40" />

            {/* Organic background pattern */}
            <div className="absolute inset-0 opacity-3">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    'radial-gradient(ellipse at 30% 30%, #10b981 1px, transparent 1px), radial-gradient(ellipse at 70% 70%, #10b981 0.5px, transparent 0.5px)',
                  backgroundSize: '12px 8px',
                }}
              />
            </div>
          </>
        );

      case 'geometric':
        return (
          <>
            {/* Geometric angular borders */}
            <div
              className="absolute inset-2 border-2 border-purple-200 opacity-50"
              style={{
                clipPath:
                  'polygon(0 10px, 10px 0, calc(100% - 10px) 0, 100% 10px, 100% calc(100% - 10px), calc(100% - 10px) 100%, 10px 100%, 0 calc(100% - 10px))',
              }}
            />

            {/* Geometric corner elements */}
            <div className="absolute top-1 left-1 h-6 w-6 rotate-45 transform border-2 border-purple-300 opacity-60" />
            <div className="absolute top-1 right-1 h-6 w-6 rotate-45 transform border-2 border-purple-300 opacity-60" />
            <div className="absolute bottom-1 left-1 h-6 w-6 rotate-45 transform border-2 border-purple-300 opacity-60" />
            <div className="absolute right-1 bottom-1 h-6 w-6 rotate-45 transform border-2 border-purple-300 opacity-60" />

            {/* Abstract geometric shapes */}
            <div className="absolute top-1/4 left-1 h-8 w-2 rotate-12 transform bg-purple-200 opacity-30" />
            <div className="absolute top-1/4 right-1 h-8 w-2 -rotate-12 transform bg-purple-200 opacity-30" />
            <div className="absolute bottom-1/4 left-1 h-8 w-2 -rotate-12 transform bg-purple-200 opacity-30" />
            <div className="absolute right-1 bottom-1/4 h-8 w-2 rotate-12 transform bg-purple-200 opacity-30" />

            {/* Geometric background */}
            <div className="absolute inset-0 opacity-4">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    'linear-gradient(45deg, #8b5cf6 25%, transparent 25%), linear-gradient(-45deg, #8b5cf6 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #8b5cf6 75%), linear-gradient(-45deg, transparent 75%, #8b5cf6 75%)',
                  backgroundSize: '6px 6px',
                }}
              />
            </div>
          </>
        );

      case 'vintage':
        return (
          <>
            {/* Art deco style borders */}
            <div className="absolute inset-2 border-2 border-orange-200 opacity-50" />
            <div className="absolute inset-3 border border-orange-300 opacity-40" />

            {/* Art deco corner decorations */}
            <div
              className="absolute top-2 left-2 h-8 w-8 border-2 border-orange-300 opacity-50"
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 50%, 50% 100%, 0 100%)',
              }}
            />
            <div
              className="absolute top-2 right-2 h-8 w-8 border-2 border-orange-300 opacity-50"
              style={{
                clipPath: 'polygon(0 0, 100% 0, 100% 100%, 50% 100%, 0 50%)',
              }}
            />
            <div
              className="absolute bottom-2 left-2 h-8 w-8 border-2 border-orange-300 opacity-50"
              style={{
                clipPath: 'polygon(0 0, 50% 0, 100% 50%, 100% 100%, 0 100%)',
              }}
            />
            <div
              className="absolute right-2 bottom-2 h-8 w-8 border-2 border-orange-300 opacity-50"
              style={{
                clipPath: 'polygon(0 50%, 50% 0, 100% 0, 100% 100%, 0 100%)',
              }}
            />

            {/* Art deco sunburst pattern */}
            <div className="absolute inset-0 opacity-3">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    'repeating-conic-gradient(from 0deg at 50% 50%, #f97316 0deg, #f97316 2deg, transparent 2deg, transparent 8deg)',
                  backgroundSize: '100% 100%',
                }}
              />
            </div>
          </>
        );

      case 'waves':
        return (
          <>
            {/* Flowing wave borders */}
            <div className="absolute inset-2 rounded-3xl border-2 border-blue-200 opacity-50" />

            {/* Wave decorations */}
            <div
              className="absolute top-2 right-0 left-0 h-4 opacity-30"
              style={{
                background: 'radial-gradient(ellipse at center, #3b82f6 30%, transparent 30%)',
                backgroundSize: '20px 8px',
              }}
            />
            <div
              className="absolute right-0 bottom-2 left-0 h-4 opacity-30"
              style={{
                background: 'radial-gradient(ellipse at center, #3b82f6 30%, transparent 30%)',
                backgroundSize: '20px 8px',
              }}
            />

            {/* Side wave patterns */}
            <div
              className="absolute top-0 bottom-0 left-2 w-4 opacity-30"
              style={{
                background: 'radial-gradient(ellipse at center, #3b82f6 30%, transparent 30%)',
                backgroundSize: '8px 20px',
              }}
            />
            <div
              className="absolute top-0 right-2 bottom-0 w-4 opacity-30"
              style={{
                background: 'radial-gradient(ellipse at center, #3b82f6 30%, transparent 30%)',
                backgroundSize: '8px 20px',
              }}
            />

            {/* Wave background */}
            <div className="absolute inset-0 opacity-4">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    'repeating-linear-gradient(45deg, #3b82f6 0px, #3b82f6 1px, transparent 1px, transparent 8px), repeating-linear-gradient(-45deg, #3b82f6 0px, #3b82f6 1px, transparent 1px, transparent 8px)',
                  backgroundSize: '12px 12px',
                }}
              />
            </div>
          </>
        );

      case 'minimal':
        return (
          <>
            {/* Minimal clean border */}
            <div className="absolute inset-6 border border-gray-300 opacity-60" />

            {/* Subtle corner accents */}
            <div className="absolute top-5 left-5 h-3 w-3 border-t border-l border-gray-400 opacity-40" />
            <div className="absolute top-5 right-5 h-3 w-3 border-t border-r border-gray-400 opacity-40" />
            <div className="absolute bottom-5 left-5 h-3 w-3 border-b border-l border-gray-400 opacity-40" />
            <div className="absolute right-5 bottom-5 h-3 w-3 border-r border-b border-gray-400 opacity-40" />
          </>
        );

      case 'professional':
        return (
          <>
            {/* Professional double border */}
            <div className="absolute inset-2 border-2 border-slate-300 opacity-50" />
            <div className="absolute inset-3 border border-slate-400 opacity-40" />

            {/* Professional corner brackets */}
            <div className="absolute top-2 left-2 h-6 w-6 border-t-2 border-l-2 border-slate-400 opacity-60" />
            <div className="absolute top-2 right-2 h-6 w-6 border-t-2 border-r-2 border-slate-400 opacity-60" />
            <div className="absolute bottom-2 left-2 h-6 w-6 border-b-2 border-l-2 border-slate-400 opacity-60" />
            <div className="absolute right-2 bottom-2 h-6 w-6 border-r-2 border-b-2 border-slate-400 opacity-60" />

            {/* Subtle professional background */}
            <div className="absolute inset-0 opacity-2">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    'linear-gradient(90deg, #64748b 1px, transparent 1px), linear-gradient(0deg, #64748b 1px, transparent 1px)',
                  backgroundSize: '20px 20px',
                }}
              />
            </div>
          </>
        );

      case 'academic':
        return (
          <>
            {/* Academic traditional border */}
            <div className="absolute inset-2 border-3 border-indigo-300 opacity-50" />
            <div className="absolute inset-3 border border-indigo-400 opacity-40" />

            {/* Academic shield-like corners */}
            <div className="absolute top-2 left-2 h-8 w-8 rounded-tl-lg border-2 border-indigo-400 opacity-50" />
            <div className="absolute top-2 right-2 h-8 w-8 rounded-tr-lg border-2 border-indigo-400 opacity-50" />
            <div className="absolute bottom-2 left-2 h-8 w-8 rounded-bl-lg border-2 border-indigo-400 opacity-50" />
            <div className="absolute right-2 bottom-2 h-8 w-8 rounded-br-lg border-2 border-indigo-400 opacity-50" />

            {/* Academic laurel-like decorations */}
            <div className="absolute top-1/2 left-1 -translate-y-1/2 transform">
              <div className="h-6 w-1 rounded-full bg-indigo-300 opacity-40" />
            </div>
            <div className="absolute top-1/2 right-1 -translate-y-1/2 transform">
              <div className="h-6 w-1 rounded-full bg-indigo-300 opacity-40" />
            </div>

            {/* Academic background pattern */}
            <div className="absolute inset-0 opacity-3">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage: 'radial-gradient(circle at 50% 50%, #6366f1 1px, transparent 1px)',
                  backgroundSize: '15px 15px',
                }}
              />
            </div>
          </>
        );

      case 'modern':
        return (
          <>
            {/* Modern clean asymmetric border */}
            <div
              className="absolute inset-2 border-2 border-gray-300 opacity-50"
              style={{
                clipPath: 'polygon(0 0, calc(100% - 12px) 0, 100% 12px, 100% 100%, 12px 100%, 0 calc(100% - 12px))',
              }}
            />

            {/* Modern accent lines */}
            <div className="absolute top-2 left-2 h-0.5 w-8 bg-blue-400 opacity-60" />
            <div className="absolute top-2 left-2 h-8 w-0.5 bg-blue-400 opacity-60" />

            <div className="absolute right-2 bottom-2 h-0.5 w-8 bg-blue-400 opacity-60" />
            <div className="absolute right-2 bottom-2 h-8 w-0.5 bg-blue-400 opacity-60" />

            {/* Modern dot accents */}
            <div className="absolute top-4 right-4 h-2 w-2 rounded-full bg-blue-400 opacity-50" />
            <div className="absolute bottom-4 left-4 h-2 w-2 rounded-full bg-blue-400 opacity-50" />

            {/* Modern subtle background */}
            <div className="absolute inset-0 opacity-2">
              <div
                className="h-full w-full"
                style={{
                  backgroundImage:
                    'linear-gradient(135deg, #3b82f6 0%, transparent 1%), linear-gradient(225deg, #3b82f6 0%, transparent 1%)',
                  backgroundSize: '12px 12px',
                }}
              />
            </div>
          </>
        );

      default:
        return null;
    }
  };

  const theme = getPatternTheme(certificatePattern);

  return (
    <div className="h-full w-full rounded-xl border border-blue-200 bg-gradient-to-br from-blue-50 to-indigo-50 p-4">
      <div className="relative flex h-full w-full flex-col overflow-hidden rounded-lg bg-white p-6 shadow-sm">
        {/* Dynamic Certificate Pattern */}
        {renderCertificatePattern(certificatePattern)}

        {/* Certificate ID - Top Left */}
        <div className="absolute top-4 left-4 z-20 sm:top-6 sm:left-6">
          <div className="flex items-center space-x-1">
            <Hash className={`h-3 w-3 sm:h-4 sm:w-4 ${theme.icon}`} />
            <span className={`text-xs sm:text-sm ${theme.secondary} font-medium`}>
              ID: {certificateId || 'OU-2025-001'}
            </span>
          </div>
        </div>

        {/* QR Code Box - Top Right */}
        <div className="absolute top-4 right-4 z-20 sm:top-6 sm:right-6">
          <div
            className={`h-16 w-16 border-2 sm:h-24 sm:w-24 ${theme.secondary.replace('text-', 'border-')} rounded-md bg-white/90 p-1 backdrop-blur-sm`}
          >
            {qrCodeUrl ? (
              <img
                src={qrCodeUrl}
                alt={t('certificateQRAlt')}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <QrCode className={`h-8 w-8 sm:h-12 sm:w-12 ${theme.icon}`} />
              </div>
            )}
          </div>
        </div>

        {/* Main Content */}
        <div className="relative z-10 flex flex-1 flex-col items-center justify-center space-y-3 px-6 py-6 text-center">
          {/* Header with decorative line */}
          <div className="mb-2 flex items-center justify-center space-x-2">
            <div
              className={`h-px w-6 bg-gradient-to-r from-transparent sm:w-8 ${theme.secondary.replace('text-', 'to-')}`}
            />
            <div className={`text-xs sm:text-sm ${theme.secondary} font-medium tracking-wider uppercase`}>
              {t('certificate')}
            </div>
            <div
              className={`h-px w-6 bg-gradient-to-l from-transparent sm:w-8 ${theme.secondary.replace('text-', 'to-')}`}
            />
          </div>

          {/* Award Icon with decorative elements */}
          <div className="relative flex justify-center">
            <div
              className={`h-12 w-12 bg-gradient-to-br sm:h-16 sm:w-16 ${theme.icon.replace('text-', 'from-')}-100 ${theme.icon.replace('text-', 'to-')}-200 relative flex items-center justify-center rounded-full`}
            >
              <Award className={`h-6 w-6 sm:h-8 sm:w-8 ${theme.icon}`} />
              {/* Decorative rays */}
              <div className="absolute inset-0 rounded-full">
                <div
                  className={`absolute top-0 left-1/2 h-2 w-px sm:h-3 ${theme.secondary.replace('text-', 'bg-')} -translate-x-1/2 -translate-y-1 transform opacity-60`}
                />
                <div
                  className={`absolute bottom-0 left-1/2 h-2 w-px sm:h-3 ${theme.secondary.replace('text-', 'bg-')} -translate-x-1/2 translate-y-1 transform opacity-60`}
                />
                <div
                  className={`absolute top-1/2 left-0 h-px w-2 sm:w-3 ${theme.secondary.replace('text-', 'bg-')} -translate-x-1 -translate-y-1/2 transform opacity-60`}
                />
                <div
                  className={`absolute top-1/2 right-0 h-px w-2 sm:w-3 ${theme.secondary.replace('text-', 'bg-')} translate-x-1 -translate-y-1/2 transform opacity-60`}
                />
              </div>
            </div>
          </div>

          {/* Certificate Content */}
          <div className="flex max-w-full flex-1 flex-col items-center justify-center">
            <h4 className={`text-sm font-bold sm:text-base ${theme.primary} mb-2 text-center`}>
              {certificationName || t('certificationName')}
            </h4>
            <p className={`text-xs sm:text-sm ${theme.secondary} max-w-xs text-center leading-relaxed sm:max-w-sm`}>
              {certificationDescription || t('certificationDescriptionPlaceholder')}
            </p>
          </div>

          {/* Decorative divider */}
          <div className="flex items-center justify-center space-x-1 py-1">
            <div className={`h-px w-2 ${theme.secondary.replace('text-', 'bg-')} opacity-50`} />
            <div className={`h-1 w-1 ${theme.primary.replace('text-', 'bg-')} rounded-full opacity-60`} />
            <div className={`h-px w-2 ${theme.secondary.replace('text-', 'bg-')} opacity-50`} />
          </div>

          {/* Certification Type Badge */}
          <div
            className={`inline-flex items-center space-x-1 text-xs sm:text-sm ${theme.badge} rounded-full border px-3 py-1`}
          >
            <CheckCircle size={12} />
            <span className="font-medium">
              {tTypes(certificationType, {
                defaultValue: tTypes('completion'),
              })}
            </span>
          </div>
        </div>

        {/* Bottom Section */}
        <div className="relative z-10 mt-auto p-6 pt-8">
          <div className="flex w-full items-end justify-between">
            {/* Left: Teacher/Organization Signature */}
            <div className="flex flex-1 flex-col items-start space-y-1">
              <div className="flex items-center space-x-1">
                <User className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${theme.icon}`} />
                <span className={`text-xs ${theme.secondary} font-medium`}>{t('instructor')}</span>
              </div>
              <div className={`text-xs ${theme.primary} font-semibold`}>
                {certificateInstructor || t('instructorName')}
              </div>
              <div className={`h-px w-10 sm:w-12 ${theme.secondary.replace('text-', 'bg-')} opacity-50`} />
            </div>

            {/* Center: Logo */}
            <div className="flex flex-1 flex-col items-center space-y-1">
              <div className={'flex h-8 w-8 items-center justify-center sm:h-10 sm:w-10'}>
                {org?.logo_image ? (
                  <img
                    src={`${getOrgLogoMediaDirectory(org.org_uuid, org?.logo_image)}`}
                    alt={t('organizationLogoAlt')}
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <div
                    className={`h-full w-full ${theme.icon.replace('text-', 'bg-')}-100 flex items-center justify-center rounded-full`}
                  >
                    <Building className={`h-4 w-4 sm:h-5 sm:w-5 ${theme.icon}`} />
                  </div>
                )}
              </div>
              <div className={`text-xs ${theme.secondary} font-medium`}>{org?.name || 'LearnHouse'}</div>
            </div>

            {/* Right: Award Date */}
            <div className="flex flex-1 flex-col items-end space-y-1">
              <div className="flex items-center space-x-1">
                <Calendar className={`h-2.5 w-2.5 sm:h-3 sm:w-3 ${theme.icon}`} />
                <span className={`text-xs ${theme.secondary} font-medium`}>{t('awardedLabel')}</span>
              </div>
              <div className={`text-xs ${theme.primary} font-semibold`}>{awardedDate || t('completedOn')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CertificatePreview;
