import { ReactNode } from 'react'
import { ArrowLeft } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { cn } from '../../lib/utils'
import { tones, Tone } from '../../lib/tones'

interface PageHeaderProps {
  title: ReactNode
  subtitle?: ReactNode
  eyebrow?: ReactNode
  actions?: ReactNode
  onBack?: () => void
  className?: string
}

// Page title block: plain title, one line of context, actions on the right.
export function PageHeader({ title, subtitle, eyebrow, actions, onBack, className }: PageHeaderProps) {
  const { t } = useTranslation()
  return (
    <div className={cn('flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="flex min-w-0 items-start">
        <div className="min-w-0">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="mb-1.5 inline-flex items-center gap-1.5 rounded-full text-xs font-medium text-[#5A6B65] transition-colors hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <ArrowLeft size={14} className="rtl:rotate-180" /> {t('common.back')}
            </button>
          )}
          {eyebrow && <p className="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{eyebrow}</p>}
          <h1 className="break-words text-[1.35rem] font-extrabold leading-tight text-[#14231E] sm:text-[1.6rem]">{title}</h1>
          {subtitle && <div className="mt-1 text-[0.95rem] text-[#5A6B65]">{subtitle}</div>}
        </div>
      </div>
      {actions && (
        <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:justify-end [&>*]:flex-1 sm:[&>*]:flex-none">
          {actions}
        </div>
      )}
    </div>
  )
}

interface EmptyStateProps {
  icon: ReactNode
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  tone?: Tone
  className?: string
}

export function EmptyState({ icon, title, description, action, tone = 'blue', className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center px-4 py-12 text-center', className)}>
      <span className={cn('relative flex h-16 w-16 items-center justify-center rounded-full border-4 border-white shadow-[0_12px_24px_-18px_rgba(18,112,90,0.7)]', tones[tone].chip)}>
        {icon}
        <i aria-hidden="true" className={cn('absolute -right-2 top-0 h-2 w-2 rounded-full', tones[tone].dot)} />
      </span>
      <p className="mt-4 font-semibold text-[#14231E]">{title}</p>
      {description && <p className="mt-1 max-w-sm text-sm text-[#5A6B65]">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  )
}
