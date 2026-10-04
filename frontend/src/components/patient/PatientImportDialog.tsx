import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle, CheckCircle2, Copy, Download, FileSpreadsheet, Loader2 } from 'lucide-react'
import api from '../../lib/api'
import { apiError, useCabinetApi } from '../../lib/hooks'
import { downloadFile } from '../../lib/download'
import { cn, formatDateFR } from '../../lib/utils'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'

type Line = { line: number; status: 'NEW' | 'DUPLICATE' | 'ERROR'; errors: string[]; warnings: string[]; name: string | null; phone: string | null; birthDate: string | null }
type Preview = { total: number; new: number; duplicates: number; errors: number; columns: string[]; ignoredColumns: string[]; medicalDropped: boolean; lines: Line[] }

/** Import of an existing patient list: download the template, choose the file, check the preview, confirm. */
export default function PatientImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { t } = useTranslation()
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const [busy, setBusy] = useState(false)

  const reset = () => { setFile(null); setPreview(null) }
  const close = (value: boolean) => { if (!value) reset(); onOpenChange(value) }

  const send = async (chosen: File, confirm: boolean) => {
    const body = new FormData()
    body.append('file', chosen)
    return (await api.post(`${cabinetApi}/patients/import`, body, { params: confirm ? { confirm: 1 } : undefined })).data
  }

  const choose = async (chosen: File) => {
    setFile(chosen); setPreview(null); setBusy(true)
    try { setPreview((await send(chosen, false)).data) } catch (err) { toast.error(apiError(err)); setFile(null) } finally { setBusy(false) }
  }

  const confirm = async () => {
    if (!file) return
    setBusy(true)
    try {
      const res = await send(file, true)
      toast.success(t('patientImport.done', { count: res.data.created }))
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      close(false)
    } catch (err) { toast.error(apiError(err)) } finally { setBusy(false) }
  }

  const template = () => downloadFile(`${cabinetApi}/patients/import/template`, 'modele-import-patients.xlsx').catch(err => toast.error(apiError(err)))

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('patientImport.title')}</DialogTitle>
          <DialogDescription>{t('patientImport.hint')}</DialogDescription>
        </DialogHeader>

        {!preview && (
          <div className="space-y-4">
            <ol className="list-decimal space-y-1.5 ps-5 text-sm">
              <li>{t('patientImport.step1')} <button type="button" onClick={template} className="inline-flex items-center gap-1 font-semibold text-primary hover:underline"><Download size={14} />{t('patientImport.template')}</button></li>
              <li>{t('patientImport.step2')}</li>
              <li>{t('patientImport.step3')}</li>
            </ol>
            <label className={cn('flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[#D8E1DD] bg-[#F7FAF8] px-4 py-8 text-center hover:border-primary', busy && 'pointer-events-none opacity-60')}>
              {busy ? <Loader2 className="h-8 w-8 animate-spin text-primary" /> : <FileSpreadsheet className="h-8 w-8 text-primary" />}
              <span className="font-semibold">{busy ? t('patientImport.reading') : t('patientImport.choose')}</span>
              <span className="text-xs text-muted-foreground">Excel (.xlsx) · CSV</span>
              <input type="file" accept=".xlsx,.csv,text/csv" className="sr-only" onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void choose(f) }} />
            </label>
          </div>
        )}

        {preview && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat tone="good" value={preview.new} label={t('patientImport.new')} />
              <Stat tone="neutral" value={preview.duplicates} label={t('patientImport.duplicates')} />
              <Stat tone="bad" value={preview.errors} label={t('patientImport.errors')} />
            </div>
            <p className="text-xs text-muted-foreground">
              {t('patientImport.columns')} {preview.columns.join(', ')}
              {preview.ignoredColumns.length > 0 && <> · {t('patientImport.ignored')} {preview.ignoredColumns.join(', ')}</>}
            </p>
            {preview.medicalDropped && <p className="rounded-xl bg-[#FBEED6] px-3 py-2 text-sm text-[#99600B]">{t('patientImport.medicalDropped')}</p>}
            <ul className="max-h-72 divide-y divide-[#E3EAE7] overflow-y-auto rounded-xl border border-[#D8E1DD] text-sm">
              {preview.lines.map(l => (
                <li key={l.line} className="flex items-start gap-2.5 px-3 py-2">
                  {l.status === 'NEW' ? <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-primary" /> : l.status === 'DUPLICATE' ? <Copy size={16} className="mt-0.5 shrink-0 text-[#5A6B65]" /> : <AlertTriangle size={16} className="mt-0.5 shrink-0 text-[#B8372C]" />}
                  <div className="min-w-0">
                    <p><span className="font-mono text-xs text-muted-foreground">{t('patientImport.line', { n: l.line })}</span> <b>{l.name || '—'}</b>
                      {l.phone && <span className="text-muted-foreground"> · <span dir="ltr">{l.phone}</span></span>}
                      {l.birthDate && <span className="text-muted-foreground"> · {formatDateFR(l.birthDate)}</span>}
                      {l.status === 'DUPLICATE' && <span className="text-muted-foreground"> · {t('patientImport.already')}</span>}
                    </p>
                    {[...l.errors, ...l.warnings].length > 0 && <p className={cn('text-xs', l.errors.length ? 'text-[#B8372C]' : 'text-[#99600B]')}>{[...l.errors, ...l.warnings].join(' · ')}</p>}
                  </div>
                </li>
              ))}
            </ul>
            {preview.new > preview.lines.filter(l => l.status === 'NEW').length && <p className="text-xs text-muted-foreground">{t('patientImport.more', { count: preview.new - preview.lines.filter(l => l.status === 'NEW').length })}</p>}
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={reset} disabled={busy}>{t('patientImport.other')}</Button>
              <Button onClick={confirm} disabled={busy || preview.new === 0}>
                {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}{t('patientImport.confirm', { count: preview.new })}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Stat({ value, label, tone }: { value: number; label: string; tone: 'good' | 'neutral' | 'bad' }) {
  return (
    <div className={cn('rounded-xl px-2 py-3', tone === 'good' ? 'bg-[#DCEEE7] text-primary' : tone === 'bad' ? (value ? 'bg-[#FBE3E0] text-[#B8372C]' : 'bg-[#F2F5F3] text-[#5A6B65]') : 'bg-[#F2F5F3] text-[#5A6B65]')}>
      <p className="text-2xl font-extrabold">{value}</p>
      <p className="text-xs font-semibold">{label}</p>
    </div>
  )
}
