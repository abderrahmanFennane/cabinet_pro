import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useSearchParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Pencil, Plus, UserX } from 'lucide-react'
import api from '../lib/api'
import { apiError, practitionerName, useAuth } from '../lib/hooks'
import { cn } from '../lib/utils'
import { Role, Specialty, User } from '../types'
import { PageHeader } from '../components/layout/PageHeader'
import { Button } from '../components/ui/button'
import { Badge } from '../components/ui/badge'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { NativeSelect } from '../components/ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../components/ui/dialog'

type Quota = { practitioners: { used: number; limit: number }; assistants: { used: number; limit: number } }
const SPECIALTIES: Specialty[] = ['DENTISTRY', 'GENERAL', 'PEDIATRICS', 'GYNECOLOGY', 'OPHTHALMOLOGY', 'CARDIOLOGY', 'DERMATOLOGY', 'PHYSIOTHERAPY', 'PSYCHIATRY']
const empty = { firstName: '', lastName: '', title: '', email: '', phone: '', password: '', role: Role.ASSISTANT as Role, specialty: '' as '' | Specialty, seesAllPatients: false }

/** Team of the cabinet (owner) or users of a cabinet (Super Admin, ?cabinetId=). */
export default function Users() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const [params] = useSearchParams()
  const queryClient = useQueryClient()
  const superAdmin = user?.role === Role.SUPER_ADMIN
  const cabinetId = superAdmin ? params.get('cabinetId') || '' : user?.cabinetId || ''
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const [form, setForm] = useState(empty)

  const { data } = useQuery({
    queryKey: ['users', cabinetId],
    queryFn: async () => (await api.get('/users', { params: { cabinetId: cabinetId || undefined } })).data as { data: User[]; meta?: { quota: Quota } },
  })
  const users = data?.data || []
  const quota = data?.meta?.quota
  const roles: Role[] = superAdmin ? (cabinetId ? [Role.OWNER, Role.PRACTITIONER, Role.ASSISTANT] : [Role.SUPER_ADMIN]) : [Role.PRACTITIONER, Role.ASSISTANT]

  useEffect(() => {
    if (!editing) return
    setForm(editing === 'new'
      ? { ...empty, role: roles[roles.length - 1] }
      : { firstName: editing.firstName, lastName: editing.lastName, title: editing.title || '', email: editing.email, phone: editing.phone || '', password: '', role: editing.role, specialty: editing.specialty || '', seesAllPatients: !!editing.seesAllPatients })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing])

  const refresh = () => { queryClient.invalidateQueries({ queryKey: ['users'] }); queryClient.invalidateQueries({ queryKey: ['team'] }) }
  const save = useMutation({
    mutationFn: () => {
      const body: any = {
        firstName: form.firstName, lastName: form.lastName, title: form.title || null, email: form.email, phone: form.phone || null, role: form.role,
        specialty: form.role === Role.ASSISTANT || form.role === Role.SUPER_ADMIN ? null : form.specialty || null, seesAllPatients: form.seesAllPatients,
      }
      if (form.password) body.password = form.password
      if (editing === 'new') return api.post('/users', { ...body, cabinetId: cabinetId || undefined })
      return api.patch(`/users/${(editing as User).id}`, body)
    },
    onSuccess: () => { toast.success('Utilisateur enregistré'); setEditing(null); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/users/${id}`),
    onSuccess: () => { toast.success('Utilisateur supprimé'); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })
  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))
  const isPractitioner = form.role === Role.OWNER || form.role === Role.PRACTITIONER

  return (
    <div className="space-y-5">
      <PageHeader title={t('nav.team')} subtitle={quota ? `Praticiens ${quota.practitioners.used}/${quota.practitioners.limit} · Assistants ${quota.assistants.used}/${quota.assistants.limit >= 999 ? '∞' : quota.assistants.limit}` : undefined}
        actions={<Button onClick={() => setEditing('new')}><Plus size={17} className="me-1.5" />Ajouter</Button>} />
      <ul className="divide-y divide-border overflow-hidden rounded-[14px] border border-[#D8E1DD] bg-white">
        {users.map(u => (
          <li key={u.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-sm font-bold text-primary">{u.firstName[0]}{u.lastName[0]}</span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-semibold">{practitionerName(u)}</p>
              <p className="truncate text-xs text-muted-foreground">{[u.email, u.phone, u.specialty && t(`specialty.${u.specialty}`)].filter(Boolean).join(' · ')}</p>
            </div>
            <Badge variant={u.role === Role.OWNER ? 'default' : 'secondary'}>{t(`roles.${u.role}`)}</Badge>
            {u.role === Role.PRACTITIONER && <Badge variant="outline">{u.seesAllPatients ? 'Tous les patients' : 'Ses patients'}</Badge>}
            {!u.isActive && <Badge variant="destructive">Désactivé</Badge>}
            <div className="flex gap-1">
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Modifier" onClick={() => setEditing(u)}><Pencil size={15} /></Button>
              {u.id !== user?.id && (superAdmin || u.role !== Role.OWNER) && <Button size="icon" variant="ghost" className="h-9 w-9" aria-label="Supprimer" onClick={() => { if (window.confirm(`Supprimer ${u.firstName} ${u.lastName} ?`)) remove.mutate(u.id) }}><UserX size={15} /></Button>}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onOpenChange={o => !o && setEditing(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Nouvel utilisateur' : 'Modifier'}</DialogTitle>
            <DialogDescription>Un assistant gère l’accueil, l’agenda et l’encaissement, sans accès au contenu médical.</DialogDescription>
          </DialogHeader>
          <form className="grid gap-3 sm:grid-cols-2" onSubmit={e => { e.preventDefault(); save.mutate() }}>
            {(editing === 'new' || (editing && editing.role !== Role.OWNER)) && roles.length > 1 && (
              <div className="space-y-1.5 sm:col-span-2"><Label>Rôle</Label>
                <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                  {roles.map(r => <button key={r} type="button" aria-pressed={form.role === r} onClick={() => setForm(f => ({ ...f, role: r }))} className={cn('min-h-[40px] rounded-xl border px-2 text-sm font-semibold', form.role === r ? 'border-primary bg-accent text-primary' : 'border-border')}>{t(`roles.${r}`)}</button>)}
                </div>
              </div>
            )}
            {isPractitioner && <div className="space-y-1.5"><Label htmlFor="u-title">Titre</Label><Input id="u-title" value={form.title} onChange={set('title')} placeholder="Dr" /></div>}
            {isPractitioner && (
              <div className="space-y-1.5"><Label htmlFor="u-spec">Spécialité</Label>
                <NativeSelect id="u-spec" value={form.specialty} onChange={set('specialty')}><option value="">Celle du cabinet</option>{SPECIALTIES.map(s => <option key={s} value={s}>{t(`specialty.${s}`)}</option>)}</NativeSelect>
              </div>
            )}
            <div className="space-y-1.5"><Label htmlFor="u-last">Nom</Label><Input id="u-last" value={form.lastName} onChange={set('lastName')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="u-first">Prénom</Label><Input id="u-first" value={form.firstName} onChange={set('firstName')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="u-email">Email</Label><Input id="u-email" type="email" value={form.email} onChange={set('email')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="u-phone">Téléphone</Label><Input id="u-phone" value={form.phone} onChange={set('phone')} /></div>
            <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="u-pass">{editing === 'new' ? 'Mot de passe (8 caractères minimum)' : 'Nouveau mot de passe (laisser vide pour ne pas changer)'}</Label><Input id="u-pass" type="password" minLength={8} value={form.password} onChange={set('password')} required={editing === 'new'} autoComplete="new-password" /></div>
            {form.role === Role.PRACTITIONER && <label className="flex items-start gap-2 text-sm sm:col-span-2"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#12705A]" checked={form.seesAllPatients} onChange={set('seesAllPatients')} />Voit tous les patients du cabinet (sinon seulement ceux qu’il suit).</label>}
            <Button type="submit" className="sm:col-span-2" disabled={save.isPending}>Enregistrer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
