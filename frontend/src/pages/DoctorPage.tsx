import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useMutation, useQuery } from '@tanstack/react-query'
import { format } from 'date-fns'
import { ArrowLeft, CalendarCheck, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock, Globe, Info, Loader2, MapPin, Map as MapIcon, MessageCircle, PenLine, Phone, ShieldCheck, UserRound, Wallet } from 'lucide-react'
import api from '../lib/api'
import { apiError } from '../lib/hooks'
import { useL } from '../lib/labels'
import { cn } from '../lib/utils'
import { BookingCabinet, BookingDoctor, doctorName, LANGUAGE_NAMES, reasonIcon, specialtyByCode, specialtyBySlug } from '../lib/booking'
import { Button } from '../components/ui/button'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import { BrandMark, SPECIALTY_ART, SpecialtyArt } from '../components/brand'
import { addDays, dayDate, useDateLocale } from './Booking'

type DoctorProfile = BookingDoctor & { specialty: string; bio: string | null; languages: string[]; consultationFee: number | null }
type Slot = { at: string; time: string }
type SlotDay = { day: string; times: Slot[] }
type Data = { cabinet: BookingCabinet; doctor: DoctorProfile; nextSlot: (Slot & { day: string }) | null; upcoming: SlotDay[] }
type Booked = { message: string; day: string; time: string; doctor: string; confirmed: boolean; firstName: string }

const GREEN = '#12705A'
const DAYS_SHOWN = 5
const TIMES_SHOWN = 9
const panel = 'rounded-[22px] bg-white shadow-[0_10px_30px_-22px_rgba(19,43,39,0.5)] ring-1 ring-[#E3EAE7]'
const emptyForm = { fullName: '', phone: '', comment: '', consent: false, website: '' }
/** The reason card for anything not in the list: the patient explains it in the comment. */
const OTHER = 'Autre motif'
const COMMENT_MAX = 500

/** "Salma El Idrissi" → first name "Salma", last name "El Idrissi". */
const splitName = (full: string) => {
  const words = full.trim().split(/\s+/).filter(Boolean)
  return { firstName: words[0] || '', lastName: words.slice(1).join(' ') }
}

function Page({ children }: { children: React.ReactNode }) {
  const L = useL()
  return (
    <div className="min-h-[100dvh] bg-[#EEF3F1] text-[#14231E]">
      <main className="mx-auto grid max-w-[620px] gap-3.5 px-3 pb-8 pt-3 sm:px-4 sm:pt-6">{children}</main>
      <footer className="flex items-center justify-center gap-2 pb-8 text-[0.82rem] text-[#5A6B65]">
        <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-primary text-white"><BrandMark size={14} /></span>
        {L('Cabinet Pro')} · <a href="/" className="hover:underline">{L('Vous êtes médecin ?')}</a>
      </footer>
    </div>
  )
}

/**
 * /rdv/<specialty>/<cabinet>/<doctor> (and …/reserver): the doctor's page, where the patient books in one go:
 * reason, day and time, name and phone, then a summary and one button.
 */
