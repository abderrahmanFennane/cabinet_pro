import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear, subMonths } from 'date-fns'
import { Download, Loader2 } from 'lucide-react'
import { apiError, useCabinetApi } from '../../lib/hooks'
import { downloadFile } from '../../lib/download'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

const iso = (d: Date) => format(d, 'yyyy-MM-dd')

/** Excel file for the accountant: invoices, payments, monthly summary, cash closings over a period. */
export default function ExportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const cabinetApi = useCabinetApi()
  const now = new Date()
  const [from, setFrom] = useState(iso(startOfMonth(now)))
  const [to, setTo] = useState(iso(now))
  const [busy, setBusy] = useState(false)
  const presets: [string, Date, Date][] = [
    [t('accounting.thisMonth'), startOfMonth(now), now],
    [t('accounting.lastMonth'), startOfMonth(subMonths(now, 1)), endOfMonth(subMonths(now, 1))],
    [t('accounting.thisYear'), startOfYear(now), now],
    [t('accounting.lastYear'), startOfYear(subMonths(startOfYear(now), 1)), endOfYear(subMonths(startOfYear(now), 1))],
  ]
  const run = async () => {
    setBusy(true)
    try {
      await downloadFile(`${cabinetApi}/billing/export`, `comptabilite-${from}-au-${to}.xlsx`, { from, to })
      onOpenChange(false)
    } catch (err) { toast.error(apiError(err)) } finally { setBusy(false) }
  }
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('accounting.title')}</DialogTitle>
          <DialogDescription>{t('accounting.hint')}</DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          {presets.map(([label, a, b]) => (
            <button key={label} type="button" onClick={() => { setFrom(iso(a)); setTo(iso(b)) }}
              className="rounded-full border border-[#D8E1DD] px-3 py-1.5 text-sm font-semibold hover:border-primary hover:text-primary">{label}</button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5"><Label htmlFor="exp-from">{t('accounting.from')}</Label><Input id="exp-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="exp-to">{t('accounting.to')}</Label><Input id="exp-to" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <Button onClick={run} disabled={busy || !from || !to || from > to}>
          {busy ? <Loader2 size={16} className="me-1.5 animate-spin" /> : <Download size={16} className="me-1.5" />}{t('accounting.download')}
        </Button>
      </DialogContent>
    </Dialog>
  )
}
