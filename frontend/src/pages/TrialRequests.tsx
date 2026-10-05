import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate, Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Building2, Mail, MessageCircle, Phone, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { apiError } from '../lib/hooks'
import { useL } from '../lib/labels'
import { cn, formatDateTimeFR } from '../lib/utils'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Textarea } from '../components/ui/textarea'
import { whatsappLink } from './SubscriptionBlocked'
import { SpecialtyArt } from '../components/brand'

export type TrialRequest = {
  id: string; fullName: string; email: string; phone: string; cabinetName: string | null; city: string | null; specialty: string | null
  doctors: number | null; message: string | null; status: Status; notes: string | null; cabinetId: string | null; createdAt: string
}
type Status = 'NEW' | 'CONTACTED' | 'CONVERTED' | 'REJECTED'
const STATUS: Record<Status, [string, string]> = {
  NEW: ['Nouvelles', 'bg-[#FBEED6] text-[#99600B]'], CONTACTED: ['Contactées', 'bg-[#E3ECF8] text-[#2D5DAA]'],
  CONVERTED: ['Cabinets créés', 'bg-[#DFF1E6] text-[#1E7A45]'], REJECTED: ['Refusées', 'bg-[#E9EFEC] text-[#5A6B65]'],
}
const ONE: Record<Status, string> = { NEW: 'Nouvelle', CONTACTED: 'Contactée', CONVERTED: 'Cabinet créé', REJECTED: 'Refusée' }

