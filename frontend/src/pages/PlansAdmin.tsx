import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Eye, Pencil, Plus, Trash2, MoreHorizontal } from 'lucide-react'
import api from '../lib/api'
import { Button } from '../components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Badge } from '../components/ui/badge'
import { toast } from '../components/ui/toast'
import { ScrollArea } from '../components/ui/scroll-area'
import { Separator } from '../components/ui/separator'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '../components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../components/ui/dropdown-menu'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../components/ui/alert-dialog'
import { PERMISSIONS, PERMISSIONS_BY_MODULE, PERMISSION_LABELS, type PermissionKey } from '../types/permissions'
import { useTranslation } from 'react-i18next'
import { EmptyState, PageHeader } from '../components/layout/PageHeader'
import { toneAt } from '../lib/tones'
import { useL, translateText } from '../lib/labels'

type Plan = {
  id: string
  code: string
  name: string
  monthlyPrice: number | string
  durationMonths: number
  maxPractitioners: number
  maxAssistants: number
  monthlyMessages: number
  storageGb: number
  permissions?: PermissionKey[]
  isActive: boolean
}

type Form = {
  code: string
  name: string
  monthlyPrice: string
  durationMonths: string
  maxPractitioners: string
  maxAssistants: string
  monthlyMessages: string
  storageGb: string
  permissions: PermissionKey[]
}

const EMPTY_FORM: Form = { code: '', name: '', monthlyPrice: '0', durationMonths: '1', maxPractitioners: '1', maxAssistants: '1', monthlyMessages: '100', storageGb: '5', permissions: [] }

