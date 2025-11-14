import * as React from 'react';
import { cn } from '@/lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

const baseClasses =
  'inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 disabled:pointer-events-none disabled:opacity-50';

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'bg-sky-400 text-slate-950 hover:bg-sky-300 dark:bg-sky-400 dark:text-slate-950 dark:hover:bg-sky-300',
  outline:
    'border border-slate-500 bg-transparent text-slate-100 hover:bg-slate-800/60',
  ghost:
    'bg-transparent text-slate-100 hover:bg-slate-800/80',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'h-9 px-4 py-2',
  sm: 'h-8 px-3 text-xs',
  lg: 'h-10 px-6 text-base',
};

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    const variantClass = variantClasses[variant] ?? variantClasses.default;
    const sizeClass = sizeClasses[size] ?? sizeClasses.default;

    return (
      <button
        ref={ref}
        className={cn(baseClasses, variantClass, sizeClass, className)}
        {...props}
      />
    );
  },
);

Button.displayName = 'Button';
