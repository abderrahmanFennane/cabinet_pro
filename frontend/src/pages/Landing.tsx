import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, CheckCircle2, FileText, HeartPulse, Loader2, MessageCircle, ShieldCheck, Smartphone, Stethoscope, Wallet } from 'lucide-react'
import api from '../lib/api'
import { apiError } from '../lib/hooks'
import { useL } from '../lib/labels'
import { cn } from '../lib/utils'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import { BrandMark, SpecialtyArt } from '../components/brand'

const SPECIALTIES = ['GENERAL', 'DENTISTRY', 'PEDIATRICS', 'GYNECOLOGY', 'OPHTHALMOLOGY', 'CARDIOLOGY', 'DERMATOLOGY', 'PHYSIOTHERAPY', 'PSYCHIATRY']
const FEATURES: [React.ReactNode, string, string][] = [
  [<CalendarCheck size={22} />, 'Agenda et salle d’attente', 'Rendez-vous par praticien, patients sans rendez-vous, congés, couleurs par type de visite.'],
  [<MessageCircle size={22} />, 'Rappels WhatsApp et SMS', 'Moins de rendez-vous oubliés : le patient reçoit un rappel automatique.'],
  [<Stethoscope size={22} />, 'Dossier de votre spécialité', 'Schéma dentaire, courbes de croissance, suivi de grossesse, examens ophtalmologiques et cardiologiques…'],
  [<FileText size={22} />, 'Ordonnances et certificats', 'Ordonnances types, liste des médicaments, certificats prêts à imprimer ou à envoyer.'],
  [<Wallet size={22} />, 'Facturation et caisse', 'Encaissement en un clic, devis, impayés, feuille de soins CNSS / AMO, clôture de caisse.'],
  [<ShieldCheck size={22} />, 'Données protégées', 'Données médicales chiffrées, double authentification, conforme à la loi 09-08 (CNDP).'],
]
const empty = { fullName: '', email: '', phone: '', cabinetName: '', city: '', specialty: '', doctors: '', message: '', consent: false, website: '' }

