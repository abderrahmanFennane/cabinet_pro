import { Link } from 'react-router-dom'
import { Button } from '../components/ui/button'
import { Stethoscope, Home } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'

export default function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="relative isolate flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-background p-6 text-center">
      <span aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 -z-10 h-64 w-64 rounded-full bg-[#DCEEE7]" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-36 -z-10 h-72 w-72 rounded-full bg-[#DCEEE7] opacity-80" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-36 -right-32 -z-10 h-64 w-64 rounded-full bg-[#F5EEFF] opacity-70" />
      <div className="absolute right-4 top-4 w-24 sm:right-8 sm:top-8"><LanguageSwitcher /></div>
      <span className="relative mb-6 flex h-24 w-24 items-center justify-center rounded-full border-4 border-white bg-[#DCEEE7] text-[#12705A] shadow-[0_12px_24px_-18px_rgba(18,112,90,0.7)]">
        <Stethoscope size={40} strokeWidth={2.2} />
        <i aria-hidden="true" className="absolute -right-2 top-1 h-3 w-3 rounded-full bg-[#46C49F]" />
        <i aria-hidden="true" className="absolute -right-5 top-5 h-2 w-2 rounded-full bg-[#46C49F]" />
      </span>
      <h1 className="mb-2 text-7xl font-black tracking-[-0.05em] text-[#14231E]">404</h1>
      <h2 className="mb-3 text-2xl font-bold tracking-[-0.03em] text-[#14231E]">{t('errors.notFoundTitle')}</h2>
      <p className="mb-8 max-w-md text-[#5A6B65]">
        {t('errors.notFoundDescription')}
      </p>
      <Button asChild size="lg">
        <Link to="/">
          <Home size={18} className="me-2" />
          {t('common.back')}
        </Link>
      </Button>
    </div>
  )
}
