import { cn } from '../../lib/utils';

export interface PillProps {
  label: string;
  value: string;
  className?: string;
}

export function Pill({ label, value, className }: PillProps) {
  return (
    <div
      className={cn(
        'inst-glass-chip inline-flex items-center gap-2 rounded-full px-3 py-1',
        className
      )}
    >
      <span className="font-mono text-[10px] uppercase tracking-widest text-inst-muted-foreground">
        {label}
      </span>
      <span className="font-mono text-sm text-inst-foreground transition-colors duration-[220ms] ease-inst-out-expo">
        {value}
      </span>
    </div>
  );
}
