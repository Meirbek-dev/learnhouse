import { Badge } from '@components/ui/badge';
import { STATUS_LABELS } from '@/types/grading';
import type { SubmissionStatus } from '@/types/grading';
import { cn } from '@/lib/utils';

interface SubmissionStatusBadgeProps {
  status: SubmissionStatus;
  className?: string;
}

const STATUS_VARIANTS: Record<SubmissionStatus, 'secondary' | 'warning' | 'success' | 'default' | 'destructive'> = {
  DRAFT: 'secondary',
  PENDING: 'warning',
  GRADED: 'success',
  PUBLISHED: 'default',
  RETURNED: 'destructive',
};

export default function SubmissionStatusBadge({ status, className }: SubmissionStatusBadgeProps) {
  return (
    <Badge
      variant={STATUS_VARIANTS[status] ?? 'default'}
      className={cn('inline-flex items-center text-xs font-semibold', className)}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
