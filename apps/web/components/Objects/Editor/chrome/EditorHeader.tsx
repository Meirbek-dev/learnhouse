'use client';

import { useTranslations } from 'next-intl';
import { Eye } from 'lucide-react';
import Link from '@components/ui/AppLink';
import Image from 'next/image';
import platformLogoDark from "@public/platform_logo.svg";
import UserAvatar from '../../UserAvatar';
import { Separator } from '@/components/ui/separator';
import { EditorSaveIndicator } from './EditorSaveIndicator';

interface EditorHeaderProps {
  courseName: string;
  activityName: string;
  courseUuid: string;
  activityUuid: string;
  saveState: 'idle' | 'saving' | 'saved' | 'error';
  onSave: () => void;
}

export function EditorHeader({
  courseName,
  activityName,
  courseUuid,
  activityUuid,
  saveState,
  onSave,
}: EditorHeaderProps) {
  const t = useTranslations('DashPage.Editor.Editor');

  return (
    <div className="flex h-12 items-center justify-between border-b border-border bg-background px-3">
      {/* Left: breadcrumb */}
      <div className="flex items-center gap-2 min-w-0">
        <Link href="/">
          <Image
            className="rounded-md"
            width={22}
            height={22}
            src={platformLogoDark}
            alt="Ashyq Bilim logo"
          />
        </Link>
        <Separator orientation="vertical" className="h-4" />
        <nav className="flex items-center gap-1 text-sm min-w-0 truncate">
          <Link
            target="_blank"
            href={`/course/${courseUuid}`}
            className="font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            {courseName}
          </Link>
          <span className="text-muted-foreground/60">/</span>
          <span className="text-foreground font-medium truncate">{activityName}</span>
        </nav>
      </div>

      {/* Right: actions */}
      <div className="flex items-center gap-2">
        <EditorSaveIndicator saveState={saveState} />

        <button
          type="button"
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
          onClick={onSave}
        >
          {t("save")}
        </button>

        <Link
          target="_blank"
          href={`/course/${courseUuid}/activity/${activityUuid}`}
          className="flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          title={t("preview")}
        >
          <Eye className="size-4" />
        </Link>

        <Separator orientation="vertical" className="mx-0.5 h-4" />

        <UserAvatar size="lg" variant="outline" use_with_session />
      </div>
    </div>
  );
}