/** Public home page: what the software does, and the trial request form (handled by the Super Admin). */
export default function Landing() {
  const L = useL()
  const { t } = useTranslation()
  const [form, setForm] = useState(empty)
  const [sent, setSent] = useState<string | null>(null)
  const set = (k: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [k]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))
  const send = useMutation({
    mutationFn: async () => (await api.post('/public/trial-requests', {
      ...form, specialty: form.specialty || null, doctors: form.doctors ? Number(form.doctors) : null,
      cabinetName: form.cabinetName || null, city: form.city || null, message: form.message || null,
    })).data as { message: string },
    onSuccess: (res) => { setSent(L(res.message)); setForm(empty) },
  })

  return (
    <div className="min-h-[100dvh] bg-[#F2F5F3] text-[#14231E]">
      <header className="sticky top-[env(safe-area-inset-top,0px)] z-10 border-b border-[#D8E1DD] bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white"><BrandMark size={20} /></span>
            <span className="whitespace-nowrap text-lg font-extrabold">{L('Cabinet Pro')}</span>
          </a>
          <div className="flex items-center gap-2">
            <a href="/rdv" className="hidden whitespace-nowrap text-[0.9rem] font-semibold text-primary hover:underline sm:inline">{L('Patients : prendre rendez-vous')}</a>
            <div className="w-24"><LanguageSwitcher compact /></div>
            <Button asChild size="sm"><a href="#essai">{L('Essai gratuit')}</a></Button>
          </div>
        </div>
      </header>

      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1.1fr_1fr] lg:py-20">
          <div className="space-y-5">
            <p className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-primary">{L('Logiciel de gestion de cabinet médical au Maroc')}</p>
            <h1 className="text-[2.2rem] font-extrabold leading-[1.1] sm:text-[2.8rem]">{L('Votre cabinet, simple et organisé, du rendez-vous à l’encaissement.')}</h1>
            <p className="text-lg text-[#5A6B65]">{L('Agenda, dossiers patients de votre spécialité, ordonnances, facturation et rappels WhatsApp, en français, arabe et anglais, sur ordinateur, tablette et téléphone.')}</p>
            <div className="flex flex-wrap gap-2">
              <Button asChild size="lg"><a href="#essai">{L('Demander un essai gratuit')}</a></Button>
              <Button asChild size="lg" variant="outline"><a href="#fonctions">{L('Voir les fonctions')}</a></Button>
            </div>
            <p className="flex items-center gap-2 text-[0.9rem] text-[#5A6B65]"><Smartphone size={16} />{L('Sans installation : tout se fait dans le navigateur.')}</p>
          </div>
          <div className="grid gap-3 rounded-[22px] border border-[#D8E1DD] bg-white p-6 shadow-[0_30px_60px_-40px_rgba(19,43,39,0.45)]">
            <p className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{L('Pour toutes les spécialités')}</p>
            <div className="flex flex-wrap gap-2">
              {SPECIALTIES.map(s => <span key={s} className="inline-flex items-center gap-2 rounded-full bg-[#F4F7F6] py-1 pe-3 ps-1 text-[0.88rem] font-semibold text-[#14231E]"><SpecialtyArt specialty={s} className="!h-7 !w-7" />{t(`specialty.${s}`)}</span>)}
            </div>
            <ul className="mt-2 grid gap-2.5 text-[0.95rem]">
              {[L('Une visite complète en 5 clics : consultation, ordonnance, paiement'), L('Vos actes et vos tarifs, modifiables à tout moment'), L('Plusieurs praticiens et une secrétaire dans le même cabinet')].map(x => (
                <li key={x} className="flex items-start gap-2.5"><HeartPulse size={18} className="mt-0.5 shrink-0 text-primary" />{x}</li>
              ))}
            </ul>
          </div>
        </section>

        <section id="fonctions" className="mx-auto max-w-6xl scroll-mt-20 px-4 pb-14 sm:px-6">
          <h2 className="mb-6 text-[1.6rem] font-extrabold">{L('Tout ce dont votre cabinet a besoin')}</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(([icon, title, text]) => (
              <div key={title} className="grid gap-2 rounded-[16px] border border-[#D8E1DD] bg-white p-5">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#DCEEE7] text-primary">{icon}</span>
                <h3 className="text-[1.05rem] font-bold">{L(title)}</h3>
                <p className="text-[0.92rem] text-[#5A6B65]">{L(text)}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="essai" className="scroll-mt-16 border-t border-[#D8E1DD] bg-gradient-to-b from-white to-[#F2F5F3]">
          <div className="mx-auto grid max-w-6xl items-start gap-8 px-4 py-12 sm:px-6 sm:py-16 lg:grid-cols-[0.9fr_1.1fr] lg:gap-12">
            {/* What happens after sending: stays in view next to the form on large screens. */}
            <div className="grid gap-5 lg:sticky lg:top-24">
              <div className="space-y-3">
                <h2 className="text-[1.65rem] font-extrabold leading-tight sm:text-[2rem]">{L('Demandez votre essai gratuit')}</h2>
                <p className="text-[#5A6B65]">{L('Laissez vos coordonnées : nous vous appelons pour comprendre votre cabinet, puis nous ouvrons votre compte d’essai avec vos actes et vos tarifs.')}</p>
              </div>
              <ol className="grid gap-3">
                {[
                  [L('Envoyez la demande'), L('Une minute : vos coordonnées et votre spécialité.')],
                  [L('Nous vous appelons'), L('Pour comprendre votre cabinet et répondre à vos questions.')],
                  [L('Votre cabinet est prêt'), L('Compte d’essai ouvert avec vos actes et vos tarifs.')],
                ].map(([title, text], i) => (
                  <li key={title} className="flex gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-3.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-[0.9rem] font-bold text-white">{i + 1}</span>
                    <span><b className="block">{title}</b><span className="text-[0.9rem] text-[#5A6B65]">{text}</span></span>
                  </li>
                ))}
              </ol>
              <ul className="grid gap-2 text-[0.92rem]">
                {[L('Sans engagement, sans carte bancaire'), L('Données médicales chiffrées et protégées')].map(x => (
                  <li key={x} className="flex items-start gap-2.5"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-primary" />{x}</li>
                ))}
              </ul>
            </div>

            {sent ? (
              <div role="status" className="grid content-center justify-items-center gap-3 rounded-[20px] border border-[#BFE3CC] bg-white p-8 text-center shadow-[0_24px_50px_-36px_rgba(19,43,39,0.45)] sm:p-12">
                <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#DFF1E6]"><CheckCircle2 size={36} className="text-primary" /></span>
                <p className="max-w-sm text-lg font-bold">{sent}</p>
                <Button variant="outline" onClick={() => setSent(null)}>{L('Envoyer une autre demande')}</Button>
              </div>
            ) : (
              <form className="grid gap-5 rounded-[20px] border border-[#D8E1DD] bg-white p-4 shadow-[0_24px_50px_-36px_rgba(19,43,39,0.45)] sm:p-7" onSubmit={e => { e.preventDefault(); send.mutate() }}>
                <fieldset className="grid gap-3 sm:grid-cols-2">
                  <legend className="mb-3 flex w-full items-baseline justify-between gap-2 text-[1.05rem] font-bold">{L('Vos coordonnées')}<span className="text-[0.78rem] font-normal text-[#5A6B65]">* {L('obligatoire')}</span></legend>
                  <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="tr-name">{L('Nom complet')} *</Label><Input id="tr-name" className="h-12" autoComplete="name" required minLength={3} value={form.fullName} onChange={set('fullName')} placeholder={L('ex. Dr Karima Alaoui')} /></div>
                  <div className="space-y-1.5"><Label htmlFor="tr-phone">{L('Téléphone (WhatsApp)')} *</Label><Input id="tr-phone" className="h-12" type="tel" inputMode="tel" autoComplete="tel" required value={form.phone} onChange={set('phone')} placeholder="06 12 34 56 78" dir="ltr" /></div>
                  <div className="space-y-1.5"><Label htmlFor="tr-email">{L('Email')} *</Label><Input id="tr-email" className="h-12" type="email" inputMode="email" autoComplete="email" required value={form.email} onChange={set('email')} placeholder="nom@exemple.ma" dir="ltr" /></div>
                </fieldset>

                <fieldset className="grid gap-3 border-t border-[#E3EAE7] pt-5 sm:grid-cols-2">
                  <legend className="sr-only">{L('Votre cabinet')}</legend>
                  <p className="text-[1.05rem] font-bold sm:col-span-2">{L('Votre cabinet')} <span className="text-[0.78rem] font-normal text-[#5A6B65]">({L('facultatif')})</span></p>
                  <div className="space-y-1.5"><Label htmlFor="tr-cab">{L('Nom du cabinet')}</Label><Input id="tr-cab" className="h-12" autoComplete="organization" value={form.cabinetName} onChange={set('cabinetName')} /></div>
                  <div className="space-y-1.5"><Label htmlFor="tr-city">{L('Ville')}</Label><Input id="tr-city" className="h-12" autoComplete="address-level2" value={form.city} onChange={set('city')} /></div>
                  <div className="space-y-2 sm:col-span-2" role="radiogroup" aria-label={L('Spécialité')}>
                    <span className="text-sm font-medium">{L('Spécialité')}</span>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                      {SPECIALTIES.map(sp => {
                        const on = form.specialty === sp
                        return (
                          <button key={sp} type="button" role="radio" aria-checked={on} onClick={() => setForm(f => ({ ...f, specialty: on ? '' : sp }))}
                            className={cn('flex min-h-[52px] items-center gap-2.5 rounded-xl border px-2.5 py-2 text-start text-[0.86rem] font-semibold leading-tight transition-colors',
                              on ? 'border-primary bg-[#EAF5F0] ring-1 ring-primary' : 'border-[#D8E1DD] bg-white hover:border-primary')}>
                            <SpecialtyArt specialty={sp} className="!h-8 !w-8" />{t(`specialty.${sp}`)}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="space-y-2 sm:col-span-2" role="radiogroup" aria-label={L('Nombre de praticiens')}>
                    <span className="text-sm font-medium">{L('Nombre de praticiens')}</span>
                    <div className="grid grid-cols-5 gap-2 sm:max-w-sm">
                      {['1', '2', '3', '4', '5'].map(n => {
                        const on = form.doctors === n
                        return (
                          <button key={n} type="button" role="radio" aria-checked={on} onClick={() => setForm(f => ({ ...f, doctors: on ? '' : n }))}
                            className={cn('h-11 rounded-xl border text-[0.95rem] font-bold', on ? 'border-primary bg-primary text-white' : 'border-[#D8E1DD] bg-white hover:border-primary')}>
                            {n === '5' ? '5+' : n}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                  <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="tr-msg">{L('Votre besoin')}</Label><Textarea id="tr-msg" rows={3} value={form.message} onChange={set('message')} placeholder={L('ex. agenda pour 2 médecins et une secrétaire, rappels WhatsApp…')} /></div>
                </fieldset>

                {/* Honeypot: hidden from people, robots fill it. */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.website} onChange={set('website')} />
                <label className="flex cursor-pointer items-start gap-3 rounded-xl bg-[#F4F7F6] p-3 text-[0.88rem]">
                  <input type="checkbox" className="mt-0.5 h-5 w-5 shrink-0 accent-[#12705A]" required checked={form.consent} onChange={set('consent')} />
                  {L('J’accepte d’être contacté au sujet de ma demande. Mes coordonnées ne servent qu’à cela (loi 09-08).')}
                </label>
                {send.isError && <p role="alert" className="rounded-xl bg-[#FBE3E0] px-3 py-2 text-[0.9rem] font-semibold text-[#B8372C]">{apiError(send.error)}</p>}
                <Button type="submit" size="lg" className="h-12 w-full text-base" disabled={send.isPending}>
                  {send.isPending ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : null}{L('Envoyer ma demande')}
                </Button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#D8E1DD] px-4 py-6 text-center text-[0.86rem] text-[#5A6B65]">
        © {new Date().getFullYear()} {L('Cabinet Pro')} · {L('Logiciel de gestion de cabinet médical')} · <a href="/rdv" className="font-semibold text-primary hover:underline">{L('Prendre rendez-vous en ligne')}</a>
      </footer>
    </div>
  )
}