export default function PlansAdmin() {
  const L = useL()
    const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [form, setForm] = useState<Form>(EMPTY_FORM)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [viewing, setViewing] = useState<Plan | null>(null)
  const [formOpen, setFormOpen] = useState(false)
  const [deletePlan, setDeletePlan] = useState<Plan | null>(null)

  const plans = useQuery({
    queryKey: ['plans'],
    queryFn: async () => ((await api.get('/plans')).data.data || []) as Plan[],
  })

  const payload = () => ({
    code: form.code.toUpperCase(),
    name: form.name,
    monthlyPrice: Number(form.monthlyPrice),
    durationMonths: Number(form.durationMonths),
    maxPractitioners: Number(form.maxPractitioners),
    maxAssistants: Number(form.maxAssistants),
    monthlyMessages: Number(form.monthlyMessages),
    storageGb: Number(form.storageGb),
    permissions: form.permissions,
  })

  const create = useMutation({
    mutationFn: () => api.post('/plans', payload()),
    onSuccess: (res) => {
      const created = (res.data.data || res.data) as Plan
      queryClient.setQueryData(['plans'], (current: any) => {
        const list = (current || []) as Plan[]
        return [...list, created]
      })
      setForm(EMPTY_FORM)
      setFormOpen(false)
      toast({ title: L('Plan créé'), variant: 'success' })
    },
    onError: (err: any) => toast({ title: L('Erreur'), description: err.response?.data?.message || err.response?.data?.error, variant: 'destructive' }),
  })

  const update = useMutation({
    mutationFn: () => api.patch(`/plans/${editing!.id}`, payload()),
    onSuccess: (res) => {
      const updated = (res.data.data || res.data) as Plan
      queryClient.setQueryData(['plans'], (current: any) => {
        const list = (current || []) as Plan[]
        return list.map(p => p.id === updated.id ? updated : p)
      })
      setEditing(null)
      setForm(EMPTY_FORM)
      setFormOpen(false)
      toast({ title: L('Plan modifié'), variant: 'success' })
    },
    onError: (err: any) => toast({ title: L('Erreur'), description: err.response?.data?.message || err.response?.data?.error, variant: 'destructive' }),
  })

  const toggle = useMutation({
    mutationFn: (plan: Plan) => api.patch(`/plans/${plan.id}`, { isActive: !plan.isActive }),
    onSuccess: (res) => {
      const updated = (res.data.data || res.data) as Plan
      queryClient.setQueryData(['plans'], (current: any) => {
        const list = (current || []) as Plan[]
        return list.map(p => p.id === updated.id ? updated : p)
      })
    },
  })

  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`/plans/${id}`),
    onSuccess: (_res, id) => {
      queryClient.setQueryData(['plans'], (current: any) => {
        const list = (current || []) as Plan[]
        return list.filter(p => p.id !== id)
      })
      toast({ title: L('Plan supprimé'), variant: 'success' })
    },
    onError: (err: any) => toast({ title: L('Suppression impossible'), description: err.response?.data?.message || err.response?.data?.error, variant: 'destructive' }),
  })

  const startCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setFormOpen(true)
  }

  const startEdit = (plan: Plan) => {
    setEditing(plan)
    setForm({
      code: plan.code,
      name: plan.name,
      monthlyPrice: String(plan.monthlyPrice),
      durationMonths: String(plan.durationMonths),
      maxPractitioners: String(plan.maxPractitioners),
      maxAssistants: String(plan.maxAssistants),
      monthlyMessages: String(plan.monthlyMessages ?? 0),
      storageGb: String(plan.storageGb ?? 0),
      permissions: plan.permissions || [],
    })
    setFormOpen(true)
  }

  const setField = (field: keyof Form, value: string) => setForm(current => ({ ...current, [field]: value }))

  const setPermissions = (permissions: PermissionKey[]) => setForm(current => ({ ...current, permissions }))
  const togglePermission = (key: PermissionKey) => {
    setForm(current => ({
      ...current,
      permissions: current.permissions.includes(key)
        ? current.permissions.filter(p => p !== key)
        : [...current.permissions, key],
    }))
  }

  const formatPrice = (value: any) => Number(value || 0).toLocaleString('fr-FR').replace(/\s/g, ' ')

  // The three features that differ between plans, then how many of the others are included.
  const permissionBadges = (plan: Plan) => {
    const perms = plan.permissions || []
    const key: [PermissionKey, string][] = [['DENTAL_TREATMENT_PLAN', L('Plans de traitement')], ['ADVANCED_STATS', L('Stats avancées')], ['MULTI_SPECIALTY', L('Multi-spécialités')]]
    return (
      <div className="grid gap-1 text-[0.82rem]">
        <span className="text-[#5A6B65]">{perms.length} / {PERMISSIONS.length} {L('fonctions')}</span>
        <div className="flex flex-wrap gap-x-3 gap-y-0.5">
          {key.map(([k, label]) => (
            <span key={k} className={perms.includes(k) ? 'text-[#1E7A45]' : 'text-[#8A9A94] line-through'}>{perms.includes(k) ? '✓' : '✕'} {label}</span>
          ))}
        </div>
      </div>
    )
  }
  const limits = (plan: Plan) => `${plan.maxPractitioners} ${L(plan.maxPractitioners > 1 ? 'praticiens' : 'praticien')} · ${plan.maxAssistants >= 999 ? L('assistants illimités') : `${plan.maxAssistants} ${L(plan.maxAssistants > 1 ? 'assistants' : 'assistant')}`}`

  return (
    <div className="mx-auto max-w-8xl space-y-6">
      <AlertDialog open={deletePlan !== null} onOpenChange={(v) => !v && setDeletePlan(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{L('Supprimer le plan ?')}</AlertDialogTitle>
            <AlertDialogDescription>{L('Un plan utilisé par un cabinet ne peut pas être supprimé.')}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deletePlan) remove.mutate(deletePlan.id)
                setDeletePlan(null)
              }}
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <PageHeader
        title={t('nav.plans')}
        subtitle={L('Gérez les offres, les quotas et les permissions incluses.')}
        actions={<Button size="lg" className="gap-2" onClick={startCreate}><Plus size={18} /> {L('Nouveau plan')}</Button>}
      />

      {/* Phones: one card per plan */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:hidden">
        {(plans.data || []).map((plan, index) => (
          <Card key={plan.id} className={plan.isActive ? '' : 'opacity-70'}>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-[3px] border-white text-xs font-bold shadow-[0_10px_20px_-14px_rgba(18,112,90,0.7)] ${toneAt(index).chip}`}>{plan.code.slice(0, 3)}</span>
                  <div className="min-w-0">
                    <p className="truncate font-bold text-[#14231E]">{plan.name}</p>
                    <p className="text-sm font-semibold text-primary">{formatPrice(plan.monthlyPrice)} MAD <span className="font-normal text-[#5A6B65]">· {plan.durationMonths} {translateText('mois')}</span></p>
                  </div>
                </div>
                <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" title={L('Actions')}>
                            <MoreHorizontal size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(plan)}>
                            <Eye size={14} className="me-2" /> Voir
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => startEdit(plan)}>
                            <Pencil size={14} className="me-2" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggle.mutate(plan)}>
                            {plan.isActive ? L('Désactiver') : L('Activer')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletePlan(plan)}>
                            <Trash2 size={14} className="me-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#3F514A]">
                <Badge variant={plan.isActive ? 'success' : 'destructive'}>{plan.isActive ? t('common.active') : t('common.inactive')}</Badge>
                <span className="rounded-full bg-[#E9EFEC] px-2.5 py-1">{limits(plan)}</span>
                <span className="rounded-full bg-[#E9EFEC] px-2.5 py-1">{plan.monthlyMessages} messages/mois</span>
              </div>
              <div className="rounded-2xl bg-[#F2F5F3] p-2.5">{permissionBadges(plan)}</div>
            </CardContent>
          </Card>
        ))}
        {!plans.isLoading && (plans.data || []).length === 0 && (
          <Card className="sm:col-span-2"><CardContent className="p-0"><EmptyState icon={<Plus size={24} />} title={L('Aucun plan.')} action={<Button onClick={startCreate}>{L('Nouveau plan')}</Button>} /></CardContent></Card>
        )}
      </div>

      <Card className="hidden overflow-hidden lg:block">
        <CardHeader>
          <CardTitle>{L('Liste des plans')}</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t('table.plan')}</TableHead>
                <TableHead>{t('common.price')}</TableHead>
                <TableHead>{t('common.status')}</TableHead>
                <TableHead>{t('table.limits')}</TableHead>
                <TableHead>{t('table.permissions')}</TableHead>
                <TableHead className="text-end">{t('table.actions')}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(plans.data || []).map(plan => (
                <TableRow key={plan.id}>
                  <TableCell>
                    <div className="font-semibold text-[#14231E]">{plan.name}</div>
                    <div className="text-xs text-[#5A6B65]">{plan.code}</div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-semibold text-primary">{formatPrice(plan.monthlyPrice)} MAD</div>
                    <div className="text-xs text-muted-foreground">{plan.durationMonths} {translateText('mois')}</div>
                  </TableCell>
                  <TableCell>
                    <Badge variant={plan.isActive ? 'success' : 'destructive'}>{plan.isActive ? t('common.active') : t('common.inactive')}</Badge>
                  </TableCell>
                  <TableCell className="text-sm text-foreground">
                    {limits(plan)}
                  </TableCell>
                  <TableCell>{permissionBadges(plan)}</TableCell>
                  <TableCell className="text-end">
                    <div className="flex justify-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" title={L('Actions')}>
                            <MoreHorizontal size={18} />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => setViewing(plan)}>
                            <Eye size={14} className="me-2" /> Voir
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => startEdit(plan)}>
                            <Pencil size={14} className="me-2" /> Modifier
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toggle.mutate(plan)}>
                            {plan.isActive ? L('Désactiver') : L('Activer')}
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => setDeletePlan(plan)}>
                            <Trash2 size={14} className="me-2" /> Supprimer
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
              {!plans.isLoading && (plans.data || []).length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-sm text-muted-foreground">
                    {L('Aucun plan.')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={formOpen} onOpenChange={(open) => {
        if (!open) {
          setFormOpen(false)
          setEditing(null)
          setForm(EMPTY_FORM)
        } else {
          setFormOpen(true)
        }
      }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>{editing ? L('Modifier un plan') : L('Créer un plan')}</DialogTitle>
            <DialogDescription>{L('Définissez les quotas et les permissions incluses.')}</DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
            <div className="space-y-1.5"><Label>{L('Code')}</Label><Input value={form.code} onChange={e => setField('code', e.target.value)} placeholder={L('PRO')} /></div>
            <div className="space-y-1.5"><Label>{L('Nom')}</Label><Input value={form.name} onChange={e => setField('name', e.target.value)} placeholder={L('Professionnel')} /></div>
            <div className="space-y-1.5"><Label>{L('Prix')}</Label><Input type="number" min="0" value={form.monthlyPrice} onChange={e => setField('monthlyPrice', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{L('Durée (mois)')}</Label><Input type="number" min="1" value={form.durationMonths} onChange={e => setField('durationMonths', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{L('Praticiens max.')}</Label><Input type="number" min="1" value={form.maxPractitioners} onChange={e => setField('maxPractitioners', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{L('Assistants max.')}</Label><Input type="number" min="1" value={form.maxAssistants} onChange={e => setField('maxAssistants', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{L('Messages / mois')}</Label><Input type="number" min="0" value={form.monthlyMessages} onChange={e => setField('monthlyMessages', e.target.value)} /></div>
            <div className="space-y-1.5"><Label>{L('Stockage (Go)')}</Label><Input type="number" min="0" value={form.storageGb} onChange={e => setField('storageGb', e.target.value)} /></div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3">
              <Label>{L('Permissions incluses')}</Label>
              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setPermissions(PERMISSIONS.map(p => p.key))}>{L('Tout')}</Button>
                <Button type="button" variant="outline" size="sm" onClick={() => setPermissions([])}>{L('Aucun')}</Button>
              </div>
            </div>
            <ScrollArea className="mt-2 h-64 rounded-2xl border border-[#D8E1DD] bg-[#F2F5F3]">
              <div className="p-3">
                {Object.entries(PERMISSIONS_BY_MODULE).map(([module, perms], idx) => (
                  <div key={module}>
                    {idx > 0 && <Separator className="my-3" />}
                    <div className="text-xs font-semibold uppercase tracking-wide text-[#12705A]">{L(module)}</div>
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {perms.map(p => (
                        <label key={p.key} className="flex min-h-9 cursor-pointer items-center gap-2.5 rounded-xl bg-white px-2.5 py-1.5 text-sm text-[#14231E]">
                          <input
                            type="checkbox"
                            checked={form.permissions.includes(p.key)}
                            onChange={() => togglePermission(p.key)}
                            className="h-4 w-4 rounded border-border accent-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
                          />
                          <span>{L(p.label)}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
            <div className="mt-2 text-xs text-muted-foreground">{L('Aucune permission sélectionnée = aucune fonctionnalité accessible.')}</div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setFormOpen(false)}>{t('common.cancel')}</Button>
            <Button
              disabled={!form.code || !form.name || create.isPending || update.isPending}
              onClick={() => editing ? update.mutate() : create.mutate()}
            >
              {editing ? t('common.save') : t('common.create')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!viewing} onOpenChange={(open) => !open && setViewing(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{viewing?.name}</DialogTitle>
            <DialogDescription>{viewing?.code}</DialogDescription>
          </DialogHeader>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Card>
              <CardHeader><CardTitle className="text-base">{L('Tarif')}</CardTitle></CardHeader>
              <CardContent className="text-sm text-foreground">
                <div>{formatPrice(viewing?.monthlyPrice)} MAD</div>
                <div className="text-muted-foreground">{viewing?.durationMonths} {translateText('mois')}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">{L('Statut')}</CardTitle></CardHeader>
              <CardContent>
                {viewing && <Badge variant={viewing.isActive ? 'success' : 'destructive'}>{viewing.isActive ? t('common.active') : t('common.inactive')}</Badge>}
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-base">{L('Limites')}</CardTitle></CardHeader>
              <CardContent className="text-sm text-foreground">
                <div>{viewing ? limits(viewing) : null}</div>
              </CardContent>
            </Card>
            <Card className="sm:col-span-2">
              <CardHeader><CardTitle className="text-base">{L('Permissions incluses')}</CardTitle></CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {(viewing?.permissions || []).length === 0 && (
                    <span className="text-sm text-muted-foreground">{L('Aucune')}</span>
                  )}
                  {(viewing?.permissions || []).map(p => (
                    <Badge key={p} variant="secondary">{PERMISSION_LABELS[p] ? L(PERMISSION_LABELS[p]) : p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            {viewing && (
              <>
                <Button variant="outline" onClick={() => startEdit(viewing)}>{t('common.edit')}</Button>
                <Button variant="outline" onClick={() => toggle.mutate(viewing)}>{viewing.isActive ? L('Désactiver') : L('Activer')}</Button>
              </>
            )}
            <Button onClick={() => setViewing(null)}>{t('common.close')}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
