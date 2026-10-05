import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Pencil, Plus, X } from 'lucide-react'
import { format } from 'date-fns'
import { ar, enGB, fr } from 'date-fns/locale'
import api from '../../lib/api'
import { apiError } from '../../lib/hooks'
import { useL } from '../../lib/labels'
import { cn } from '../../lib/utils'
import { BookingDoctor, BookingHours, doctorName, specialtyByCode } from '../../lib/booking'
import { Cabinet } from '../../types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { SpecialtyArt } from '../brand'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog'
import { DoctorProfileForm } from './DoctorProfileForm'
import { LinkRow } from './LinkRow'

const WEEKDAYS = ['1', '2', '3', '4', '5', '6', '0']
/** New range after the day's last one: from its end (at least 15:00 after a morning) for 3 hours, never past 23:00. */
const nextRange = (ranges: string[]) => {
  if (!ranges.length) return '09:00-13:00'
  const lastEnd = [...ranges].sort().pop()!.slice(6)
  const start = Math.max(Number(lastEnd.slice(0, 2)) + (Number(lastEnd.slice(3)) ? 1 : 0), lastEnd <= '13:00' ? 15 : 0)
  const from = Math.min(start, 22), to = Math.min(from + 3, 23)
  return `${String(from).padStart(2, '0')}:00-${String(to).padStart(2, '0')}:00`
}
const SLOTS = [15, 20, 30, 45, 60]

