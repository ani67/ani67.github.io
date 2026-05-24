import * as React from 'react';
import { cn } from '../../lib/utils';

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  /** Tailwind alignment of the floating panel relative to the trigger. */
  align?: 'start' | 'center' | 'end';
  /** Whether the panel sits below the trigger (default) or above it. Used
   *  by bottom-anchored UI (looper dock) to keep tooltips on-screen. */
  placement?: 'bottom' | 'top';
  className?: string;
}

/**
 * CSS-only hover/focus tooltip. Pairs with `inst-glass-chip` styling so it
 * reads against the gradient background.
 */
export function Tooltip({ content, children, align = 'center', placement = 'bottom', className }: TooltipProps) {
  const alignCls =
    align === 'start' ? 'left-0'
    : align === 'end' ? 'right-0'
    : 'left-1/2 -translate-x-1/2';

  const placementCls = placement === 'top'
    ? 'bottom-full mb-2 translate-y-[2px] group-hover:translate-y-0 group-focus-within:translate-y-0'
    : 'top-full mt-2 -translate-y-[2px] group-hover:translate-y-0 group-focus-within:translate-y-0';

  return (
    <span className="group relative inline-flex">
      {children}
      <span
        role="tooltip"
        style={{
          backdropFilter: 'blur(16px) saturate(140%)',
          WebkitBackdropFilter: 'blur(16px) saturate(140%)',
          backgroundColor: 'hsl(0 0% 6% / 0.55)',
        }}
        className={cn(
          'pointer-events-none absolute z-50 w-max max-w-[260px] rounded-lg',
          'border border-white/10 px-3 py-2 text-left font-mono text-[11px] leading-snug text-inst-foreground',
          'opacity-0 transition duration-[180ms] ease-inst-out-expo',
          'group-hover:opacity-100',
          'group-focus-within:opacity-100',
          placementCls,
          alignCls,
          className
        )}
      >
        {content}
      </span>
    </span>
  );
}
