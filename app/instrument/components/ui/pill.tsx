import * as React from 'react';
import { cn } from '../../lib/utils';
import { Tooltip } from './tooltip';

export interface PillProps {
  label: string;
  value: string;
  tooltip?: React.ReactNode;
  className?: string;
}

export function Pill({ label, value, tooltip, className }: PillProps) {
  const chip = (
    <div
      className={cn(
        'inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1 w-[140px]',
        className
      )}
      tabIndex={tooltip ? 0 : undefined}
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground shrink-0">
        {label}
      </span>
      <span className="font-mono text-sm text-inst-foreground transition-colors duration-[220ms] ease-inst-out-expo truncate min-w-0 flex-1">
        {value}
      </span>
    </div>
  );
  return tooltip ? <Tooltip content={tooltip}>{chip}</Tooltip> : chip;
}
