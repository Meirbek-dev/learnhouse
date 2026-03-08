'use client';

import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

interface AnalyticsExportButtonProps {
  href: string;
  label: string;
}

export default function AnalyticsExportButton({ href, label }: AnalyticsExportButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={() => {
        window.open(href, '_blank', 'noopener,noreferrer');
      }}
    >
      <Download className="h-4 w-4" />
      {label}
    </Button>
  );
}