/** Super Admin: trial requests sent from the public home page; call, create the cabinet, or decline. */
export default function TrialRequests() {
  const L = useL()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [status, setStatus] = useState<Status | 'ALL'>('NEW')
  const { data, isLoading } = useQuery({
    queryKey: ['trial-requests', status],
    queryFn: async () => (await api.get('/trial-requests', { params: status === 'ALL' ? {} : { status } })).data.data as { items: TrialRequest[]; counts: Record<Status, number> },
    refetchInterval: 60_000,
  })
  const update = useMutation({
    mutationFn: ({ id, ...body }: { id: string; status?: Status; notes?: string | null }) => api.patch(`/trial-requests/${id}`, body),
    onSuccess: (_, v) => { if (v.status) toast.success(L('Demande mise à jour')); queryClient.invalidateQueries({ queryKey: ['trial-requests'] }) },
    onError: (err) => toast.error(apiError(err)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/trial-requests/${id}`),
    onSuccess: () => { toast.success(L('Demande supprimée')); queryClient.invalidateQueries({ queryKey: ['trial-requests'] }) },
  })
  // Opens the cabinet creation of "Tous les cabinets", prefilled; the request is marked converted once the cabinet exists.
  const createCabinet = (r: TrialRequest) => navigate('/cabinets', { state: { trialRequest: r } })

  const counts = data?.counts
  const items = data?.items || []
  return (
    <div className="grid gap-4">
      <PageHeader title={L('Demandes d’essai')} subtitle={L('Envoyées depuis la page d’accueil. Appelez le médecin, puis créez son cabinet en un clic.')} />
      <div role="tablist" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
        {(['NEW', 'CONTACTED', 'CONVERTED', 'REJECTED', 'ALL'] as const).map(s => (
          <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
            className={cn('shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[0.88rem] font-semibold', status === s ? 'bg-primary text-white' : 'bg-white text-[#3F514A] ring-1 ring-[#D8E1DD] hover:text-primary')}>
            {s === 'ALL' ? L('Toutes') : L(STATUS[s][0])}{counts && s !== 'ALL' ? <span className="ms-1.5 opacity-75">({counts[s]})</span> : null}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-[#5A6B65]">{L('Chargement…')}</p> : items.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-[#D8E1DD] bg-white p-8 text-center text-[#5A6B65]">{L('Aucune demande ici.')}</p>
      ) : (
        <ul className={cn('grid items-start gap-4', items.length > 1 ? 'lg:grid-cols-2' : 'max-w-3xl')}>
          {items.map(r => (
            <RequestCard key={r.id} r={r} busy={update.isPending}
              onStatus={st => update.mutate({ id: r.id, status: st })} onNotes={notes => update.mutate({ id: r.id, notes })}
              onCreate={() => createCabinet(r)} onDelete={() => remove.mutate(r.id)} />
          ))}
        </ul>
      )}
    </div>
  )
}

/** "il y a 5 min", "il y a 3 h", "hier", or the date. */
function ago(date: string, L: (s: string) => string) {
  const min = Math.round((Date.now() - new Date(date).getTime()) / 60_000)
  if (min < 60) return L('il y a {n} min').replace('{n}', String(Math.max(1, min)))
  if (min < 24 * 60) return L('il y a {n} h').replace('{n}', String(Math.round(min / 60)))
  if (min < 48 * 60) return L('hier')
  return formatDateTimeFR(date)
}

/** One trial request: who, how to reach them, their message, internal note and the next step. */
function RequestCard({ r, busy, onStatus, onNotes, onCreate, onDelete }: {
  r: TrialRequest; busy: boolean; onStatus: (s: Status) => void; onNotes: (n: string | null) => void; onCreate: () => void; onDelete: () => void
}) {
  const L = useL()
  const { t } = useTranslation()
  const [noteOpen, setNoteOpen] = useState(false)
  const details = [r.cabinetName, r.city, r.doctors && `${r.doctors >= 5 ? '5+' : r.doctors} ${r.doctors > 1 ? L('praticiens') : L('praticien')}`].filter(Boolean).join(' · ')
  const contact = 'flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#D8E1DD] bg-white px-2 text-[0.86rem] font-semibold hover:border-primary hover:text-primary'
  return (
    <li className={cn('grid gap-3 rounded-[16px] border bg-white p-4', r.status === 'NEW' ? 'border-[#F2D9A9] shadow-[0_10px_30px_-24px_rgba(153,96,11,0.6)]' : 'border-[#D8E1DD]')}>
      <div className="flex items-start gap-3">
        <SpecialtyArt specialty={r.specialty} size="md" label={r.specialty ? t(`specialty.${r.specialty}`) : undefined} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="min-w-0 break-words text-[1.05rem] font-bold leading-tight">{r.fullName}</p>
            <span className={cn('shrink-0 rounded-full px-2.5 py-0.5 text-[0.75rem] font-bold', STATUS[r.status][1])}>{L(ONE[r.status])}</span>
          </div>
          <p className="text-[0.86rem] text-[#5A6B65]">{r.specialty ? <b className="font-semibold text-[#3F514A]">{t(`specialty.${r.specialty}`)}</b> : null}{r.specialty && details ? ' · ' : ''}{details}</p>
          <p className="text-[0.78rem] text-[#8A9A94]" title={formatDateTimeFR(r.createdAt)}>{ago(r.createdAt, L)}</p>
        </div>
      </div>

      <div className="grid gap-1 rounded-xl bg-[#F7F9F8] px-3 py-2 text-[0.88rem]" dir="ltr">
        <span className="flex items-center gap-2"><Phone size={14} className="shrink-0 text-[#5A6B65]" /><span className="font-semibold tabular-nums">{r.phone}</span></span>
        <span className="flex min-w-0 items-center gap-2"><Mail size={14} className="shrink-0 text-[#5A6B65]" /><span className="truncate">{r.email}</span></span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <a className={contact} href={`tel:${r.phone.replace(/\s/g, '')}`}><Phone size={15} />{L('Appeler')}</a>
        <a className={contact} href={whatsappLink(r.phone)} target="_blank" rel="noreferrer"><MessageCircle size={15} />{L('WhatsApp')}</a>
        <a className={contact} href={`mailto:${r.email}`}><Mail size={15} />{L('Email')}</a>
      </div>

      {r.message && <p className="whitespace-pre-line border-s-[3px] border-[#D8E1DD] ps-3 text-[0.9rem] text-[#3F514A]">{r.message}</p>}

      {noteOpen || r.notes ? (
        <Textarea rows={2} autoFocus={noteOpen && !r.notes} aria-label={L('Notes internes')} placeholder={L('Notes internes (appel, besoins, rendez-vous de démonstration…)')} defaultValue={r.notes || ''}
          className="bg-[#FFFDF5]" onBlur={e => { setNoteOpen(false); if ((e.target.value || null) !== r.notes) onNotes(e.target.value || null) }} />
      ) : (
        <button type="button" className="justify-self-start text-[0.86rem] font-semibold text-primary" onClick={() => setNoteOpen(true)}>+ {L('Note interne')}</button>
      )}

      <div className="flex flex-wrap items-center gap-2 border-t border-[#E3EAE7] pt-3">
        {r.status === 'CONVERTED' && r.cabinetId
          ? <Button asChild size="sm" className="basis-full sm:basis-auto"><Link to={`/cabinets/${r.cabinetId}`}><Building2 size={15} className="me-1" />{L('Voir le cabinet')}</Link></Button>
          : <Button size="sm" className="basis-full sm:basis-auto" onClick={onCreate}><Building2 size={15} className="me-1" />{L('Créer le cabinet')}</Button>}
        {r.status === 'NEW' && <Button size="sm" variant="outline" disabled={busy} onClick={() => onStatus('CONTACTED')}>{L('Contactée')}</Button>}
        {r.status !== 'REJECTED' && r.status !== 'CONVERTED' && <Button size="sm" variant="ghost" className="text-[#5A6B65]" disabled={busy} onClick={() => onStatus('REJECTED')}>{L('Refuser')}</Button>}
        {r.status === 'REJECTED' && <Button size="sm" variant="ghost" onClick={() => onStatus('NEW')}>{L('Remettre en nouvelle')}</Button>}
        <Button size="icon" variant="ghost" className="ms-auto h-9 w-9 text-[#5A6B65] hover:text-[#B8372C]" aria-label={L('Supprimer')}
          onClick={() => { if (window.confirm(L('Supprimer cette demande ?'))) onDelete() }}><Trash2 size={16} /></Button>
      </div>
    </li>
  )
}
