import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarCheck, CheckCircle2, FileText, HeartPulse, Loader2, MessageCircle, ShieldCheck, Smartphone, Stethoscope, Wallet } from 'lucide-react'
import api from '../lib/api'
import { apiError } from '../lib/hooks'
import { useL } from '../lib/labels'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { NativeSelect } from '../components/ui/native-select'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import { ToothMark } from '../components/layout/Sidebar'

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
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-white"><ToothMark size={20} /></span>
            <span className="whitespace-nowrap text-lg font-extrabold">{L('Cabinet Pro')}</span>
          </a>
          <div className="flex items-center gap-2">
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
              {SPECIALTIES.map(s => <span key={s} className="rounded-full bg-[#EAF5F0] px-3 py-1.5 text-[0.88rem] font-semibold text-primary">{t(`specialty.${s}`)}</span>)}
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

        <section id="essai" className="scroll-mt-16 border-t border-[#D8E1DD] bg-white">
          <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
            <div className="space-y-4">
              <h2 className="text-[1.8rem] font-extrabold leading-tight">{L('Demandez votre essai gratuit')}</h2>
              <p className="text-[#5A6B65]">{L('Laissez vos coordonnées : nous vous appelons pour comprendre votre cabinet, puis nous ouvrons votre compte d’essai avec vos actes et vos tarifs.')}</p>
              <ul className="grid gap-2 text-[0.95rem]">
                {[L('Sans engagement, sans carte bancaire'), L('Nous vous aidons à démarrer avec vos actes et vos tarifs'), L('Données médicales chiffrées et protégées')].map(x => (
                  <li key={x} className="flex items-center gap-2.5"><CheckCircle2 size={18} className="text-primary" />{x}</li>
                ))}
              </ul>
            </div>

            {sent ? (
              <div role="status" className="grid content-center justify-items-center gap-3 rounded-[18px] bg-[#EAF5F0] p-8 text-center">
                <CheckCircle2 size={44} className="text-primary" />
                <p className="text-lg font-bold">{sent}</p>
                <Button variant="outline" onClick={() => setSent(null)}>{L('Envoyer une autre demande')}</Button>
              </div>
            ) : (
              <form className="grid gap-3 rounded-[18px] border border-[#D8E1DD] p-5 sm:grid-cols-2 sm:p-6" onSubmit={e => { e.preventDefault(); send.mutate() }}>
                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="tr-name">{L('Nom complet')} *</Label><Input id="tr-name" autoComplete="name" required minLength={3} value={form.fullName} onChange={set('fullName')} placeholder={L('ex. Dr Karima Alaoui')} /></div>
                <div className="space-y-1.5"><Label htmlFor="tr-phone">{L('Téléphone (WhatsApp)')} *</Label><Input id="tr-phone" type="tel" autoComplete="tel" required value={form.phone} onChange={set('phone')} placeholder="06 12 34 56 78" /></div>
                <div className="space-y-1.5"><Label htmlFor="tr-email">{L('Email')} *</Label><Input id="tr-email" type="email" autoComplete="email" required value={form.email} onChange={set('email')} /></div>
                <div className="space-y-1.5"><Label htmlFor="tr-cab">{L('Nom du cabinet')}</Label><Input id="tr-cab" value={form.cabinetName} onChange={set('cabinetName')} /></div>
                <div className="space-y-1.5"><Label htmlFor="tr-city">{L('Ville')}</Label><Input id="tr-city" autoComplete="address-level2" value={form.city} onChange={set('city')} /></div>
                <div className="space-y-1.5"><Label htmlFor="tr-spec">{L('Spécialité')}</Label>
                  <NativeSelect id="tr-spec" value={form.specialty} onChange={set('specialty')}><option value="">—</option>{SPECIALTIES.map(s => <option key={s} value={s}>{t(`specialty.${s}`)}</option>)}</NativeSelect>
                </div>
                <div className="space-y-1.5"><Label htmlFor="tr-docs">{L('Nombre de praticiens')}</Label><Input id="tr-docs" type="number" min={1} max={200} inputMode="numeric" value={form.doctors} onChange={set('doctors')} /></div>
                <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="tr-msg">{L('Votre besoin (facultatif)')}</Label><Textarea id="tr-msg" rows={3} value={form.message} onChange={set('message')} placeholder={L('ex. agenda pour 2 médecins et une secrétaire, rappels WhatsApp…')} /></div>
                {/* Honeypot: hidden from people, robots fill it. */}
                <input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" value={form.website} onChange={set('website')} />
                <label className="flex items-start gap-2 text-[0.88rem] sm:col-span-2">
                  <input type="checkbox" className="mt-1 h-4 w-4 accent-[#12705A]" required checked={form.consent} onChange={set('consent')} />
                  {L('J’accepte d’être contacté au sujet de ma demande. Mes coordonnées ne servent qu’à cela (loi 09-08).')}
                </label>
                {send.isError && <p role="alert" className="rounded-xl bg-[#FBE3E0] px-3 py-2 text-[0.9rem] font-semibold text-[#B8372C] sm:col-span-2">{apiError(send.error)}</p>}
                <Button type="submit" size="lg" className="sm:col-span-2" disabled={send.isPending}>
                  {send.isPending ? <Loader2 className="me-2 h-5 w-5 animate-spin" /> : null}{L('Envoyer ma demande')}
                </Button>
              </form>
            )}
          </div>
        </section>
      </main>

      <footer className="border-t border-[#D8E1DD] px-4 py-6 text-center text-[0.86rem] text-[#5A6B65]">
        © {new Date().getFullYear()} {L('Cabinet Pro')} · {L('Logiciel de gestion de cabinet médical')}
      </footer>
    </div>
  )
}
