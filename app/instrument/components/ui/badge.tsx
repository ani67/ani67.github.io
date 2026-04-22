import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const badgeVariants = cva(
  'inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-inst-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:     'border-transparent bg-inst-primary text-inst-primary-foreground hover:bg-inst-primary/80',
        secondary:   'border-transparent bg-inst-secondary text-inst-secondary-foreground hover:bg-inst-secondary/80',
        destructive: 'border-transparent bg-inst-destructive text-inst-destructive-foreground hover:bg-inst-destructive/80',
        outline:     'text-inst-foreground',
      },
    },
    defaultVariants: { variant: 'default' },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}
