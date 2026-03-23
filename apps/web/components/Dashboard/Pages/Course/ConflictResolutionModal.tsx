'use client';

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { useCourse } from '@components/Contexts/CourseContext';
import { useCourseEditorStore } from '@/stores/courses';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, RefreshCcw } from 'lucide-react';
import { useTranslations } from 'next-intl';

interface SummaryRow {
  label: string;
  value: string;
}

const fallbackValue = '—';

const countLearningItems = (value: unknown) => {
  if (!value) {
    return 0;
  }

  if (Array.isArray(value)) {
    return value.filter((item) => item?.text?.trim()).length;
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item) => item?.text?.trim()).length : 0;
    } catch {
      return value.trim() ? 1 : 0;
    }
  }

  return 0;
};

const normalizeTags = (value: unknown) => {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ');
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.filter(Boolean).join(', ');
      }
    } catch {
      return value;
    }
  }

  return fallbackValue;
};

const formatString = (value: unknown) => {
  if (typeof value === 'string' && value.trim()) {
    return value.trim();
  }

  return fallbackValue;
};

const buildRows = (...rows: Array<SummaryRow | null>) => rows.filter((row): row is SummaryRow => Boolean(row));

const SummaryCard = ({
  title,
  sectionLabel,
  rows,
  emptyState,
}: {
  title: string;
  sectionLabel?: string;
  rows: SummaryRow[];
  emptyState: string;
}) => (
  <div className="space-y-3 rounded-lg border bg-background p-4">
    <div className="flex items-center justify-between gap-3">
      <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">{title}</div>
      {sectionLabel ? <Badge variant="outline">{sectionLabel}</Badge> : null}
    </div>
    {rows.length > 0 ? (
      <dl className="space-y-3 text-sm">
        {rows.map((row) => (
          <div
            key={`${row.label}-${row.value}`}
            className="grid gap-1 border-b border-border/50 pb-3 last:border-b-0 last:pb-0"
          >
            <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{row.label}</dt>
            <dd className="text-foreground">{row.value}</dd>
          </div>
        ))}
      </dl>
    ) : (
      <div className="text-sm text-muted-foreground">{emptyState}</div>
    )}
  </div>
);

