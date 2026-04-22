import * as React from 'react';
import { cn } from '../../lib/utils';

/** Frosted-glass panel. Composes the `.inst-glass` recipe from instrument.css. */
export const Card = React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn('inst-glass rounded-lg text-inst-card-foreground', className)}
      {...props}
    />
  )
);
Card.displayName = 'Card';
