import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Loader2, Lock } from 'lucide-react'
import api from '../lib/api'
import { apiError, practitionerName } from '../lib/hooks'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import { DocumentBody, InvoiceBody, PrescriptionBody, PrintPage } from './Print'

type Info = { cabinet: { name: string; phone: string | null }; kind: string; firstName: string; check: 'BIRTH_DATE' | 'PHONE' | 'NONE'; expiresAt: string }
type Opened = { kind: 'PRESCRIPTION' | 'DOCUMENT' | 'INVOICE'; cabinet: any; patient: any; document: any }

/** Page the patient opens from the link received by WhatsApp or SMS (no account, no session). */
export default function SharedDocument() {
  const { token = '' } = useParams()
  const { t } = useTranslation()
  const [info, setInfo] = useState<Info | null>(null)
  const [error, setError] = useState('')
  const [answer, setAnswer] = useState('')
  const [busy, setBusy] = useState(false)
  const [opened, setOpened] = useState<Opened | null>(null)

  const open = async (body: Record<string, string>) => {
    setBusy(true); setError('')
    try { setOpened((await api.post(`/share/${token}`, body)).data.data) } catch (err) { setError(apiError(err)) } finally { setBusy(false) }
  }

  useEffect(() => {
    api.get(`/share/${token}`)
      .then(r => { setInfo(r.data.data); if (r.data.data.check === 'NONE') void open({}) })
      .catch(err => setError(apiError(err)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  if (opened) {
    const doc = opened.document
    return (
      <PrintPage ready cabinet={opened.cabinet} autoPrint={false} signature={opened.kind === 'INVOICE' ? undefined : practitionerName(doc.practitioner)}>
        {opened.kind === 'PRESCRIPTION' && <PrescriptionBody patient={opened.patient} rx={doc} />}
        {opened.kind === 'DOCUMENT' && <DocumentBody doc={doc} />}
        {opened.kind === 'INVOICE' && <InvoiceBody inv={doc} currency={opened.cabinet.currency || 'MAD'} />}
      </PrintPage>
    )
  }

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#F2F5F3] px-4 py-10">
      <div className="absolute end-4 top-4 w-24"><LanguageSwitcher compact /></div>
      <div className="w-full max-w-sm space-y-5 rounded-[18px] border border-[#D8E1DD] bg-white p-6">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#DCEEE7] text-primary"><Lock size={20} /></span>
          <div>
            <p className="font-bold">{info?.cabinet.name || 'Cabinet Pro'}</p>
            <p className="text-sm text-[#5A6B65]">{info ? t(`share.kind.${info.kind}`) : ''}</p>
          </div>
        </div>
        {error && <p role="alert" className="rounded-xl bg-[#FBE3E0] px-3 py-2 text-sm font-semibold text-[#B8372C]">{error}</p>}
        {!info && !error && <p className="flex items-center gap-2 text-sm text-[#5A6B65]"><Loader2 size={16} className="animate-spin" />{t('common.loading')}</p>}
        {info && info.check !== 'NONE' && (
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); void open(info.check === 'BIRTH_DATE' ? { birthDate: answer } : { phoneDigits: answer }) }}>
            <p className="text-sm">{t('share.hello', { name: info.firstName })} {info.check === 'BIRTH_DATE' ? t('share.askBirth') : t('share.askPhone')}</p>
            <div className="space-y-1.5">
              <Label htmlFor="share-answer">{info.check === 'BIRTH_DATE' ? t('share.birthDate') : t('share.phoneDigits')}</Label>
              {info.check === 'BIRTH_DATE'
                ? <Input id="share-answer" type="date" required value={answer} onChange={e => setAnswer(e.target.value)} />
                : <Input id="share-answer" inputMode="numeric" maxLength={4} required value={answer} onChange={e => setAnswer(e.target.value.replace(/\D/g, ''))} className="text-center font-mono text-xl tracking-[0.4em]" dir="ltr" />}
            </div>
            <Button type="submit" className="w-full" disabled={busy || !answer}>{busy ? <Loader2 size={16} className="animate-spin" /> : t('share.open')}</Button>
          </form>
        )}
        {info?.cabinet.phone && <p className="text-xs text-[#5A6B65]">{t('share.contact', { phone: info.cabinet.phone })}</p>}
      </div>
    </main>
  )
}