export default function ConflictResolutionModal() {
  const t = useTranslations('CourseEdit.Conflict');
  const generalT = useTranslations('CourseEdit.General');
  const accessT = useTranslations('DashPage.Courses.Access');
  const contributorsT = useTranslations('DashPage.EditCourseContributors');
  const certificationT = useTranslations('Certificates.EditCourseCertification');
  const course = useCourse();
  const conflict = useCourseEditorStore((state) => state.conflict);
  const drafts = useCourseEditorStore((state) => state.drafts);
  const dismissConflict = useCourseEditorStore((state) => state.dismissConflict);
  const resolveConflict = useCourseEditorStore((state) => state.resolveConflict);

  const draftValue = conflict.draftSection ? drafts[conflict.draftSection] : null;
  const courseStructure = course.courseStructure;
  const editorData = course.editorData;

  const contributorList = editorData.contributors.data ?? [];
  const certificationConfig = editorData.certifications.data?.[0]?.config ?? null;

  const contributorCounts = {
    total: contributorList.length,
    active: contributorList.filter((contributor: any) => contributor.authorship_status === 'ACTIVE').length,
    pending: contributorList.filter((contributor: any) => contributor.authorship_status === 'PENDING').length,
    inactive: contributorList.filter((contributor: any) => contributor.authorship_status === 'INACTIVE').length,
  };

  const buildDraftSummary = () => {
    switch (conflict.draftSection) {
      case 'general': {
        const generalDraft = draftValue as any;

        return {
          sectionLabel: generalT('title', { courseName: generalDraft?.name || courseStructure?.name || '' }),
          rows: buildRows(
            { label: generalT('name.label'), value: formatString(generalDraft?.name) },
            { label: generalT('description.label'), value: formatString(generalDraft?.description) },
            { label: generalT('about.label'), value: formatString(generalDraft?.about) },
            {
              label: generalT('learnings.label'),
              value: String(countLearningItems(generalDraft?.learnings) || 0),
            },
            { label: generalT('tags.label'), value: normalizeTags(generalDraft?.tags) },
            { label: generalT('thumbnailType'), value: formatString(generalDraft?.thumbnail_type) },
          ),
        };
      }
      case 'access': {
        const accessDraft = draftValue as any;

        return {
          sectionLabel: accessT('accessToTheCourse'),
          rows: buildRows({
            label: accessT('accessToTheCourse'),
            value: accessDraft?.public ? accessT('publicLabel') : accessT('usersOnlyLabel'),
          }),
        };
      }
      case 'contributors': {
        const contributorsDraft = draftValue as any;

        return {
          sectionLabel: contributorsT('courseContributorsTitle'),
          rows: buildRows(
            {
              label: contributorsT('courseContributorsTitle'),
              value: contributorsDraft?.open_to_contributors
                ? contributorsT('openToContributorsTitle')
                : contributorsT('closeToContributorsTitle'),
            },
            {
              label: contributorsT('manageContributorsTitle'),
              value: `${contributorCounts.total} total, ${contributorCounts.active} active, ${contributorCounts.pending} pending, ${contributorCounts.inactive} inactive`,
            },
          ),
        };
      }
      case 'certification': {
        const certificationDraft = draftValue as any;

        return {
          sectionLabel: certificationT('courseCertification'),
          rows: buildRows(
            {
              label: certificationT('courseCertification'),
              value: certificationDraft?.enable_certification ? certificationT('enableCertificationButton') : fallbackValue,
            },
            { label: certificationT('certificationName'), value: formatString(certificationDraft?.certification_name) },
            {
              label: certificationT('certificationType'),
              value: certificationDraft?.certification_type
                ? certificationT(`certificationTypes.${certificationDraft.certification_type}`)
                : fallbackValue,
            },
            {
              label: certificationT('certificatePattern'),
              value: formatString(certificationDraft?.certificate_pattern),
            },
            {
              label: certificationT('certificateInstructor'),
              value: formatString(certificationDraft?.certificate_instructor),
            },
          ),
        };
      }
      case 'activity': {
        const activityDraft = draftValue as any;

        return {
          sectionLabel: activityDraft?.activity_type || 'Activity',
          rows: buildRows(
            { label: generalT('name.label'), value: formatString(activityDraft?.name) },
            {
              label: 'Published',
              value:
                activityDraft?.published === true ? accessT('publicLabel') : activityDraft?.published === false ? accessT('usersOnlyLabel') : fallbackValue,
            },
            {
              label: 'Content blocks',
              value: String(Array.isArray(activityDraft?.content?.content) ? activityDraft.content.content.length : 0),
            },
          ),
        };
      }
      default:
        return {
          sectionLabel: undefined,
          rows: [],
        };
    }
  };

  const buildServerSummary = () => {
    switch (conflict.draftSection) {
      case 'general':
        return {
          sectionLabel: generalT('title', { courseName: courseStructure?.name || '' }),
          rows: buildRows(
            { label: generalT('name.label'), value: formatString(courseStructure?.name) },
            { label: generalT('description.label'), value: formatString(courseStructure?.description) },
            { label: generalT('about.label'), value: formatString(courseStructure?.about) },
            { label: generalT('learnings.label'), value: String(countLearningItems(courseStructure?.learnings) || 0) },
            { label: generalT('tags.label'), value: normalizeTags(courseStructure?.tags) },
            { label: generalT('thumbnailType'), value: formatString(courseStructure?.thumbnail_type) },
          ),
        };
      case 'access':
        return {
          sectionLabel: accessT('accessToTheCourse'),
          rows: buildRows({
            label: accessT('accessToTheCourse'),
            value: courseStructure?.public ? accessT('publicLabel') : accessT('usersOnlyLabel'),
          }),
        };
      case 'contributors':
        return {
          sectionLabel: contributorsT('courseContributorsTitle'),
          rows: buildRows(
            {
              label: contributorsT('courseContributorsTitle'),
              value: courseStructure?.open_to_contributors
                ? contributorsT('openToContributorsTitle')
                : contributorsT('closeToContributorsTitle'),
            },
            {
              label: contributorsT('manageContributorsTitle'),
              value: `${contributorCounts.total} total, ${contributorCounts.active} active, ${contributorCounts.pending} pending, ${contributorCounts.inactive} inactive`,
            },
          ),
        };
      case 'certification':
        return {
          sectionLabel: certificationT('courseCertification'),
          rows: buildRows(
            {
              label: certificationT('courseCertification'),
              value: certificationConfig ? certificationT('enableCertificationButton') : fallbackValue,
            },
            { label: certificationT('certificationName'), value: formatString(certificationConfig?.certification_name) },
            {
              label: certificationT('certificationType'),
              value: certificationConfig?.certification_type
                ? certificationT(`certificationTypes.${certificationConfig.certification_type}`)
                : fallbackValue,
            },
            {
              label: certificationT('certificatePattern'),
              value: formatString(certificationConfig?.certificate_pattern),
            },
            {
              label: certificationT('certificateInstructor'),
              value: formatString(certificationConfig?.certificate_instructor),
            },
          ),
        };
      case 'activity':
        return {
          sectionLabel: courseStructure?.name || undefined,
          rows: buildRows(
            { label: generalT('name.label'), value: formatString(courseStructure?.name) },
            { label: accessT('accessToTheCourse'), value: courseStructure?.public ? accessT('publicLabel') : accessT('usersOnlyLabel') },
          ),
        };
      default:
        return {
          sectionLabel: courseStructure?.name || undefined,
          rows: buildRows(
            { label: generalT('name.label'), value: formatString(courseStructure?.name) },
            { label: generalT('description.label'), value: formatString(courseStructure?.description) },
          ),
        };
    }
  };

  const draftSummary = buildDraftSummary();
  const serverSummary = buildServerSummary();

  return (
    <AlertDialog
      open={conflict.isOpen}
      onOpenChange={(open) => {
        if (!open) {
          dismissConflict();
        }
      }}
    >
      <AlertDialogContent className="max-w-3xl">
        <AlertDialogHeader>
          <AlertDialogMedia className="bg-muted text-foreground">
            <AlertTriangle className="size-8" />
          </AlertDialogMedia>
          <AlertDialogTitle>{t('title')}</AlertDialogTitle>
          <AlertDialogDescription>{conflict.message || t('description')}</AlertDialogDescription>
        </AlertDialogHeader>

        <div className="grid gap-4 rounded-xl border bg-muted/30 p-4 md:grid-cols-2">
          <SummaryCard
            title={t('draftSummaryTitle')}
            sectionLabel={draftSummary.sectionLabel}
            rows={draftSummary.rows}
            emptyState={t('emptyDraftSummary')}
          />
          <SummaryCard
            title={t('serverSummaryTitle')}
            sectionLabel={serverSummary.sectionLabel}
            rows={serverSummary.rows}
            emptyState={t('emptyServerSummary')}
          />
        </div>

        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => void resolveConflict('use-theirs')}>
            {t('useTheirsButton')}
          </AlertDialogCancel>
          <AlertDialogAction onClick={() => void resolveConflict('use-mine')}>
            <RefreshCcw className="mr-2 size-4" />
            {t('keepMineButton')}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
