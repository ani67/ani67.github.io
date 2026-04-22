import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '../../lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inst-ring focus-visible:ring-offset-2 focus-visible:ring-offset-inst-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default: 'bg-inst-primary text-inst-primary-foreground hover:bg-inst-primary/90',
        destructive: 'bg-inst-destructive text-inst-destructive-foreground hover:bg-inst-destructive/90',
        outline: 'border border-inst-input bg-transparent hover:bg-inst-accent hover:text-inst-accent-foreground',
        secondary: 'bg-inst-secondary text-inst-secondary-foreground hover:bg-inst-secondary/80',
        ghost: 'hover:bg-inst-accent hover:text-inst-accent-foreground',
      },
      size: {
        default: 'h-9 px-4 py-2',
        sm: 'h-8 rounded-md px-3 text-xs',
        icon: 'h-9 w-9',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
);
Button.displayName = 'Button';