export default function DoctorPage() {
  const L = useL()
  const locale = useDateLocale()
  const { specialty: slug, cabinet: cabinetSlug, doctor: doctorSlug } = useParams()
  const [params] = useSearchParams()
  const { data, isLoading, isError } = useQuery({
    queryKey: ['booking-doctor', cabinetSlug, doctorSlug],
    queryFn: async () => (await api.get(`/public/booking/cabinets/${cabinetSlug}/doctors/${doctorSlug}`)).data.data as Data,
    retry: false,
  })

  const [reason, setReason] = useState('')
  // Pages of days: each page starts at `from` (null = today); `pages` keeps the previous starts for the back arrow.
  // A time chosen from an older link (?day=…&at=…&time=…) opens on its day.
  const askedDay = /^\d{4}-\d{2}-\d{2}$/.test(params.get('day') || '') ? params.get('day') : null
  const [from, setFrom] = useState<string | null>(askedDay && askedDay > format(new Date(), 'yyyy-MM-dd') ? askedDay : null)
  const [pages, setPages] = useState<(string | null)[]>([])
  const [day, setDay] = useState<string | null>(askedDay)
  const [time, setTime] = useState<Slot | null>(params.get('at') && params.get('time') ? { at: params.get('at')!, time: params.get('time')! } : null)
  const [allTimes, setAllTimes] = useState(false)
  const [form, setForm] = useState(emptyForm)
  const [done, setDone] = useState<Booked | null>(null)

  const doctorId = data?.doctor.id
  const slots = useQuery({
    queryKey: ['booking-slots', cabinetSlug, doctorId, from],
    queryFn: async () => (await api.get(`/public/booking/cabinets/${cabinetSlug}/slots`, { params: { doctorId, from: from || undefined, days: 14 } })).data.data as { days: SlotDay[]; lastDay: string },
    enabled: !!doctorId,
  })
  // Only days with free times are shown, five at a time.
  const days = useMemo(() => (slots.data?.days || []).filter(d => d.times.length).slice(0, DAYS_SHOWN), [slots.data])
  useEffect(() => {
    if (!slots.data) return
    if (!day || !days.some(d => d.day === day)) setDay(days[0]?.day || null)
    if (time && !days.some(d => d.times.some(t => t.at === time.at))) setTime(null)
  }, [slots.data]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (data) document.title = `${doctorName(data.doctor)} · ${L(specialtyByCode(data.doctor.specialty)?.doctor || '')}` }, [data, L])

  const name = splitName(form.fullName)
  const book = useMutation({
    mutationFn: async () => (await api.post(`/public/booking/cabinets/${cabinetSlug}/appointments`, {
      doctorId, date: time?.at, firstName: name.firstName, lastName: name.lastName, phone: form.phone, reason: reason ? L(reason) : null, comment: form.comment.trim() || null, consent: form.consent, website: form.website,
    })).data as { message: string; data: Omit<Booked, 'message' | 'firstName'> },
    onSuccess: (res) => { setDone({ message: res.message, ...res.data, firstName: name.firstName }); window.scrollTo({ top: 0, behavior: 'smooth' }) },
    onError: (err: any) => { if (err.response?.status === 409) { setTime(null); slots.refetch() } },
  })

  const listSpec = specialtyBySlug(slug)
  const backTo = listSpec ? `/rdv/${listSpec.slug}` : '/rdv'
  if (isLoading) return <Page><p className="p-6 text-center text-[#5A6B65]">{L('Chargement…')}</p></Page>
  if (isError || !data) {
    return (
      <Page>
        <div className={cn(panel, 'grid justify-items-center gap-3 p-8 text-center')}>
          <p className="text-lg font-bold">{L('Ce praticien ne prend pas de rendez-vous en ligne')}</p>
          <Button asChild variant="outline"><Link to="/rdv">{L('Voir toutes les spécialités')}</Link></Button>
        </div>
      </Page>
    )
  }

  const { cabinet, doctor } = data
  const spec = specialtyByCode(doctor.specialty)
  const art = SPECIALTY_ART[doctor.specialty] || SPECIALTY_ART.GENERAL
  const address = [cabinet.address, cabinet.city].filter(Boolean).join(', ')
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent([cabinet.name, address].filter(Boolean).join(', '))}`
  const tel = cabinet.phone ? `tel:${cabinet.phone.replace(/\s/g, '')}` : null
  const languages = doctor.languages.map(l => LANGUAGE_NAMES[l] || l)
  const capital = (text: string) => text.replace(/^./, c => c.toUpperCase())
  const selected = days.find(d => d.day === day)
  const shownTimes = selected ? (allTimes ? selected.times : selected.times.slice(0, TIMES_SHOWN)) : []
  const monthLabel = days[0] ? capital(format(dayDate(days[0].day), 'MMMM yyyy', { locale })) : ''
  const lastPage = !!slots.data && (slots.data.days.at(-1)?.day ?? '') >= slots.data.lastDay
  const nameOk = !!name.firstName && name.lastName.length >= 2 && name.firstName.length >= 2
  const missing = !time ? L('Choisissez une heure') : !nameOk ? L('Indiquez votre prénom et votre nom') : form.phone.replace(/\D/g, '').length < 9 ? L('Indiquez votre téléphone') : !form.consent ? L('Cochez l’accord en bas du formulaire') : null
  // "150 MAD" / "150 درهم", "30 min" / "30 دقيقة"
  const fee = doctor.consultationFee != null ? L('{n} MAD').replace('{n}', String(doctor.consultationFee)) : null
  const minutes = L('{n} min').replace('{n}', String(cabinet.slotMinutes))

  const goNext = () => { if (!days.length) return; setPages(p => [...p, from]); setFrom(addDays(days[days.length - 1].day, 1)); setDay(null); setAllTimes(false) }
  const goBack = () => { setFrom(pages[pages.length - 1] ?? null); setPages(p => p.slice(0, -1)); setDay(null); setAllTimes(false) }

  const stepHead = (n: number, title: string, hint: string) => (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.95rem] font-extrabold text-white" style={{ background: GREEN }}>{n}</span>
      <span><b className="block text-[1.12rem] leading-tight">{title}</b><span className="text-[0.84rem] text-[#7A8A84]">{hint}</span></span>
    </div>
  )

  // ─── Header: doctor, specialty, cabinet, languages ───
  const hero = (
    <section className="relative overflow-hidden rounded-[26px] bg-white px-5 pb-5 pt-4 shadow-[0_10px_30px_-22px_rgba(19,43,39,0.5)] ring-1 ring-[#E3EAE7]"
      style={{ backgroundImage: `radial-gradient(circle at 85% 0%, ${art.bg} 0%, transparent 55%), radial-gradient(circle at 0% 100%, ${art.bg} 0%, transparent 45%)` }}>
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-6 end-6 rotate-[-12deg] rounded-[40%] p-6 opacity-70" style={{ background: art.bg, color: art.ring }}><art.Icon size={64} strokeWidth={1.4} /></span>
      <div className="relative mb-3 flex items-center justify-between gap-2">
        <Link to={backTo} className="flex items-center gap-1.5 text-[0.95rem] font-bold text-primary"><ArrowLeft size={18} className="rtl:rotate-180" />{L('Retour')}</Link>
        <div className="flex items-center gap-2">
          <div className="w-[84px]"><LanguageSwitcher compact /></div>
          {data.nextSlot && <span className="flex items-center gap-1.5 rounded-full bg-[#E3F4EC] px-3 py-1.5 text-[0.85rem] font-bold text-primary"><i className="h-2 w-2 rounded-full bg-[#1E9E5A]" />{L('Disponible')}</span>}
        </div>
      </div>
      <div className="relative flex items-center gap-4">
        {doctor.avatar
          ? <img src={doctor.avatar} alt={doctorName(doctor)} className="h-[104px] w-[104px] shrink-0 rounded-full border-4 border-white object-cover shadow-[0_8px_24px_-10px_rgba(19,43,39,0.6)] sm:h-[120px] sm:w-[120px]" />
          : <span className="shrink-0 rounded-full border-4 border-white bg-white shadow-[0_8px_24px_-10px_rgba(19,43,39,0.6)]"><SpecialtyArt specialty={doctor.specialty} size="lg" className="!h-24 !w-24 sm:!h-28 sm:!w-28" /></span>}
        <div className="min-w-0 flex-1 space-y-1.5">
          <p className="text-[0.92rem] font-semibold" style={{ color: art.fg }}>• {L(spec?.doctor || '')}</p>
          <h1 className="text-[1.65rem] font-extrabold leading-tight sm:text-[1.9rem]">{doctorName(doctor)}</h1>
          <p className="flex items-start gap-1.5 text-[0.9rem] text-[#3F514A]"><MapPin size={16} className="mt-0.5 shrink-0" />{cabinet.name}{cabinet.city && !cabinet.name.includes(cabinet.city) ? ` · ${cabinet.city}` : ''}</p>
          {languages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-0.5">{languages.map(l => <span key={l} className="rounded-full bg-[#F1F4F3] px-2.5 py-1 text-[0.78rem] font-semibold text-[#3F514A]">{l}</span>)}</div>
          )}
        </div>
      </div>
    </section>
  )

  // ─── Three reassurances ───
  const perks = (
    <section className={cn(panel, 'grid grid-cols-3 divide-x divide-[#E3EAE7] rtl:divide-x-reverse')}>
      {([
        [<CalendarCheck size={19} />, L('Réservation gratuite'), L('Sans frais'), null],
        [<MessageCircle size={19} />, L('Rappel SMS / WhatsApp'), L('Avant votre rendez-vous'), null],
        [<Phone size={19} />, L('Appeler'), L('Réserver par téléphone'), tel],
      ] as [React.ReactNode, string, string, string | null][]).map(([icon, title, text, href]) => {
        const inner = (
          <>
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#E3F4EC] text-primary">{icon}</span>
            <span className="min-w-0"><b className="block text-[0.84rem] leading-tight sm:text-[0.92rem]">{title}</b><span className="text-[0.74rem] text-[#7A8A84] sm:text-[0.8rem]">{text}</span></span>
          </>
        )
        return href
          ? <a key={title} href={href} className="flex flex-col items-center gap-2 p-3 text-center sm:flex-row sm:text-start">{inner}</a>
          : <div key={title} className="flex flex-col items-center gap-2 p-3 text-center sm:flex-row sm:text-start">{inner}</div>
      })}
    </section>
  )

  if (done) {
    const colors = ['#F5B300', '#1E9E5A', '#2D6FA8', '#E0457B', '#8E5BD8', '#16A3A9']
    return (
      <Page>
        {hero}
        <div role="status" className="relative grid justify-items-center gap-4 overflow-hidden rounded-[26px] p-7 text-center sm:p-10"
          style={{ background: 'linear-gradient(160deg, #E3F4EC 0%, #FFFFFF 55%, #FFF1D6 100%)', boxShadow: 'inset 0 0 0 1px #BFE3CC' }}>
          <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-20">
            {Array.from({ length: 26 }, (_, i) => {
              const angle = (i / 26) * Math.PI * 2, dist = 110 + (i % 4) * 40
              return <i key={i} className="rdv-confetti" style={{ background: colors[i % colors.length], ['--dx' as string]: `${Math.cos(angle) * dist}px`, ['--dy' as string]: `${Math.sin(angle) * dist * 0.7}px`, ['--r' as string]: `${(i % 2 ? 1 : -1) * (180 + i * 20)}deg`, animationDelay: `${(i % 5) * 0.04}s` }} />
            })}
          </span>
          <span className="rdv-pop relative flex h-24 w-24 items-center justify-center rounded-full bg-primary text-white shadow-[0_16px_40px_-12px_rgba(18,112,90,0.7)]"><Check size={52} strokeWidth={3} /></span>
          <div className="relative space-y-1">
            <h2 className="text-[1.8rem] font-extrabold leading-tight">{done.firstName ? `${L('Merci')} ${done.firstName} !` : L('Merci !')}</h2>
            <p className="font-semibold text-[#3F514A]">{L(done.message)}</p>
          </div>
          <div className="relative grid w-full gap-2 rounded-2xl bg-white p-4 text-start shadow-[0_20px_50px_-30px_rgba(19,43,39,0.5)]">
            <p className="flex items-center gap-3"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#E3F4EC] text-primary"><CalendarCheck size={20} /></span>
              <span><b className="block text-[1.05rem]">{capital(format(dayDate(done.day), 'EEEE d MMMM yyyy', { locale }))}</b><span className="font-bold text-primary">{L('à')} {done.time}</span></span></p>
            <p className="border-t border-[#E3EAE7] pt-2 font-semibold">{done.doctor} · {cabinet.name}</p>
            {address && <p className="flex items-start gap-2 text-[0.9rem] text-[#5A6B65]"><MapPin size={16} className="mt-0.5 shrink-0" />{address}</p>}
          </div>
          {cabinet.phone && <p className="relative text-[0.9rem] text-[#5A6B65]">{L('Pour annuler ou déplacer, appelez le')} <a href={tel!} className="font-bold text-primary" dir="ltr">{cabinet.phone}</a></p>}
          <Button variant="outline" className="relative" onClick={() => { setDone(null); setTime(null); setForm(emptyForm); setReason(''); slots.refetch() }}>{L('Prendre un autre rendez-vous')}</Button>
        </div>
      </Page>
    )
  }

  return (
    <Page>
      {hero}
      {perks}

      {/* ─── 1. Reason ─── */}
      {spec && (
        <section className={cn(panel, 'grid gap-4 p-4 sm:p-5')}>
          {stepHead(1, L('Motif de la visite'), L('Choisissez le motif pour faciliter la réservation'))}
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3" role="radiogroup" aria-label={L('Motif de la visite')}>
            {spec.reasons.map(r => {
              const Icon = reasonIcon(r)
              const on = reason === r
              return (
                <button key={r} type="button" role="radio" aria-checked={on} onClick={() => setReason(on ? '' : r)}
                  className={cn('flex min-h-[62px] items-center gap-2.5 rounded-2xl border px-3 py-2 text-start text-[0.88rem] font-semibold leading-tight transition-all',
                    on ? 'border-primary bg-[#EAF5F0] ring-1 ring-primary' : 'border-transparent bg-[#F5F8F7] hover:border-[#BFD8CE]')}>
                  <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', on ? 'bg-white text-primary' : 'bg-white')} style={on ? undefined : { color: art.fg }}><Icon size={18} /></span>
                  {L(r)}
                </button>
              )
            })}
            <button type="button" role="radio" aria-checked={reason === OTHER} onClick={() => { setReason(reason === OTHER ? '' : OTHER); setTimeout(() => document.getElementById('b-comment')?.focus(), 50) }}
              className={cn('flex min-h-[62px] items-center gap-2.5 rounded-2xl border px-3 py-2 text-start text-[0.88rem] font-semibold leading-tight transition-all',
                reason === OTHER ? 'border-primary bg-[#EAF5F0] ring-1 ring-primary' : 'border-dashed border-[#BFD0C9] bg-white hover:border-primary')}>
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#F5F8F7]" style={{ color: art.fg }}><PenLine size={18} /></span>
              {L(OTHER)}
            </button>
          </div>
          <label className="grid gap-1.5">
            <span className="text-[0.9rem] font-bold">{reason === OTHER ? L('Précisez le motif de votre visite') : L('Un mot pour le médecin')} <span className="font-normal text-[#7A8A84]">({L('facultatif')})</span></span>
            <textarea id="b-comment" rows={reason === OTHER ? 3 : 2} maxLength={COMMENT_MAX} value={form.comment} onChange={e => setForm(f => ({ ...f, comment: e.target.value }))}
              placeholder={reason === OTHER ? L('ex. douleur au genou depuis une semaine, renouvellement d’un certificat…') : L('ex. première visite, résultats d’analyses à apporter…')}
              className="w-full resize-none rounded-2xl border border-[#D8E1DD] bg-white px-3.5 py-2.5 text-[0.95rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
            {form.comment.length > COMMENT_MAX - 100 && <span className="text-end text-[0.76rem] text-[#7A8A84]">{form.comment.length} / {COMMENT_MAX}</span>}
          </label>
        </section>
      )}

      {/* ─── 2. Day and time ─── */}
      <section id="b-times" className={cn(panel, 'grid scroll-mt-4 gap-4 p-4 sm:p-5')}>
        {stepHead(spec ? 2 : 1, L('Choisissez votre rendez-vous'), L('Choisissez le jour, puis l’heure qui vous convient'))}
        <div className="flex items-center justify-between">
          <button type="button" aria-label={L('Jours précédents')} disabled={!pages.length || slots.isFetching} onClick={goBack} className="rounded-full p-2 text-primary disabled:opacity-30"><ChevronLeft size={20} className="rtl:rotate-180" /></button>
          <b className="text-[1.05rem] text-primary">{monthLabel}</b>
          <button type="button" aria-label={L('Jours suivants')} disabled={lastPage || slots.isFetching || !days.length} onClick={goNext} className="rounded-full p-2 text-primary disabled:opacity-30"><ChevronRight size={20} className="rtl:rotate-180" /></button>
        </div>
        {slots.isLoading ? <p className="text-center text-[#5A6B65]">{L('Chargement…')}</p>
          : !days.length ? (
            <div className="grid justify-items-center gap-3 rounded-2xl bg-[#F5F8F7] p-5 text-center">
              <p className="font-semibold">{L('Pas de place libre sur ces jours')}</p>
              <div className="flex flex-wrap justify-center gap-2">
                {!lastPage && <Button variant="outline" onClick={goNext}>{L('Jours suivants')}</Button>}
                {tel && <Button asChild variant="outline"><a href={tel}><Phone size={16} className="me-1.5" />{L('Appeler le cabinet')}</a></Button>}
              </div>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-5 gap-2">
                {days.map(d => {
                  const on = d.day === day
                  return (
                    <button key={d.day} type="button" aria-pressed={on} onClick={() => { setDay(d.day); setAllTimes(false); if (time && !d.times.some(t => t.at === time.at)) setTime(null) }}
                      className={cn('grid justify-items-center gap-1 rounded-2xl py-2.5 leading-tight transition-all', on ? 'text-white shadow-md' : 'bg-[#F5F8F7] text-[#14231E] hover:bg-[#EAF2EF]')}
                      style={on ? { background: GREEN } : undefined}>
                      <span className={cn('text-[0.74rem] font-semibold', on ? 'text-white/90' : 'text-[#7A8A84]')}>{capital(format(dayDate(d.day), 'EEEE', { locale }))}</span>
                      <span className="text-[1.2rem] font-extrabold">{format(dayDate(d.day), 'd')}</span>
                    </button>
                  )
                })}
              </div>
              <div className="border-t border-[#E3EAE7]" />
              <p className="flex items-center gap-2 font-bold"><Clock size={19} className="text-primary" />{L('Heures disponibles')}</p>
              <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label={L('Heures disponibles')}>
                {shownTimes.map(slot => {
                  const on = time?.at === slot.at
                  return (
                    <button key={slot.at} type="button" role="radio" aria-checked={on} onClick={() => setTime(slot)}
                      className={cn('h-11 rounded-xl text-[0.98rem] font-bold tabular-nums transition-all', on ? 'text-white shadow-md' : 'bg-[#EEF3FB] text-[#2D5DAA] hover:bg-[#E1E9F7]')}
                      style={on ? { background: GREEN } : undefined}>{slot.time}</button>
                  )
                })}
              </div>
              {selected && selected.times.length > TIMES_SHOWN && (
                <button type="button" onClick={() => setAllTimes(v => !v)} className="flex h-11 items-center justify-center gap-2 rounded-xl bg-[#EAF5F0] text-[0.9rem] font-bold text-primary">
                  {allTimes ? L('Moins d’horaires') : L('Voir plus d’horaires')}<ChevronDown size={17} className={cn('transition-transform', allTimes && 'rotate-180')} />
                </button>
              )}
            </>
          )}
      </section>

      {/* ─── 3. Patient ─── */}
      <form id="b-form" className={cn(panel, 'grid gap-4 p-4 sm:p-5')} onSubmit={e => { e.preventDefault(); if (!missing) book.mutate() }}>
        {stepHead(spec ? 3 : 2, L('Vos informations'), L('Pour confirmer le rendez-vous'))}
        <label className="grid gap-1.5">
          <span className="text-[0.92rem] font-bold">{L('Nom complet')} <span className="text-[#E0457B]">*</span></span>
          <span className="relative">
            <UserRound size={19} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[#5A6B65]" />
            <input className="h-12 w-full rounded-2xl border border-[#D8E1DD] bg-white pe-3 ps-11 text-[1rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" autoComplete="name" required
              value={form.fullName} onChange={e => setForm(f => ({ ...f, fullName: e.target.value }))} placeholder={L('ex. Salma El Idrissi')} />
          </span>
        </label>
        <label className="grid gap-1.5">
          <span className="text-[0.92rem] font-bold">{L('Téléphone (WhatsApp)')} <span className="text-[#E0457B]">*</span></span>
          <span className="relative">
            <Phone size={19} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[#5A6B65]" />
            <input className="h-12 w-full rounded-2xl border border-[#D8E1DD] bg-white pe-3 ps-11 text-[1rem] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" type="tel" inputMode="tel" autoComplete="tel" required dir="ltr"
              value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="06 12 34 56 78" />
          </span>
        </label>
        {/* Honeypot: hidden from people, robots fill it. */}
        <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.website} onChange={e => setForm(f => ({ ...f, website: e.target.value }))} />
        <label className="flex cursor-pointer items-start gap-2.5 text-[0.8rem] text-[#5A6B65]">
          <input type="checkbox" className="mt-0.5 h-[18px] w-[18px] shrink-0 accent-[#12705A]" checked={form.consent} onChange={e => setForm(f => ({ ...f, consent: e.target.checked }))} />
          {L('J’accepte que le cabinet enregistre mes coordonnées et me contacte au sujet de ce rendez-vous (rappel par SMS ou WhatsApp, loi 09-08).')}
        </label>
      </form>

      {/* ─── Summary ─── */}
      {time && day && (
        <section className={cn(panel, 'flex items-center gap-3 p-4 sm:p-5')}>
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#E3F4EC] text-primary"><CalendarDays size={23} /></span>
          <div className="min-w-0 flex-1">
            <b className="block text-[1.05rem]">{L('Récapitulatif')}</b>
            <p className="text-[0.92rem] text-[#3F514A]">{capital(format(dayDate(day), 'EEEE d MMMM yyyy', { locale }))} · <b dir="ltr">{time.time}</b></p>
            <p className="text-[0.86rem] text-[#7A8A84]">{reason ? `${L(reason)} · ` : ''}{minutes}</p>
            {form.comment.trim() && <p className="mt-0.5 line-clamp-2 text-[0.84rem] italic text-[#5A6B65]">« {form.comment.trim()} »</p>}
          </div>
          {fee && <div className="shrink-0 rounded-2xl bg-[#E3F4EC] px-4 py-2.5 text-center"><b className="block text-[1.25rem] text-[#14231E]">{fee}</b><span className="text-[0.78rem] text-[#5A6B65]">{L('Prix')}</span></div>}
        </section>
      )}

      {/* ─── Address ─── */}
      <section className={cn(panel, 'grid gap-3 p-4 sm:grid-cols-[1fr_140px] sm:p-5')}>
        <div className="grid content-start gap-2">
          <b className="flex items-center gap-2"><MapPin size={18} className="text-primary" />{L('Adresse')}</b>
          <p className="text-[0.92rem]">{cabinet.name}</p>
          {address && <p className="text-[0.86rem] text-[#7A8A84]">{address}</p>}
          <div className="grid grid-cols-2 gap-2 pt-1">
            {tel && <a href={tel} className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#D8E1DD] text-[0.86rem] font-bold text-primary"><Phone size={15} /><span dir="ltr">{cabinet.phone}</span></a>}
            {address && <a href={mapUrl} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#D8E1DD] text-[0.86rem] font-bold text-primary"><MapIcon size={15} />{L('Voir sur la carte')}</a>}
          </div>
        </div>
        {address && (
          <a href={mapUrl} target="_blank" rel="noreferrer" aria-label={L('Voir sur la carte')} className="relative hidden h-full min-h-[110px] overflow-hidden rounded-2xl bg-[#E9EEEC] sm:block">
            {/* Drawn map (no third-party map is loaded on the page). */}
            <svg viewBox="0 0 140 110" className="absolute inset-0 h-full w-full" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
              <rect width="140" height="110" fill="#EEF2F0" />
              <path d="M-5 70 L60 40 L150 20" stroke="#fff" strokeWidth="9" fill="none" /><path d="M30 -5 L50 120" stroke="#fff" strokeWidth="7" fill="none" />
              <path d="M90 -5 L110 120" stroke="#fff" strokeWidth="5" fill="none" /><path d="M-5 95 L150 80" stroke="#fff" strokeWidth="4" fill="none" />
              <rect x="62" y="52" width="22" height="16" rx="3" fill="#DCE6E1" /><rect x="10" y="12" width="16" height="14" rx="3" fill="#DCE6E1" />
              <circle cx="118" cy="96" r="10" fill="#CFE0F3" />
            </svg>
            <span className="absolute left-1/2 top-[38%] -translate-x-1/2 -translate-y-1/2 text-primary drop-shadow"><MapPin size={30} fill="#12705A" color="#fff" /></span>
          </a>
        )}
      </section>

      {/* ─── Details ─── */}
      <section className={cn(panel, 'grid gap-3 p-4 sm:p-5')}>
        <b className="flex items-center gap-2"><Info size={18} className="text-primary" />{L('Détails du rendez-vous')}</b>
        <div className="grid grid-cols-3 gap-2 rounded-2xl bg-[#F5F8F7] p-3 text-center">
          <div className="grid justify-items-center gap-1"><Globe size={17} className="text-[#5A6B65]" /><b className="text-[0.8rem] leading-tight">{languages.join(', ') || '—'}</b><span className="text-[0.74rem] text-[#7A8A84]">{L('Langues parlées')}</span></div>
          <div className="grid justify-items-center gap-1"><Clock size={17} className="text-[#5A6B65]" /><b className="text-[0.8rem]">{minutes}</b><span className="text-[0.74rem] text-[#7A8A84]">{L('Durée')}</span></div>
          <div className="grid justify-items-center gap-1"><Wallet size={17} className="text-[#5A6B65]" /><b className="text-[0.8rem]">{fee || '—'}</b><span className="text-[0.74rem] text-[#7A8A84]">{L('Prix')}</span></div>
        </div>
        {doctor.bio && <p className="whitespace-pre-line pt-1 text-[0.9rem] leading-relaxed text-[#3F514A]">{doctor.bio}</p>}
      </section>

      {/* ─── Book ─── */}
      <div className="sticky bottom-0 z-10 -mx-3 grid gap-1.5 bg-gradient-to-t from-[#EEF3F1] via-[#EEF3F1] to-transparent px-3 pb-[calc(env(safe-area-inset-bottom,0px)+10px)] pt-4 sm:static sm:mx-0 sm:bg-none sm:p-0">
        {book.isError && <p role="alert" className="rounded-xl bg-[#FBE3E0] px-3 py-2 text-[0.88rem] font-semibold text-[#B8372C]">{L(apiError(book.error))}</p>}
        <button type="submit" form="b-form" disabled={book.isPending}
          onClick={e => { if (missing) { e.preventDefault(); document.getElementById(time ? 'b-form' : 'b-times')?.scrollIntoView({ behavior: 'smooth', block: 'center' }) } }}
          className={cn('flex h-14 items-center justify-center gap-2.5 rounded-2xl text-[1.08rem] font-extrabold text-white shadow-[0_14px_30px_-14px_rgba(18,112,90,0.9)] transition-opacity', missing && 'opacity-60')}
          style={{ background: GREEN }}>
          {book.isPending ? <Loader2 size={20} className="animate-spin" /> : <CalendarCheck size={20} />}{L('Réserver le rendez-vous')}
        </button>
        <p className="flex items-center justify-center gap-1.5 text-[0.8rem] text-[#7A8A84]">
          {missing ? <span className="font-semibold text-[#B8661B]">{missing}</span> : <><ShieldCheck size={15} />{L('Réservation sécurisée')}</>}
        </p>
      </div>
    </Page>
  )
}
