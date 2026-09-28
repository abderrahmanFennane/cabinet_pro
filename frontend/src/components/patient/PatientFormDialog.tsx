import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import api from '../../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi, useTeam } from '../../lib/hooks'
import { Coverage, Patient } from '../../types'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { NativeSelect } from '../ui/native-select'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient?: Patient | null
  onSaved?: (patient: Patient) => void
}

const empty = {
  firstName: '', lastName: '', sex: '', birthDate: '', cin: '', phone: '', email: '', address: '', coverage: 'NONE' as Coverage, coverageNumber: '',
  primaryPractitionerId: '', consentData: true, consentReminders: true, notes: '',
  bloodGroup: '', allergies: '', medicalHistory: '', surgicalHistory: '', familyHistory: '', currentTreatments: '',
}

export default function PatientFormDialog({ open, onOpenChange, patient, onSaved }: Props) {
  const { t } = useTranslation()
  const { hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const { data: team = [] } = useTeam()
  const medical = hasPermissions('VIEW_MEDICAL')
  const [form, setForm] = useState(empty)
  const [debounced, setDebounced] = useState(form)
  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  useEffect(() => {
    if (!open) return
    setForm(patient ? {
      ...empty,
      ...Object.fromEntries(Object.entries(patient).map(([k, v]) => [k, v ?? ''])),
      birthDate: patient.birthDate ? patient.birthDate.slice(0, 10) : '',
      consentData: !!patient.consentDataAt,
      consentReminders: !!patient.consentRemindersAt,
    } as typeof empty : empty)
  }, [open, patient])

  useEffect(() => {
    const id = setTimeout(() => setDebounced(form), 400)
    return () => clearTimeout(id)
  }, [form])

  // F-PAT-03: duplicate detection while creating.
  const { data: duplicates = [] } = useQuery({
    queryKey: ['duplicates', debounced.firstName, debounced.lastName, debounced.phone, debounced.cin],
    queryFn: async () => (await api.get(`${cabinetApi}/patients/duplicates`, { params: { firstName: debounced.firstName, lastName: debounced.lastName, phone: debounced.phone, cin: debounced.cin } })).data.data as Patient[],
    enabled: open && !patient && !!((debounced.firstName && debounced.lastName) || debounced.phone.length >= 6 || debounced.cin),
    refetchInterval: false,
  })

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        firstName: form.firstName, lastName: form.lastName, sex: form.sex || null, birthDate: form.birthDate || null, cin: form.cin || null,
        phone: form.phone || null, email: form.email || null, address: form.address || null, coverage: form.coverage, coverageNumber: form.coverageNumber || null,
        primaryPractitionerId: form.primaryPractitionerId || null, consentData: form.consentData, consentReminders: form.consentReminders, notes: form.notes || null,
      }
      if (medical) {
        Object.assign(payload, {
          bloodGroup: form.bloodGroup || null, allergies: form.allergies || null, medicalHistory: form.medicalHistory || null,
          surgicalHistory: form.surgicalHistory || null, familyHistory: form.familyHistory || null, currentTreatments: form.currentTreatments || null,
        })
      }
      const res = patient ? await api.patch(`${cabinetApi}/patients/${patient.id}`, payload) : await api.post(`${cabinetApi}/patients`, payload)
      return res.data.data as Patient
    },
    onSuccess: (saved) => {
      toast.success(patient ? 'Patient mis à jour' : 'Patient créé')
      queryClient.invalidateQueries({ queryKey: ['patients'] })
      queryClient.invalidateQueries({ queryKey: ['patient', saved.id] })
      onOpenChange(false)
      onSaved?.(saved)
    },
    onError: (err) => toast.error(apiError(err)),
  })

  const practitioners = team.filter(u => u.role === 'OWNER' || u.role === 'PRACTITIONER')

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{patient ? 'Modifier le patient' : 'Nouveau patient'}</DialogTitle>
          <DialogDescription>Les champs médicaux ne sont visibles que par les praticiens.</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
          {duplicates.length > 0 && (
            <div className="flex gap-2 rounded-xl border border-[#FFE0A3] bg-[#FFF8E6] p-3 text-sm text-[#8A5A00]">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Patient peut-être déjà enregistré :</p>
                <ul>{duplicates.map(d => <li key={d.id}>{d.lastName} {d.firstName}{d.phone ? ` · ${d.phone}` : ''}{d.cin ? ` · CIN ${d.cin}` : ''}</li>)}</ul>
              </div>
            </div>
          )}

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">Identité</legend>
            <div className="space-y-1.5"><Label htmlFor="lastName">Nom</Label><Input id="lastName" value={form.lastName} onChange={set('lastName')} required autoFocus /></div>
            <div className="space-y-1.5"><Label htmlFor="firstName">Prénom</Label><Input id="firstName" value={form.firstName} onChange={set('firstName')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="birthDate">Date de naissance</Label><Input id="birthDate" type="date" value={form.birthDate} onChange={set('birthDate')} /></div>
            <div className="space-y-1.5"><Label htmlFor="sex">Sexe</Label>
              <NativeSelect id="sex" value={form.sex} onChange={set('sex')}><option value="">—</option><option value="F">Femme</option><option value="M">Homme</option></NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="cin">CIN</Label><Input id="cin" value={form.cin} onChange={set('cin')} /></div>
            <div className="space-y-1.5"><Label htmlFor="phone">Téléphone</Label><Input id="phone" type="tel" value={form.phone} onChange={set('phone')} /></div>
            <div className="space-y-1.5"><Label htmlFor="email">Email</Label><Input id="email" type="email" value={form.email} onChange={set('email')} /></div>
            <div className="space-y-1.5"><Label htmlFor="address">Adresse</Label><Input id="address" value={form.address} onChange={set('address')} /></div>
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-3">
            <legend className="mb-2 text-sm font-semibold">Couverture et suivi</legend>
            <div className="space-y-1.5"><Label htmlFor="coverage">Couverture</Label>
              <NativeSelect id="coverage" value={form.coverage} onChange={set('coverage')}>
                {(['AMO', 'CNOPS', 'MUTUELLE', 'NONE'] as Coverage[]).map(c => <option key={c} value={c}>{t(`coverage.${c}`)}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="coverageNumber">N° d’affiliation</Label><Input id="coverageNumber" value={form.coverageNumber} onChange={set('coverageNumber')} disabled={form.coverage === 'NONE'} /></div>
            <div className="space-y-1.5"><Label htmlFor="practitioner">Praticien référent</Label>
              <NativeSelect id="practitioner" value={form.primaryPractitionerId} onChange={set('primaryPractitionerId')}>
                <option value="">—</option>
                {practitioners.map(p => <option key={p.id} value={p.id}>{practitionerName(p)}</option>)}
              </NativeSelect>
            </div>
          </fieldset>

          {medical && (
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-semibold">Antécédents (confidentiel)</legend>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="allergies">Allergies (séparées par des virgules)</Label><Input id="allergies" value={form.allergies} onChange={set('allergies')} placeholder="ex. Pénicilline, latex" /></div>
              <div className="space-y-1.5"><Label htmlFor="medicalHistory">Médicaux</Label><Textarea id="medicalHistory" rows={2} value={form.medicalHistory} onChange={set('medicalHistory')} /></div>
              <div className="space-y-1.5"><Label htmlFor="surgicalHistory">Chirurgicaux</Label><Textarea id="surgicalHistory" rows={2} value={form.surgicalHistory} onChange={set('surgicalHistory')} /></div>
              <div className="space-y-1.5"><Label htmlFor="familyHistory">Familiaux</Label><Textarea id="familyHistory" rows={2} value={form.familyHistory} onChange={set('familyHistory')} /></div>
              <div className="space-y-1.5"><Label htmlFor="currentTreatments">Traitements en cours</Label><Textarea id="currentTreatments" rows={2} value={form.currentTreatments} onChange={set('currentTreatments')} /></div>
              <div className="space-y-1.5"><Label htmlFor="bloodGroup">Groupe sanguin</Label>
                <NativeSelect id="bloodGroup" value={form.bloodGroup} onChange={set('bloodGroup')}>
                  <option value="">—</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g}>{g}</option>)}
                </NativeSelect>
              </div>
            </fieldset>
          )}

          <fieldset className="space-y-2 rounded-xl bg-muted p-3 text-sm">
            <legend className="sr-only">Consentements</legend>
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#12705A]" checked={form.consentData} onChange={set('consentData')} />Le patient consent au traitement de ses données de santé par le cabinet (loi 09-08).</label>
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#12705A]" checked={form.consentReminders} onChange={set('consentReminders')} />Le patient accepte de recevoir des rappels de rendez-vous par WhatsApp / SMS.</label>
          </fieldset>

          <Button type="submit" className="w-full" disabled={save.isPending}>{patient ? 'Enregistrer' : 'Créer le patient'}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
