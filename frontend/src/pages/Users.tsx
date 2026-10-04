import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { ArrowRightLeft, KeyRound, MoreHorizontal, Pencil, Plus, Power, Search, Send, ShieldCheck, ShieldOff, Trash2, Wand2 } from 'lucide-react'
import api from '../lib/api'
import { apiError, practitionerName, useAuth } from '../lib/hooks'
import { cn } from '../lib/utils'
import { Cabinet, Role, Specialty, User } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { NativeSelect } from '../components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu'
import CredentialsDialog, { Credentials, generatePassword } from '../components/CredentialsDialog'
import { useL } from '../lib/labels'

type Quota = { plan?: { code: string; name: string }; practitioners: { used: number; limit: number }; assistants: { used: number; limit: number } }
const UNLIMITED = 999
type UserRow = User & { cabinet?: { id: string; name: string } | null }
const SPECIALTIES: Specialty[] = ['DENTISTRY', 'GENERAL', 'PEDIATRICS', 'GYNECOLOGY', 'OPHTHALMOLOGY', 'CARDIOLOGY', 'DERMATOLOGY', 'PHYSIOTHERAPY', 'PSYCHIATRY']
const empty = { firstName: '', lastName: '', title: '', inpe: '', email: '', phone: '', password: '', role: Role.ASSISTANT as Role, specialty: '' as '' | Specialty, seesAllPatients: false, cabinetId: '' }

// What each account type can do, in one line, shown when choosing it.
const ROLE_HINT: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'Gère la plateforme : cabinets, plans, abonnements. Aucun accès aux dossiers médicaux.',
  [Role.OWNER]: 'Médecin responsable du cabinet : tout, y compris l’équipe, les tarifs et l’abonnement.',
  [Role.PRACTITIONER]: 'Médecin du cabinet : patients, consultations, ordonnances et plans de traitement.',
  [Role.ASSISTANT]: 'Accueil, agenda, coordonnées des patients et encaissement. Aucun accès médical.',
}
const ROLE_PILL: Record<Role, string> = {
  [Role.SUPER_ADMIN]: 'bg-[#EEE7F8] text-[#6746A8]',
  [Role.OWNER]: 'bg-[#DCEEE7] text-primary',
  [Role.PRACTITIONER]: 'bg-[#E1E9F7] text-[#2D5DAA]',
  [Role.ASSISTANT]: 'bg-[#E9EFEC] text-[#5A6B65]',
}

type Props = {
  /** Team of one cabinet, managed by the Super Admin (cabinet page). */
  cabinetId?: string
  /** Inside another page: no page title. */
  embedded?: boolean
}

/**
 * Accounts, in three situations:
 * - the owner's own team (practitioners and assistants);
 * - one cabinet's team, for the Super Admin (any cabinet role);
 * - every account of the platform, for the Super Admin, with search and filters.
 */
