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
      <div role="tablist" className="flex flex-wrap gap-1.5">
        {(['NEW', 'CONTACTED', 'CONVERTED', 'REJECTED', 'ALL'] as const).map(s => (
          <button key={s} type="button" role="tab" aria-selected={status === s} onClick={() => setStatus(s)}
            className={cn('rounded-full px-3.5 py-1.5 text-[0.88rem] font-semibold', status === s ? 'bg-primary text-white' : 'bg-white text-[#3F514A] ring-1 ring-[#D8E1DD] hover:text-primary')}>
            {s === 'ALL' ? L('Toutes') : L(STATUS[s][0])}{counts && s !== 'ALL' ? <span className="ms-1.5 opacity-75">({counts[s]})</span> : null}
          </button>
        ))}
      </div>

      {isLoading ? <p className="text-[#5A6B65]">{L('Chargement…')}</p> : items.length === 0 ? (
        <p className="rounded-[14px] border border-dashed border-[#D8E1DD] bg-white p-8 text-center text-[#5A6B65]">{L('Aucune demande ici.')}</p>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {items.map(r => (
            <li key={r.id} className="grid gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[1.05rem] font-bold">{r.fullName}</p>
                  <p className="text-[0.86rem] text-[#5A6B65]">{[r.cabinetName, r.city, r.specialty && t(`specialty.${r.specialty}`), r.doctors && `${r.doctors} ${r.doctors > 1 ? L('praticiens') : L('praticien')}`].filter(Boolean).join(' · ') || '—'}</p>
                </div>
                <span className="flex shrink-0 flex-col items-end gap-1">
                  <span className={cn('rounded-full px-2.5 py-0.5 text-[0.78rem] font-bold', STATUS[r.status][1])}>{L(ONE[r.status])}</span>
                  <span className="text-[0.76rem] text-[#5A6B65]">{formatDateTimeFR(r.createdAt)}</span>
                </span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button asChild size="sm" variant="outline"><a href={`tel:${r.phone.replace(/\s/g, '')}`}><Phone size={14} className="me-1" />{r.phone}</a></Button>
                <Button asChild size="sm" variant="outline"><a href={whatsappLink(r.phone)} target="_blank" rel="noreferrer"><MessageCircle size={14} className="me-1" />{L('WhatsApp')}</a></Button>
                <Button asChild size="sm" variant="outline"><a href={`mailto:${r.email}`}><Mail size={14} className="me-1" />{r.email}</a></Button>
              </div>
              {r.message && <p className="whitespace-pre-line rounded-xl bg-[#F4F7F6] px-3 py-2 text-[0.9rem]">{r.message}</p>}
              <Textarea rows={2} aria-label={L('Notes internes')} placeholder={L('Notes internes (appel, besoins, rendez-vous de démonstration…)')} defaultValue={r.notes || ''}
                onBlur={e => { if ((e.target.value || null) !== r.notes) update.mutate({ id: r.id, notes: e.target.value || null }) }} />
              <div className="flex flex-wrap items-center gap-1.5">
                {r.status === 'CONVERTED' && r.cabinetId
                  ? <Button asChild size="sm"><Link to={`/cabinets/${r.cabinetId}`}><Building2 size={15} className="me-1" />{L('Voir le cabinet')}</Link></Button>
                  : <Button size="sm" onClick={() => createCabinet(r)}><Building2 size={15} className="me-1" />{L('Créer le cabinet')}</Button>}
                {r.status === 'NEW' && <Button size="sm" variant="outline" disabled={update.isPending} onClick={() => update.mutate({ id: r.id, status: 'CONTACTED' })}>{L('Marquer contactée')}</Button>}
                {r.status !== 'REJECTED' && r.status !== 'CONVERTED' && <Button size="sm" variant="ghost" disabled={update.isPending} onClick={() => update.mutate({ id: r.id, status: 'REJECTED' })}>{L('Refuser')}</Button>}
                {r.status === 'REJECTED' && <Button size="sm" variant="ghost" onClick={() => update.mutate({ id: r.id, status: 'NEW' })}>{L('Remettre en nouvelle')}</Button>}
                <Button size="icon" variant="ghost" className="ms-auto h-8 w-8 text-[#5A6B65] hover:text-[#B8372C]" aria-label={L('Supprimer')}
                  onClick={() => { if (window.confirm(L('Supprimer cette demande ?'))) remove.mutate(r.id) }}><Trash2 size={15} /></Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
