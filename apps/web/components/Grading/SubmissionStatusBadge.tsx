import { STATUS_COLORS, STATUS_LABELS } from '@/types/grading';
import type { SubmissionStatus } from '@/types/grading';
import { cn } from '@/lib/utils';

interface SubmissionStatusBadgeProps {
  status: SubmissionStatus;
  className?: string;
}

export default function SubmissionStatusBadge({ status, className }: SubmissionStatusBadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold',
        STATUS_COLORS[status] ?? 'bg-slate-100 text-slate-700',
        className,
      )}
    >
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}
