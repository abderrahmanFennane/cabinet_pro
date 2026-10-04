import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Copy, Loader2, MessageCircle, MessageSquare } from 'lucide-react'
import api from '../../lib/api'
import { apiError, useCabinetApi } from '../../lib/hooks'
import { formatDateFR } from '../../lib/utils'
import { whatsappLink } from '../billing/UnpaidFollowUp'
import { Button } from '../ui/button'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'

export type ShareTarget = { kind: 'PRESCRIPTION' | 'DOCUMENT' | 'INVOICE'; refId: string; patientId: string; label: string }
type Share = { id: string; url: string; expiresAt: string; message: string; phone: string | null }

/** Sends a document to the patient as a private link (WhatsApp from the clinic's phone, or SMS by the platform). */
export default function ShareDialog({ target, onClose }: { target: ShareTarget | null; onClose: () => void }) {
  const { t } = useTranslation()
  const cabinetApi = useCabinetApi()
  const [share, setShare] = useState<Share | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setShare(null)
    if (!target) return
    let cancelled = false
    api.post(`${cabinetApi}/patients/${target.patientId}/shares`, { kind: target.kind, refId: target.refId })
      .then(r => { if (!cancelled) setShare(r.data.data) })
      .catch(err => { toast.error(apiError(err)); onClose() })
    return () => { cancelled = true }
  }, [target, cabinetApi, onClose])

  const sms = async () => {
    if (!share || !target) return
    setBusy(true)
    try {
      const r = await api.post(`${cabinetApi}/patients/${target.patientId}/shares/${share.id}/send`, { channel: 'SMS' })
      toast.success(r.data.message)
      onClose()
    } catch (err) { toast.error(apiError(err)) } finally { setBusy(false) }
  }

  return (
    <Dialog open={!!target} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('share.title', { what: target?.label ?? '' })}</DialogTitle>
          <DialogDescription>{t('share.hint')}</DialogDescription>
        </DialogHeader>
        {!share ? (
          <p className="flex items-center gap-2 py-6 text-sm text-muted-foreground"><Loader2 size={16} className="animate-spin" />{t('share.creating')}</p>
        ) : (
          <div className="space-y-4">
            <p className="break-words rounded-xl bg-[#F2F5F3] p-3 text-sm" dir="auto">{share.message}</p>
            <p className="text-xs text-muted-foreground">{t('share.expires', { date: formatDateFR(share.expiresAt) })}</p>
            {share.phone ? (
              <div className="grid gap-2 sm:grid-cols-2">
                <Button asChild className="bg-[#1E8E4E] hover:bg-[#177A42]">
                  <a href={whatsappLink(share.phone, share.message)} target="_blank" rel="noreferrer" onClick={() => onClose()}><MessageCircle size={16} className="me-1.5" />{t('unpaid.openWhatsapp')}</a>
                </Button>
                <Button variant="outline" onClick={sms} disabled={busy}><MessageSquare size={16} className="me-1.5" />{t('unpaid.sendSms')}</Button>
              </div>
            ) : <p className="rounded-xl bg-[#FBEED6] px-3 py-2 text-sm text-[#99600B]">{t('unpaid.noPhone')}</p>}
            <Button variant="ghost" size="sm" onClick={() => { void navigator.clipboard?.writeText(share.url); toast.success(t('share.copied')) }}><Copy size={15} className="me-1.5" />{t('share.copy')}</Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
