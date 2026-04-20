import * as React from 'react';
import { cn } from '@/lib/cn';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg';
}

const baseClasses =
  'inline-flex min-h-11 items-center justify-center whitespace-nowrap border font-mono text-sm font-bold uppercase transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-love disabled:pointer-events-none disabled:opacity-50';

const variantClasses: Record<NonNullable<ButtonProps['variant']>, string> = {
  default:
    'border-love bg-love text-white hover:bg-[#ff2a2a]',
  outline:
    'border-border-color bg-transparent text-text hover:border-love hover:bg-overlay',
  ghost:
    'border-transparent bg-transparent text-text hover:border-border-color hover:bg-overlay',
};

const sizeClasses: Record<NonNullable<ButtonProps['size']>, string> = {
  default: 'px-4 py-2',
  sm: 'min-h-10 px-3 text-xs',
  lg: 'px-6 py-3 text-base',
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