function Switch({ on, onChange, label }: { on: boolean; onChange: (on: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
      className={cn('relative h-7 w-12 shrink-0 rounded-full transition-colors', on ? 'bg-primary' : 'bg-[#D8E1DD]')}>
      <span className={cn('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', on ? 'start-6' : 'start-1')} />
    </button>
  )
}

type BookingLinks = { enabled: boolean; slug: string | null; specialty: string; doctors: (BookingDoctor & { specialty: string; slug: string })[] }

/** Owner (and Super Admin, on the cabinet's page): online booking by patients on the public page /rdv/<specialty>/<address>. */
export function OnlineBookingCard({ cabinet }: { cabinet: Cabinet }) {
  const L = useL()
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith('ar') ? ar : i18n.language.startsWith('en') ? enGB : fr
  const queryClient = useQueryClient()
  const [slug, setSlug] = useState(cabinet.bookingSlug || '')
  const [hours, setHours] = useState<BookingHours>(cabinet.bookingHours || {})
  const [editing, setEditing] = useState<BookingDoctor | null>(null)
  useEffect(() => { setSlug(cabinet.bookingSlug || ''); setHours(cabinet.bookingHours || {}) }, [cabinet.bookingSlug, cabinet.bookingHours])

  const save = useMutation({
    mutationFn: (payload: Partial<Cabinet>) => api.patch(`/cabinets/${cabinet.id}`, payload),
    onSuccess: () => {
      toast.success(L('Réservation en ligne enregistrée'))
      queryClient.invalidateQueries({ queryKey: ['cabinet', cabinet.id] })
      queryClient.invalidateQueries({ queryKey: ['booking-links', cabinet.id] })
    },
    onError: (err) => toast.error(L(apiError(err))),
  })

  const { data: links } = useQuery({
    queryKey: ['booking-links', cabinet.id],
    queryFn: async () => (await api.get(`/cabinets/${cabinet.id}/booking-links`)).data.data as BookingLinks,
    enabled: !!cabinet.bookingEnabled,
  })
  const page = (specialty: string) => `${window.location.origin}/rdv/${specialtyByCode(specialty)?.slug || 'medecin-generaliste'}/${cabinet.bookingSlug}`
  const link = cabinet.bookingSlug ? page(cabinet.specialty) : ''
  const enabled = !!cabinet.bookingEnabled
  const dayName = (d: string) => format(new Date(2026, 9, 4 + Number(d)), 'EEEE', { locale }).replace(/^./, c => c.toUpperCase())
  const setRange = (d: string, i: number, part: 0 | 1, value: string) => setHours(h => ({
    ...h, [d]: (h[d] || []).map((r, j) => { if (j !== i) return r; const p = r.split('-'); p[part] = value; return p.join('-') }),
  }))
  const hoursChanged = JSON.stringify(hours) !== JSON.stringify(cabinet.bookingHours || {})

  return (
    <div className="space-y-4">
      <section className="space-y-4 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
        <div className="flex items-center justify-between gap-4 rounded-2xl bg-[#F2F5F3] p-4">
          <span>
            <b className="block">{L('Accepter les rendez-vous en ligne')}</b>
            <span className="text-[0.88rem] text-[#5A6B65]">{L('Vos patients choisissent une heure libre sur votre page, 24 h/24, sans appeler.')}</span>
          </span>
          <Switch on={enabled} onChange={on => save.mutate({ bookingEnabled: on })} label={L('Accepter les rendez-vous en ligne')} />
        </div>

        {enabled && link && (
          <div className="space-y-2">
            <form className="flex flex-wrap items-end gap-2" onSubmit={e => { e.preventDefault(); if (slug !== cabinet.bookingSlug) save.mutate({ bookingSlug: slug }) }}>
              <div className="min-w-[200px] flex-1 space-y-1.5">
                <Label htmlFor="ob-slug">{L('Fin de l’adresse')}</Label>
                <Input id="ob-slug" value={slug} onChange={e => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} dir="ltr" minLength={3} maxLength={50} />
              </div>
              <Button type="submit" variant="outline" disabled={slug === cabinet.bookingSlug || save.isPending}>{L('Changer l’adresse')}</Button>
            </form>
          </div>
        )}
      </section>

      {enabled && link && !!links?.doctors.length && (
        <section className="space-y-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
          <div>
            <h3 className="font-bold">{L('Lien de réservation')}</h3>
            <p className="text-[0.86rem] text-[#5A6B65]">{L('Partagez-le sur Google Maps, Instagram, Facebook ou WhatsApp : le patient arrive directement sur l’agenda du médecin.')}</p>
          </div>
          <div className="grid gap-3">
            {links.doctors.map(d => (
              <div key={d.id} className="grid gap-2 border-t border-[#E3EAE7] pt-3 first:border-t-0 first:pt-0">
                <div className="flex flex-wrap items-center gap-2.5">
                  {d.avatar ? <img src={d.avatar} alt="" className="h-[34px] w-[34px] rounded-full object-cover" /> : <SpecialtyArt specialty={d.specialty} />}
                  <span><b className="block leading-tight">{doctorName(d)}</b><span className="text-[0.84rem] text-[#5A6B65]">{L(specialtyByCode(d.specialty)?.doctor || '')}</span></span>
                  <Button type="button" size="sm" variant="ghost" className="ms-auto" onClick={() => setEditing(d)}><Pencil size={15} className="me-1.5" />{L('Modifier la fiche')}</Button>
                </div>
                <LinkRow link={`${page(d.specialty)}/${d.slug}`} label={doctorName(d)} />
              </div>
            ))}
          </div>
        </section>
      )}

      <Dialog open={editing !== null} onOpenChange={open => !open && setEditing(null)}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
          <DialogHeader><DialogTitle>{editing ? `${L('Page publique')} · ${doctorName(editing)}` : ''}</DialogTitle></DialogHeader>
          {editing && <DoctorProfileForm userId={editing.id} onSaved={() => { setEditing(null); queryClient.invalidateQueries({ queryKey: ['booking-links', cabinet.id] }) }} />}
        </DialogContent>
      </Dialog>

      <section className={cn('space-y-4 rounded-[14px] border border-[#D8E1DD] bg-white p-4', !enabled && 'opacity-60')}>
        <div className="space-y-2">
          <h3 className="font-bold">{L('Quand un patient réserve')}</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            {[
              [false, L('Je confirme chaque demande'), L('Le rendez-vous arrive « À confirmer » dans Aujourd’hui. Vous appelez le patient puis vous confirmez.')],
              [true, L('Confirmé automatiquement'), L('Le rendez-vous est directement dans l’agenda, sans action de votre part.')],
            ].map(([value, title, text]) => (
              <button key={String(value)} type="button" aria-pressed={cabinet.bookingAutoConfirm === value} onClick={() => save.mutate({ bookingAutoConfirm: value as boolean })}
                className={cn('grid gap-0.5 rounded-xl border p-3 text-start', cabinet.bookingAutoConfirm === value ? 'border-primary bg-[#EAF5F0] ring-1 ring-primary' : 'border-[#D8E1DD] hover:border-primary')}>
                <b>{title}</b><span className="text-[0.86rem] text-[#5A6B65]">{text}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="space-y-2">
          <h3 className="font-bold">{L('Durée d’un rendez-vous')}</h3>
          <div className="flex flex-wrap gap-2">
            {SLOTS.map(n => (
              <button key={n} type="button" aria-pressed={cabinet.bookingSlotMinutes === n} onClick={() => save.mutate({ bookingSlotMinutes: n })}
                className={cn('rounded-xl border px-3.5 py-2 text-sm font-semibold', cabinet.bookingSlotMinutes === n ? 'border-primary bg-accent text-primary' : 'border-border')}>{n} min</button>
            ))}
          </div>
        </div>
      </section>

      <section className={cn('space-y-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4', !enabled && 'opacity-60')}>
        <div>
          <h3 className="font-bold">{L('Horaires d’ouverture')}</h3>
          <p className="text-[0.86rem] text-[#5A6B65]">{L('Seules ces heures sont proposées aux patients. Les congés et absences de l’agenda sont retirés automatiquement.')}</p>
        </div>
        <div className="grid gap-2">
          {WEEKDAYS.map(d => {
            const ranges = hours[d] || []
            return (
              <div key={d} className="flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-[#E3EAE7] pt-2 first:border-t-0 first:pt-0">
                <div className="flex w-36 items-center gap-2.5">
                  <Switch on={ranges.length > 0} onChange={on => setHours(h => ({ ...h, [d]: on ? ['09:00-13:00'] : [] }))} label={dayName(d)} />
                  <span className="font-semibold">{dayName(d)}</span>
                </div>
                {ranges.length === 0 ? <span className="text-[0.9rem] text-[#5A6B65]">{L('Fermé')}</span> : (
                  <div className="flex flex-wrap items-center gap-2">
                    {ranges.map((r, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-xl bg-[#F4F7F6] p-1" dir="ltr">
                        <input type="time" aria-label={L('Début')} className="h-9 rounded-lg border border-[#D8E1DD] bg-white px-2 text-sm" value={r.split('-')[0]} onChange={e => setRange(d, i, 0, e.target.value)} />
                        <span>–</span>
                        <input type="time" aria-label={L('Fin')} className="h-9 rounded-lg border border-[#D8E1DD] bg-white px-2 text-sm" value={r.split('-')[1]} onChange={e => setRange(d, i, 1, e.target.value)} />
                        <button type="button" aria-label={L('Retirer')} className="rounded-lg p-1.5 text-[#5A6B65] hover:bg-white" onClick={() => setHours(h => ({ ...h, [d]: ranges.filter((_, j) => j !== i) }))}><X size={15} /></button>
                      </span>
                    ))}
                    {ranges.length < 3 && (
                      <Button type="button" size="sm" variant="ghost" onClick={() => setHours(h => ({ ...h, [d]: [...ranges, nextRange(ranges)] }))}>
                        <Plus size={15} className="me-1" />{L('Plage')}
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" disabled={!hoursChanged || save.isPending} onClick={() => save.mutate({ bookingHours: hours })}>{L('Enregistrer les horaires')}</Button>
          {hoursChanged && <Button type="button" variant="ghost" onClick={() => setHours(cabinet.bookingHours || {})}>{L('Annuler')}</Button>}
        </div>
      </section>
    </div>
  )
}