export default function Users({ cabinetId: cabinetProp, embedded = false }: Props) {
  const L = useL()
  const { t } = useTranslation()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const superAdmin = user?.role === Role.SUPER_ADMIN
  const cabinetId = superAdmin ? cabinetProp || params.get('cabinetId') || '' : user?.cabinetId || ''
  const platform = superAdmin && !cabinetId
  const [editing, setEditing] = useState<UserRow | 'new' | null>(null)
  const [form, setForm] = useState(empty)
  const [credentials, setCredentials] = useState<Credentials | null>(null)
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState<Role | 'all'>('all')
  const [cabinetFilter, setCabinetFilter] = useState('')

  const { data } = useQuery({
    queryKey: ['users', cabinetId],
    queryFn: async () => (await api.get('/users', { params: { cabinetId: cabinetId || undefined } })).data as { data: UserRow[]; meta?: { quota: Quota } },
  })
  const { data: cabinets = [] } = useQuery({
    queryKey: ['all-cabinets'],
    queryFn: async () => (await api.get('/cabinets')).data.data as Cabinet[],
    enabled: platform,
  })
  const users = data?.data || []
  const quota = data?.meta?.quota
  const roles: Role[] = superAdmin
    ? (platform ? [Role.OWNER, Role.PRACTITIONER, Role.ASSISTANT, Role.SUPER_ADMIN] : [Role.OWNER, Role.PRACTITIONER, Role.ASSISTANT])
    : [Role.PRACTITIONER, Role.ASSISTANT]

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase()
    return users.filter(u => (roleFilter === 'all' || u.role === roleFilter)
      && (!cabinetFilter || u.cabinetId === cabinetFilter)
      && (!q || [u.firstName, u.lastName, u.email, u.phone, u.cabinet?.name].some(v => v?.toLowerCase().includes(q))))
  }, [users, roleFilter, cabinetFilter, search])

  useEffect(() => {
    if (!editing) return
    setForm(editing === 'new'
      ? { ...empty, role: platform ? Role.OWNER : [Role.ASSISTANT, Role.PRACTITIONER, Role.OWNER].find(r => roles.includes(r) && !roleFull(r)) || roles[roles.length - 1], password: generatePassword(), cabinetId: cabinetFilter }
      : { firstName: editing.firstName, lastName: editing.lastName, title: editing.title || '', inpe: editing.inpe || '', email: editing.email, phone: editing.phone || '', password: '', role: editing.role, specialty: editing.specialty || '', seesAllPatients: !!editing.seesAllPatients, cabinetId: editing.cabinetId || '' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const refresh = () => ['users', 'team', 'team-quota', 'all-cabinets'].forEach(key => queryClient.invalidateQueries({ queryKey: [key] }))
  const cabinetName = (id: string) => cabinets.find(c => c.id === id)?.name || users.find(u => u.cabinetId === id)?.cabinet?.name || null

  const save = useMutation({
    mutationFn: () => {
      const body: any = {
        firstName: form.firstName, lastName: form.lastName, title: form.title || null, inpe: isPractitioner ? form.inpe.trim() || null : null, email: form.email, phone: form.phone || null, role: form.role,
        specialty: form.role === Role.ASSISTANT || form.role === Role.SUPER_ADMIN ? null : form.specialty || null, seesAllPatients: form.seesAllPatients,
      }
      if (form.password) body.password = form.password
      if (editing === 'new') return api.post('/users', { ...body, cabinetId: form.role === Role.SUPER_ADMIN ? undefined : cabinetId || form.cabinetId || undefined })
      return api.patch(`/users/${(editing as UserRow).id}`, body)
    },
    onSuccess: () => {
      toast.success(editing === 'new' ? L('Compte créé') : L('Compte mis à jour'))
      if (form.password) {
        setCredentials({ name: `${form.firstName} ${form.lastName}`, email: form.email.toLowerCase(), password: form.password, phone: form.phone, cabinetName: form.role === Role.SUPER_ADMIN ? null : cabinetName(cabinetId || form.cabinetId) })
      }
      setEditing(null); refresh()
    },
    onError: (err) => toast.error(apiError(err)),
  })
  const toggleActive = useMutation({
    mutationFn: (u: UserRow) => api.patch(`/users/${u.id}`, { isActive: !u.isActive }),
    onSuccess: (_r, u) => { toast.success(u.isActive ? L('Compte désactivé : il ne peut plus se connecter') : L('Compte réactivé')); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const resetPassword = useMutation({
    mutationFn: ({ u, password }: { u: UserRow; password: string }) => api.patch(`/users/${u.id}`, { password }),
    onSuccess: (r, { u, password }) => { if (r.data.data?.token) localStorage.setItem('token', r.data.data.token); setCredentials({ name: `${u.firstName} ${u.lastName}`, email: u.email, password, phone: u.phone, cabinetName: u.cabinet?.name }); toast.success(L('Nouveau mot de passe enregistré')) },
    onError: (err) => toast.error(apiError(err)),
  })
  // New temporary password sent by SMS (when the account has a phone) and shown once.
  const resendAccess = useMutation({
    mutationFn: (u: UserRow) => api.post(`/users/${u.id}/resend-access`, { channel: 'SMS' }),
    onSuccess: (r, u) => { const d = r.data.data; setCredentials({ name: `${u.firstName} ${u.lastName}`, email: d.email, password: d.password, phone: d.phone, cabinetName: d.cabinetName }); toast.success(r.data.message) },
    onError: (err) => toast.error(apiError(err)),
  })
  const [moving, setMoving] = useState<UserRow | null>(null)
  const [moveTo, setMoveTo] = useState({ cabinetId: '', role: '' })
  const move = useMutation({
    mutationFn: () => api.post(`/users/${moving!.id}/move`, { cabinetId: moveTo.cabinetId, role: moveTo.role || undefined }),
    onSuccess: (r) => { toast.success(r.data.message); setMoving(null); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const resetMfa = useMutation({
    mutationFn: (u: UserRow) => api.post(`/users/${u.id}/mfa/reset`),
    onSuccess: () => { toast.success(t('account.resetMfaDone')); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { toast.success(L('Compte supprimé')); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))
  const isPractitioner = form.role === Role.OWNER || form.role === Role.PRACTITIONER
  const editingSuperAdmin = editing !== null && editing !== 'new' && editing.role === Role.SUPER_ADMIN
  const canPickRole = editing === 'new' || (superAdmin ? !editingSuperAdmin : editing?.role !== Role.OWNER)
  const needsCabinet = editing === 'new' && platform && form.role !== Role.SUPER_ADMIN
  const canRemove = (u: UserRow) => u.id !== user?.id && (superAdmin || u.role !== Role.OWNER)

  // Seats left in the cabinet's plan: a full role cannot be chosen, and "add" explains why when everything is full.
  const seatsLeft = (r: Role) => !quota ? Infinity
    : r === Role.ASSISTANT ? (quota.assistants.limit >= UNLIMITED ? Infinity : quota.assistants.limit - quota.assistants.used)
    : r === Role.SUPER_ADMIN ? Infinity : quota.practitioners.limit - quota.practitioners.used
  function roleFull(r: Role) { return !platform && seatsLeft(r) <= 0 }
  const allFull = !platform && roles.every(roleFull)
  const upgradeLink = superAdmin ? `/cabinets/${cabinetId}?tab=subscription` : '/pricing'
  const addButton = (
    <Button onClick={() => setEditing('new')} disabled={allFull} title={allFull ? L('Toutes les places de votre plan sont utilisées') : undefined}>
      <Plus size={17} className="me-1.5" />{platform ? L('Nouvel utilisateur') : L('Ajouter un membre')}
    </Button>
  )
  const meter = (label: string, used: number, limit: number) => (
    <div className="grid gap-1.5">
      <div className="flex justify-between gap-3 text-[0.9rem]"><span>{label}</span><span className="font-mono tabular-nums">{used} / {limit >= UNLIMITED ? L('illimité') : limit}</span></div>
      <div className="h-2 overflow-hidden rounded-full bg-[#E9EFEC]">
        <i className={cn('block h-full rounded-full', limit < UNLIMITED && used >= limit ? 'bg-[#99600B]' : 'bg-primary')} style={{ width: `${limit >= UNLIMITED ? 8 : Math.min(100, (used / Math.max(1, limit)) * 100)}%` }} />
      </div>
    </div>
  )
  const planCard = !platform && quota && (
    <section className="grid gap-4 rounded-[14px] border border-[#D8E1DD] bg-white p-[18px] md:grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)]">
      <div className="grid content-start gap-1">
        <span className="text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{L('Places incluses dans le plan')}</span>
        <b className="text-[1.25rem] font-extrabold">{quota.plan?.name || L('Plan actuel')}</b>
        <p className="text-[0.9rem] text-[#5A6B65]">
          {allFull ? L('Toutes les places sont utilisées. ') : `${L('Il reste')} ${[
            seatsLeft(Role.PRACTITIONER) > 0 && `${seatsLeft(Role.PRACTITIONER)} ${L('place(s) de médecin')}`,
            seatsLeft(Role.ASSISTANT) === Infinity ? L('des places d’assistant illimitées') : seatsLeft(Role.ASSISTANT) > 0 && `${seatsLeft(Role.ASSISTANT)} ${L('place(s) d’assistant')}`,
          ].filter(Boolean).join(` ${L('et')} `) || L('aucune place')}. `}
          <Link to={upgradeLink} className="font-semibold text-primary hover:underline">{allFull ? L('Passer à un plan supérieur') : L('Voir les plans')}</Link>
        </p>
      </div>
      <div className="grid content-center gap-3.5">
        {meter(L('Médecins (titulaire compris)'), quota.practitioners.used, quota.practitioners.limit)}
        {meter(L('Assistant(e)s'), quota.assistants.used, quota.assistants.limit)}
      </div>
    </section>
  )

  return (
    <div className="grid gap-5">
      {embedded
        ? <div className="flex flex-wrap items-center justify-end gap-3">{addButton}</div>
        : <PageHeader title={platform ? t('adminPage.usersTitle') : t('nav.team')} subtitle={platform ? `${users.length} ${L('compte(s) sur la plateforme')}` : L('Créez les comptes de vos assistant(e)s et de vos confrères. Chacun se connecte avec son email.')} actions={addButton} />}
      {planCard}

      {platform && (
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1 sm:max-w-xs">
            <Search size={16} className="pointer-events-none absolute start-3 top-1/2 -translate-y-1/2 text-[#5A6B65]" />
            <Input className="ps-9" value={search} onChange={e => setSearch(e.target.value)} placeholder={L('Nom, email, téléphone, cabinet…')} aria-label={L('Rechercher')} />
          </div>
          <NativeSelect className="w-auto" aria-label={L('Cabinet')} value={cabinetFilter} onChange={e => setCabinetFilter(e.target.value)}>
            <option value="">{L('Tous les cabinets')}</option>
            {cabinets.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </NativeSelect>
          <div className="flex flex-wrap gap-1.5">
            {(['all', Role.OWNER, Role.PRACTITIONER, Role.ASSISTANT, Role.SUPER_ADMIN] as const).map(r => (
              <button key={r} type="button" aria-pressed={roleFilter === r} onClick={() => setRoleFilter(r)}
                className={cn('rounded-full border px-3 py-1.5 text-[0.86rem] font-semibold', roleFilter === r ? 'border-[#14231E] bg-[#14231E] text-white' : 'border-[#D8E1DD] bg-white text-[#5A6B65]')}>
                {r === 'all' ? L('Tous') : t(`roles.${r}`)}
              </button>
            ))}
          </div>
        </div>
      )}

      <ul className="overflow-hidden rounded-[14px] border border-[#D8E1DD] bg-white">
        {shown.length === 0 && <li className="p-6 text-center text-[#5A6B65]">{L('Aucun compte ne correspond.')}</li>}
        {shown.map(u => (
          <li key={u.id} className={cn('grid grid-cols-[40px_minmax(0,1fr)_auto] items-center gap-3 border-t border-[#D8E1DD] px-4 py-3 first:border-t-0', !u.isActive && 'opacity-60')}>
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-[#E9EFEC] text-sm font-bold text-primary">{u.firstName[0]}{u.lastName[0]}</span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <b className="font-semibold">{practitionerName(u)}</b>
                <span className={cn('rounded-full px-2 py-0.5 text-[0.74rem] font-bold', ROLE_PILL[u.role])}>{t(`roles.${u.role}`)}</span>
                {u.mfaEnabled && <span title={t('account.mfaTitle')} className="inline-flex items-center gap-1 rounded-full bg-[#DCEEE7] px-2 py-0.5 text-[0.74rem] font-bold text-primary"><ShieldCheck size={12} />{L('2FA')}</span>}
                {!u.isActive && <span className="rounded-full bg-[#FBE3E0] px-2 py-0.5 text-[0.74rem] font-bold text-[#B8372C]">{L('Désactivé')}</span>}
              </p>
              <p className="truncate text-[0.84rem] text-[#5A6B65]">
                {[u.email, u.phone, u.specialty && t(`specialty.${u.specialty}`), u.role === Role.PRACTITIONER && (u.seesAllPatients ? L('voit tous les patients') : L('voit ses patients'))].filter(Boolean).join(' · ')}
              </p>
              {platform && u.cabinet && <Link to={`/cabinets/${u.cabinet.id}`} className="text-[0.84rem] font-semibold text-primary hover:underline">{u.cabinet.name}</Link>}
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9" aria-label={`${L('Actions pour')} ${u.firstName} ${u.lastName}`}><MoreHorizontal size={17} /></Button></DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                <DropdownMenuItem onClick={() => setEditing(u)}><Pencil size={15} className="me-2" />{L('Modifier')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => resendAccess.mutate(u)}><Send size={15} className="me-2 rtl:rotate-180" />{t('usersAdmin.resend')}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => resetPassword.mutate({ u, password: generatePassword() })}><KeyRound size={15} className="me-2" />{L('Nouveau mot de passe')}</DropdownMenuItem>
                {platform && u.role !== Role.SUPER_ADMIN && <DropdownMenuItem onClick={() => { setMoving(u); setMoveTo({ cabinetId: '', role: '' }) }}><ArrowRightLeft size={15} className="me-2" />{t('usersAdmin.move')}</DropdownMenuItem>}
                {u.mfaEnabled && u.id !== user?.id && (
                  <DropdownMenuItem onClick={() => resetMfa.mutate(u)}><ShieldOff size={15} className="me-2" />{t('account.resetMfa')}</DropdownMenuItem>
                )}
                {u.id !== user?.id && (superAdmin || u.role !== Role.OWNER) && (
                  <DropdownMenuItem onClick={() => toggleActive.mutate(u)}><Power size={15} className="me-2" />{u.isActive ? L('Désactiver') : L('Réactiver')}</DropdownMenuItem>
                )}
                {canRemove(u) && <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-[#B8372C] focus:text-[#B8372C]" onClick={() => { if (window.confirm(`${L('Supprimer le compte de')} ${u.firstName} ${u.lastName} ? ${L('Ses consultations et actes restent dans les dossiers.')}`)) remove.mutate(u.id) }}><Trash2 size={15} className="me-2" />{L('Supprimer')}</DropdownMenuItem>
                </>}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? (platform ? L('Nouvel utilisateur') : L('Nouveau membre de l’équipe')) : `${L('Modifier')} ${editing ? `${editing.firstName} ${editing.lastName}` : ''}`}</DialogTitle>
            <DialogDescription>{L(ROLE_HINT[form.role])}</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); save.mutate() }}>
            {canPickRole && roles.length > 1 && (
              <div className="space-y-1.5 sm:col-span-2"><Label>{L('Type de compte')}</Label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
                  {roles.map(r => {
                    // Only a new account takes a seat; changing an existing member's role is checked by the server.
                    const full = editing === 'new' && roleFull(r)
                    return (
                      <button key={r} type="button" aria-pressed={form.role === r} disabled={full} onClick={() => setForm(f => ({ ...f, role: r }))}
                        className={cn('grid min-h-[44px] content-center rounded-xl border px-2 py-1 text-sm font-semibold', form.role === r ? 'border-primary bg-[#DCEEE7] text-primary' : 'border-[#D8E1DD] hover:bg-[#E9EFEC]', full && 'cursor-not-allowed opacity-50 hover:bg-transparent')}>
                        {t(`roles.${r}`)}
                        {full && <span className="text-[0.7rem] font-medium text-[#99600B]">{L('Limite du plan atteinte')}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {needsCabinet && (
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="u-cabinet">{L('Cabinet')}</Label>
                <NativeSelect id="u-cabinet" value={form.cabinetId} onChange={set('cabinetId')} required>
                  <option value="">{L('Choisir le cabinet…')}</option>
                  {cabinets.map(c => <option key={c.id} value={c.id}>{c.name}{c.city ? ` · ${c.city}` : ''}</option>)}
                </NativeSelect>
              </div>
            )}
            {isPractitioner && <div className="space-y-1.5"><Label htmlFor="u-title">{L('Titre')}</Label><Input id="u-title" value={form.title} onChange={set('title')} placeholder={L('Dr')} /></div>}
            {isPractitioner && <div className="space-y-1.5"><Label htmlFor="u-inpe">{L('N° INPE')}</Label><Input id="u-inpe" inputMode="numeric" value={form.inpe} onChange={set('inpe')} placeholder={L('Imprimé sur la feuille de soins CNSS')} /></div>}
            {isPractitioner && (
              <div className="space-y-1.5"><Label htmlFor="u-spec">{L('Spécialité')}</Label>
                <NativeSelect id="u-spec" value={form.specialty} onChange={set('specialty')}><option value="">{L('Celle du cabinet')}</option>{SPECIALTIES.map(s => <option key={s} value={s}>{t(`specialty.${s}`)}</option>)}</NativeSelect>
              </div>
            )}
            <div className="space-y-1.5"><Label htmlFor="u-first">{L('Prénom')}</Label><Input id="u-first" value={form.firstName} onChange={set('firstName')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="u-last">{L('Nom')}</Label><Input id="u-last" value={form.lastName} onChange={set('lastName')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="u-email">{L('Email (identifiant de connexion)')}</Label><Input id="u-email" type="email" value={form.email} onChange={set('email')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="u-phone">{L('Téléphone (WhatsApp)')}</Label><Input id="u-phone" value={form.phone} onChange={set('phone')} placeholder="06 12 34 56 78" /></div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label htmlFor="u-pass">{editing === 'new' ? L('Mot de passe') : L('Nouveau mot de passe (laisser vide pour ne pas changer)')}</Label>
              <div className="flex gap-2">
                <Input id="u-pass" className="font-mono" value={form.password} onChange={set('password')} minLength={8} required={editing === 'new'} autoComplete="new-password" />
                <Button type="button" variant="outline" onClick={() => setForm(f => ({ ...f, password: generatePassword() }))}><Wand2 size={16} className="me-1.5" />{L('Générer')}</Button>
              </div>
              <p className="text-xs text-[#5A6B65]">{L('8 caractères minimum. Il sera affiché une fois à la fin, pour le transmettre.')}</p>
            </div>
            {form.role === Role.PRACTITIONER && <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#12705A]" checked={form.seesAllPatients} onChange={set('seesAllPatients')} />{L('Voit tous les patients du cabinet (sinon seulement ceux qu’il suit).')}</label>}
            <Button type="submit" className="sm:col-span-2" disabled={save.isPending}>{editing === 'new' ? L('Créer le compte') : L('Enregistrer')}</Button>
          </form>
        </DialogContent>
      </Dialog>

      <CredentialsDialog credentials={credentials} onClose={() => setCredentials(null)} />
      <Dialog open={!!moving} onOpenChange={open => !open && setMoving(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t('usersAdmin.moveTitle', { name: moving ? `${moving.firstName} ${moving.lastName}` : '' })}</DialogTitle>
            <DialogDescription>{t('usersAdmin.moveHint')}</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={e => { e.preventDefault(); move.mutate() }}>
            <div className="space-y-1.5"><Label htmlFor="mv-cab">{t('usersAdmin.moveTo')}</Label>
              <NativeSelect id="mv-cab" required value={moveTo.cabinetId} onChange={e => setMoveTo(m => ({ ...m, cabinetId: e.target.value }))}>
                <option value="">—</option>
                {cabinets.filter(c => c.id !== moving?.cabinetId && !c.isDemo).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="mv-role">{t('usersAdmin.moveRole')}</Label>
              <NativeSelect id="mv-role" value={moveTo.role} onChange={e => setMoveTo(m => ({ ...m, role: e.target.value }))}>
                <option value="">{t('usersAdmin.sameRole')}</option>
                {[Role.OWNER, Role.PRACTITIONER, Role.ASSISTANT].map(r => <option key={r} value={r}>{t(`roles.${r}`)}</option>)}
              </NativeSelect>
            </div>
            <Button type="submit" className="w-full" disabled={!moveTo.cabinetId || move.isPending}>{t('usersAdmin.moveConfirm')}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
