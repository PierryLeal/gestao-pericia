'use client';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

/**
 * Wraps a (typically narrow, editable) field so hovering it shows the full
 * current value in a tooltip — for table cells too tight to show long text
 * in full, without changing how the field itself behaves.
 */
export function TooltipField({ value, children }: { value: string; children: React.ReactNode }) {
  if (!value.trim()) return children;
  return (
    <Tooltip>
      <TooltipTrigger render={<div className="min-w-0" />}>{children}</TooltipTrigger>
      <TooltipContent>{value}</TooltipContent>
    </Tooltip>
  );
}
