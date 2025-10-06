/**
 * Collapsible Section Component
 *
 * Allows users to collapse gamification sections to reduce clutter.
 * Preference is saved to localStorage.
 */

'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { type ReactNode, useEffect, useState } from 'react';

interface CollapsibleSectionProps {
  title: string;
  children: ReactNode;
  storageKey: string;
  defaultExpanded?: boolean;
  className?: string;
}

export function CollapsibleSection({
  title,
  children,
  storageKey,
  defaultExpanded = true,
  className = '',
}: CollapsibleSectionProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const [isHydrated, setIsHydrated] = useState(false);

  // Load preference from localStorage on mount
  useEffect(() => {
    try {
      const savedState = localStorage.getItem(storageKey);
      if (savedState !== null) {
        setIsExpanded(savedState === 'true');
      }
    } catch (error) {
      console.warn('Failed to load collapse state:', error);
    }
    setIsHydrated(true);
  }, [storageKey]);

  // Save preference to localStorage
  const toggleExpanded = () => {
    const newState = !isExpanded;
    setIsExpanded(newState);
    try {
      localStorage.setItem(storageKey, String(newState));
    } catch (error) {
      console.warn('Failed to save collapse state:', error);
    }
  };

  // Prevent hydration mismatch
  if (!isHydrated) {
    return (
      <Card className={className}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold">{title}</CardTitle>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 p-0"
              disabled
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        {defaultExpanded && <CardContent>{children}</CardContent>}
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-semibold">{title}</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 p-0 transition-transform"
            onClick={toggleExpanded}
            aria-label={isExpanded ? 'Collapse section' : 'Expand section'}
            aria-expanded={isExpanded}
          >
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </div>
      </CardHeader>
      {isExpanded && <CardContent className="animate-in fade-in slide-in-from-top-2">{children}</CardContent>}
    </Card>
  );
}
