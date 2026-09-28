import { Languages } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select'
import { AppLanguage } from '../../i18n'

export default function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { i18n, t } = useTranslation()
  const language = (i18n.resolvedLanguage || i18n.language || 'fr').split('-')[0]

  return (
    <Select value={language} onValueChange={(value) => void i18n.changeLanguage(value as AppLanguage)}>
      <SelectTrigger
        aria-label={t('common.language')}
        className={compact ? 'h-10 w-[74px] gap-1 rounded-xl border-transparent bg-[#E9EFEC] px-2 font-semibold hover:border-[#D8E1DD]' : 'h-10 w-full min-w-36'}
      >
        <Languages size={15} className="shrink-0 text-primary" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end">
        <SelectItem value="fr">FR</SelectItem>
        <SelectItem value="en">EN</SelectItem>
        <SelectItem value="ar">AR</SelectItem>
      </SelectContent>
    </Select>
  )
}
