import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ar, enGB, fr } from 'date-fns/locale'
import { ArrowLeft, CalendarCheck, ChevronRight, MapPin, Phone, Search } from 'lucide-react'
import api from '../lib/api'
import { useL } from '../lib/labels'
import { cn } from '../lib/utils'
import { BOOKING_SPECIALTIES, BookingCabinet, doctorName, specialtyByCode, specialtyBySlug } from '../lib/booking'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import { BrandMark, SPECIALTY_ART, SpecialtyArt } from '../components/brand'


// Public online booking, no account: /rdv (specialties) → /rdv/dentiste (cabinets) → /rdv/dentiste/<cabinet> (slot + form).

export const card = 'rounded-[18px] border border-[#D8E1DD] bg-white'
export const WEEKDAYS = ['1', '2', '3', '4', '5', '6', '0']

export function useDateLocale() {
  const { i18n } = useTranslation()
  return i18n.language.startsWith('ar') ? ar : i18n.language.startsWith('en') ? enGB : fr
}

export function Shell({ children, back }: { children: React.ReactNode; back?: { to: string; label: string } }) {
  const L = useL()
  return (
    <div className="min-h-[100dvh] bg-[#F2F5F3] text-[#14231E]">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-10 border-b border-[#D8E1DD] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <Link to="/rdv" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white"><BrandMark size={20} /></span>
            <span className="leading-tight"><b className="block whitespace-nowrap text-[1.05rem] font-extrabold">{L('Cabinet Pro')}</b><span className="block text-[0.78rem] text-[#5A6B65]">{L('Rendez-vous en ligne')}</span></span>
          </Link>
          <div className="w-24"><LanguageSwitcher compact /></div>
        </div>
      </header>
      <main className="mx-auto grid max-w-5xl gap-5 px-4 py-6 sm:px-6 sm:py-8">
        {back && <Link to={back.to} className="flex w-fit items-center gap-1.5 text-[0.92rem] font-semibold text-primary hover:underline"><ArrowLeft size={16} className="rtl:rotate-180" />{back.label}</Link>}
        {children}
      </main>
      <footer className="border-t border-[#D8E1DD] px-4 py-6 text-center text-[0.86rem] text-[#5A6B65]">
        © {new Date().getFullYear()} {L('Cabinet Pro')} · <a href="/" className="hover:underline">{L('Vous êtes médecin ?')}</a>
      </footer>
    </div>
  )
}

export function NotFoundCard({ text }: { text: string }) {
  const L = useL()
  return (
    <div className={cn(card, 'grid justify-items-center gap-3 p-8 text-center')}>
      <p className="text-lg font-bold">{text}</p>
      <Button asChild variant="outline"><Link to="/rdv">{L('Voir toutes les spécialités')}</Link></Button>
    </div>
  )
}

/** /rdv: choose a specialty. */
export function BookingHome() {
  const L = useL()
  const { data: counts = [] } = useQuery({
    queryKey: ['booking-specialties'],
    queryFn: async () => (await api.get('/public/booking/specialties')).data.data as { code: string; cabinets: number }[],
  })
  useEffect(() => { document.title = `${L('Prendre rendez-vous en ligne')} · Cabinet Pro` }, [L])
  const count = (code: string) => counts.find(c => c.code === code)?.cabinets ?? 0
  return (
    <Shell>
      <div className="space-y-2">
        <h1 className="text-[1.9rem] font-extrabold leading-tight sm:text-[2.3rem]">{L('Prendre rendez-vous en ligne')}</h1>
        <p className="text-[#5A6B65]">{L('Choisissez la spécialité, puis le cabinet et l’heure qui vous conviennent. Gratuit, sans créer de compte.')}</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {BOOKING_SPECIALTIES.map(s => (
          <Link key={s.code} to={`/rdv/${s.slug}`} className={cn(card, 'flex items-center gap-3.5 p-4 transition-colors hover:border-primary')}>
            <SpecialtyArt specialty={s.code} size="md" />
            <span className="min-w-0">
              <b className="block text-[1.05rem]">{L(s.doctor)}</b>
              <span className="block text-[0.86rem] text-[#5A6B65]">{count(s.code) ? `${count(s.code)} ${L(count(s.code) > 1 ? 'cabinets' : 'cabinet')}` : L('Bientôt disponible')}</span>
            </span>
            <ChevronRight size={18} className="ms-auto shrink-0 text-[#5A6B65] rtl:rotate-180" />
          </Link>
        ))}
      </div>
    </Shell>
  )
}

/** /rdv/dentiste: the cabinets of a specialty, filtered by city. */
export function BookingList() {
  const L = useL()
  const { specialty: slug } = useParams()
  const spec = specialtyBySlug(slug)
  const [city, setCity] = useState('')
  const [search, setSearch] = useState('')
  const { data, isLoading } = useQuery({
    queryKey: ['booking-cabinets', spec?.code],
    queryFn: async () => (await api.get('/public/booking/cabinets', { params: { specialty: spec!.code } })).data.data as { cabinets: BookingCabinet[]; cities: string[] },
    enabled: !!spec,
  })
  useEffect(() => { if (spec) document.title = `${L(spec.doctor)} · ${L('Rendez-vous en ligne')}` }, [spec, L])
  if (!spec) return <Shell back={{ to: '/rdv', label: L('Toutes les spécialités') }}><NotFoundCard text={L('Spécialité introuvable')} /></Shell>

  const needle = search.trim().toLowerCase()
  const list = (data?.cabinets || []).filter(c => (!city || c.city?.trim() === city)
    && (!needle || [c.name, c.address, c.city, ...c.doctors.map(doctorName)].some(x => x?.toLowerCase().includes(needle))))
  return (
    <Shell back={{ to: '/rdv', label: L('Toutes les spécialités') }}>
      <div className="flex items-center gap-4">
        <SpecialtyArt specialty={spec.code} size="lg" />
        <div>
          <h1 className="text-[1.7rem] font-extrabold leading-tight sm:text-[2rem]">{L(spec.doctor)}</h1>
          <p className="text-[#5A6B65]">{L('Choisissez un cabinet pour voir les heures libres.')}</p>
        </div>
      </div>

      {(data?.cabinets.length ?? 0) > 3 && (
        <div className="relative">
          <Search size={18} className="pointer-events-none absolute start-3.5 top-1/2 -translate-y-1/2 text-[#5A6B65]" />
          <Input className="h-12 bg-white ps-10" value={search} onChange={e => setSearch(e.target.value)} placeholder={L('Nom du cabinet, du médecin ou quartier')} aria-label={L('Rechercher')} />
        </div>
      )}
      {(data?.cities.length ?? 0) > 1 && (
        <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={L('Ville')}>
          {['', ...data!.cities].map(c => (
            <button key={c || 'all'} type="button" role="radio" aria-checked={city === c} onClick={() => setCity(c)}
              className={cn('rounded-full border px-3.5 py-1.5 text-[0.9rem] font-semibold', city === c ? 'border-[#14231E] bg-[#14231E] text-white' : 'border-[#D8E1DD] bg-white text-[#5A6B65]')}>
              {c || L('Toutes les villes')}
            </button>
          ))}
        </div>
      )}

      {isLoading ? <p className="text-[#5A6B65]">{L('Chargement…')}</p>
        : list.length === 0 ? (
          <div className={cn(card, 'grid gap-1 p-8 text-center')}>
            <p className="text-lg font-bold">{L('Aucun cabinet ne prend de rendez-vous en ligne pour le moment.')}</p>
            <p className="text-[#5A6B65]">{L('Revenez bientôt, ou appelez directement votre cabinet.')}</p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {list.map(c => (
              <article key={c.slug} className={cn(card, 'grid gap-3 p-5')}>
                <div className="flex items-start gap-3">
                  {c.logo ? <img src={c.logo} alt="" className="h-12 w-12 shrink-0 rounded-xl object-contain" /> : <SpecialtyArt specialty={spec.code} size="md" />}
                  <div className="min-w-0">
                    <h2 className="text-[1.1rem] font-bold leading-snug">{c.name}</h2>
                    <p className="flex flex-wrap gap-x-2 text-[0.92rem] text-[#5A6B65]">
                      {c.doctors.map(d => <Link key={d.id} to={`/rdv/${spec.slug}/${c.slug}/${d.slug}`} className="hover:text-primary hover:underline">{doctorName(d)}</Link>)}
                    </p>
                  </div>
                </div>
                {(c.address || c.city) && <p className="flex items-start gap-2 text-[0.92rem]"><MapPin size={16} className="mt-0.5 shrink-0 text-primary" />{[c.address, c.city].filter(Boolean).join(', ')}</p>}
                <Button asChild className="h-11 w-full sm:w-fit"><Link to={`/rdv/${spec.slug}/${c.slug}`}><CalendarCheck size={17} className="me-2" />{L('Prendre rendez-vous')}</Link></Button>
              </article>
            ))}
          </div>
        )}
    </Shell>
  )
}

export const addDays = (day: string, n: number) => { const d = new Date(`${day}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10) }
export const dayDate = (day: string) => new Date(`${day}T12:00:00`)

/** /rdv/<specialty>/<cabinet>: the cabinet's doctors. Booking happens on each doctor's page (one doctor: straight there). */
export function BookingCabinetPage() {
  const L = useL()
  const { specialty: slug, cabinet: cabinetSlug } = useParams()
  const spec = specialtyBySlug(slug)
  const { data: cabinet, isLoading, isError } = useQuery({
    queryKey: ['booking-cabinet', cabinetSlug, spec?.code],
    queryFn: async () => (await api.get(`/public/booking/cabinets/${cabinetSlug}`, { params: { specialty: spec?.code } })).data.data as BookingCabinet,
    retry: false,
  })
  useEffect(() => { if (cabinet) document.title = `${cabinet.name} · ${L('Rendez-vous en ligne')}` }, [cabinet, L])

  const back = { to: spec ? `/rdv/${spec.slug}` : '/rdv', label: spec ? L(spec.doctor) : L('Toutes les spécialités') }
  if (isLoading) return <Shell back={back}><p className="text-[#5A6B65]">{L('Chargement…')}</p></Shell>
  if (isError || !cabinet) return <Shell back={back}><NotFoundCard text={L('Ce cabinet ne prend pas de rendez-vous en ligne')} /></Shell>

  const doctorUrl = (d: BookingCabinet['doctors'][number]) => `/rdv/${specialtyByCode(d.specialty || cabinet.specialty)?.slug || slug}/${cabinet.slug}/${d.slug}`
  if (cabinet.doctors.length === 1) return <Navigate to={doctorUrl(cabinet.doctors[0])} replace />

  const art = SPECIALTY_ART[spec?.code || cabinet.specialty] || SPECIALTY_ART.GENERAL
  const address = [cabinet.address, cabinet.city].filter(Boolean).join(', ')
  return (
    <Shell back={back}>
      <section className="relative overflow-hidden rounded-[24px] p-5 sm:p-6" style={{ background: `linear-gradient(135deg, ${art.bg} 0%, #FFFFFF 70%)`, boxShadow: `inset 0 0 0 1px ${art.ring}` }}>
        <div className="flex flex-wrap items-center gap-4">
          {cabinet.logo ? <img src={cabinet.logo} alt="" className="h-16 w-16 shrink-0 rounded-xl bg-white object-contain p-1 shadow-md" />
            : <span className="rounded-full border-4 border-white bg-white shadow-md"><SpecialtyArt specialty={spec?.code || cabinet.specialty} size="md" className="!h-14 !w-14" /></span>}
          <div className="min-w-0 flex-1 space-y-1">
            <h1 className="text-[1.5rem] font-extrabold leading-tight sm:text-[1.8rem]">{cabinet.name}</h1>
            {address && <p className="flex items-start gap-1.5 text-[0.9rem] text-[#5A6B65]"><MapPin size={15} className="mt-0.5 shrink-0" />{address}</p>}
            {cabinet.phone && <a href={`tel:${cabinet.phone.replace(/\s/g, '')}`} className="flex w-fit items-center gap-1.5 text-[0.9rem] font-semibold text-primary"><Phone size={15} /><span dir="ltr">{cabinet.phone}</span></a>}
          </div>
        </div>
      </section>
      <h2 className="text-[1.15rem] font-bold">{L('Choisissez le praticien')}</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        {cabinet.doctors.map(d => (
          <Link key={d.id} to={doctorUrl(d)} className={cn(card, 'flex items-center gap-3 rounded-[20px] p-4 transition-all hover:-translate-y-0.5 hover:border-primary hover:shadow-md')}>
            {d.avatar ? <img src={d.avatar} alt="" className="h-14 w-14 rounded-full object-cover" /> : <SpecialtyArt specialty={d.specialty || cabinet.specialty} size="md" className="!h-14 !w-14" />}
            <span className="min-w-0 flex-1"><b className="block leading-tight">{doctorName(d)}</b><span className="text-[0.86rem] text-[#5A6B65]">{L(specialtyByCode(d.specialty || cabinet.specialty)?.doctor || '')}</span></span>
            <span className="flex items-center gap-1 text-[0.86rem] font-bold text-primary"><CalendarCheck size={16} />{L('Prendre rendez-vous')}<ChevronRight size={16} className="rtl:rotate-180" /></span>
          </Link>
        ))}
      </div>
    </Shell>
  )
}
