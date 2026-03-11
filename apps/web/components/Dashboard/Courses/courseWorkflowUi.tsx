'use client';

import type { LucideIcon } from 'lucide-react';
import { AlertTriangle, CheckCircle2, CircleDot, Globe, Lock, Sparkles } from 'lucide-react';
import { RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

type CourseWorkflowBadgeTone = 'default' | 'info' | 'success' | 'warning' | 'danger';

const courseWorkflowBadgeToneClass: Record<CourseWorkflowBadgeTone, string> = {
  default: 'border-border bg-background text-foreground',
  info: 'border-border bg-muted/70 text-muted-foreground',
  success: 'border-border bg-muted text-foreground',
  warning: 'border-border bg-accent/60 text-accent-foreground',
  danger: 'border-destructive/20 bg-destructive/5 text-destructive',
};

export function CourseWorkflowBadge({
  tone = 'default',
  icon: Icon,
  children,
  className,
}: {
  tone?: CourseWorkflowBadgeTone;
  icon?: LucideIcon;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn('gap-1.5', courseWorkflowBadgeToneClass[tone], className)}
    >
      {Icon ? <Icon className="size-3.5" /> : null}
      <span>{children}</span>
    </Badge>
  );
}

export function CourseStatusBadge({
  status,
  className,
}: {
  status:
    | 'public'
    | 'private'
    | 'ready'
    | 'needs-review'
    | 'attention'
    | 'unsaved'
    | 'live'
    | 'draft';
  className?: string;
}) {
  const config = {
    public: { label: 'Public', tone: 'success' as const, icon: Globe },
    private: { label: 'Private', tone: 'info' as const, icon: Lock },
    ready: { label: 'Ready', tone: 'success' as const, icon: CheckCircle2 },
    'needs-review': { label: 'Needs review', tone: 'warning' as const, icon: AlertTriangle },
    attention: { label: 'Attention', tone: 'warning' as const, icon: Sparkles },
    unsaved: { label: 'Unsaved changes', tone: 'warning' as const, icon: CircleDot },
    live: { label: 'Live', tone: 'success' as const, icon: Globe },
    draft: { label: 'Draft', tone: 'info' as const, icon: CircleDot },
  }[status];

  return (
    <CourseWorkflowBadge
      tone={config.tone}
      icon={config.icon}
      className={className}
    >
      {config.label}
    </CourseWorkflowBadge>
  );
}

export function CourseChoiceCard({
  id,
  value,
  checked,
  title,
  description,
  icon: Icon,
  disabled = false,
}: {
  id: string;
  value: string;
  checked: boolean;
  title: string;
  description: string;
  icon: LucideIcon;
  disabled?: boolean;
}) {
  return (
    <Label
      htmlFor={id}
      className={cn(
        'flex cursor-pointer flex-col gap-3 rounded-xl border p-5 transition-colors',
        checked
          ? 'border-primary bg-accent/40 text-accent-foreground shadow-sm ring-1 ring-ring/20'
          : 'border-border bg-card text-card-foreground hover:bg-muted/50',
        disabled && 'cursor-not-allowed opacity-60',
      )}
    >
      <RadioGroupItem
        value={value}
        id={id}
        className="sr-only"
        disabled={disabled}
      />
      <div
        className={cn(
          'flex size-10 items-center justify-center rounded-lg border',
          checked ? 'border-primary/20 bg-background text-foreground' : 'border-border bg-muted text-muted-foreground',
        )}
      >
        <Icon className="size-5" />
      </div>
      <div className="space-y-1">
        <div className="text-base font-semibold text-foreground">{title}</div>
        <div className="text-sm leading-6 text-muted-foreground">{description}</div>
      </div>
    </Label>
  );
}

export const courseWorkflowSummaryCardClass = 'rounded-xl border bg-card p-5 shadow-sm';
export const courseWorkflowMutedPanelClass = 'rounded-lg border bg-muted/50 p-4';
