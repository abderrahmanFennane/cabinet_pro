import { toast as sonnerToast } from 'sonner'

export type ToastProps = {
  title?: string
  description?: string
  variant?: 'default' | 'destructive' | 'success'
}

export function toast({ title, description, variant = 'default' }: ToastProps) {
  if (variant === 'success') {
    return sonnerToast.success(title, { description })
  }
  if (variant === 'destructive') {
    return sonnerToast.error(title, { description })
  }
  return sonnerToast(title, { description })
}
