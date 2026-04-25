import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  /** Tailwind alignment of the floating panel relative to the trigger. */
  align?: 'start' | 'center' | 'end';
  className?: string;
}

/**
 * CSS-only hover/focus tooltip. Pairs with `inst-glass-chip` styling so it
 * reads against the gradient background.
 */
export function Tooltip({ content, children, align = 'center', className }: TooltipProps) {
  const alignCls =
    align === 'start' ? 'left-0'
    : align === 'end' ? 'right-0'
    : 'left-1/2 -translate-x-1/2';

  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        className={cn(
          'pointer-events-none absolute top-full z-50 mt-2 w-max max-w-[260px] rounded-lg',
          'inst-glass-chip px-3 py-2 text-left font-mono text-[11px] leading-snug text-inst-foreground',
          'opacity-0 translate-y-[-2px] transition duration-[180ms] ease-inst-out-expo',
          'group-hover:opacity-100 group-hover:translate-y-0',
          'group-focus-within:opacity-100 group-focus-within:translate-y-0',
          alignCls,
          className
        )}
      >
        {content}
      </span>
    </span>
  );
}
