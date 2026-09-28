import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-[0.78rem] font-bold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2',
  {
    variants: {
      variant: {
        default:
          'border-transparent bg-[#DCEEE7] text-[#12705A]',
        success:
          'border-transparent bg-[#DFF1E6] text-[#1E7A45]',
        warning:
          'border-transparent bg-[#FBEED6] text-[#99600B]',
        destructive:
          'border-transparent bg-[#FBE3E0] text-[#B8372C]',
        outline: 'text-foreground border-border bg-background',
        secondary:
          'border-transparent bg-[#E9EFEC] text-[#5A6B65]',
      },
    },
    defaultVariants: {
      variant: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
