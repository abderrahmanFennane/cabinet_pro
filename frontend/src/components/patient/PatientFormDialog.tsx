import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { AlertTriangle } from 'lucide-react'
import api from '../../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi, useTeam } from '../../lib/hooks'
import { COVERAGES, Coverage, Patient } from '../../types'
import { namesInsurer } from '../../lib/insurance'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { NativeSelect } from '../ui/native-select'
import { useL } from '../../lib/labels'

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  patient?: Patient | null
  onSaved?: (patient: Patient) => void
}

// Who each Moroccan basic coverage is for, shown under the choice.
const COVERAGE_HINT: Record<Coverage, string> = {
  CNSS: 'AMO des salariés du privé et des indépendants (CNSS).',
  CNOPS: 'AMO des fonctionnaires et agents de l’État, gérée par la CNSS depuis la loi 54.23 (ex-CNOPS).',
  AMO_TADAMON: 'Ex-RAMED : AMO prise en charge par l’État, gérée par la CNSS.',
  FAR: 'Militaires et leurs familles (Forces armées royales).',
  MUTUELLE: 'Mutuelle seule, sans AMO.',
  PRIVATE: 'Assurance santé privée seule (contrat individuel ou de l’employeur).',
  NONE: 'Le patient paie lui-même, sans remboursement.',
}
// Common complementary covers in Morocco; free text stays possible.
const COMPLEMENTARY = [
  'MGPAP', 'OMFAM', 'MODEP', 'CMIM', 'Mutuelle des FAR', 'Wafa Assurance', 'Sanlam (ex-Saham)', 'AXA Assurance Maroc', 'RMA',
  'AtlantaSanad', 'Allianz Maroc', 'MAMDA-MCMA', 'La Marocaine Vie',
]

const empty = {
  firstName: '', lastName: '', sex: '', birthDate: '', cin: '', phone: '', email: '', address: '', coverage: 'NONE' as Coverage, coverageNumber: '',
  insuredName: '', complementaryInsurance: '', complementaryNumber: '',
  primaryPractitionerId: '', consentData: true, consentReminders: true, notes: '',
  bloodGroup: '', allergies: '', medicalHistory: '', surgicalHistory: '', familyHistory: '', currentTreatments: '',
}

export default function PatientFormDialog({ open, onOpenChange, patient, onSaved }: Props) {
  const L = useL()
  const { t } = useTranslation()
  const { hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const { data: team = [] } = useTeam()
  const medical = hasPermissions('VIEW_MEDICAL')
  const [form, setForm] = useState(empty)
  const [debounced, setDebounced] = useState(form)
  // New patient: the short form (what the reception needs); editing shows everything.
  const [more, setMore] = useState(false)
  const set = (key: keyof typeof empty) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.type === 'checkbox' ? (e.target as HTMLInputElement).checked : e.target.value }))

  useEffect(() => {
    if (!open) return
    setMore(!!patient)
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
        phone: form.phone || null, email: form.email || null, address: form.address || null, coverage: form.coverage,
        coverageNumber: form.coverage === 'NONE' ? null : form.coverageNumber || null, insuredName: form.coverage === 'NONE' ? null : form.insuredName || null,
        complementaryInsurance: form.complementaryInsurance.trim() || null,
        complementaryNumber: form.complementaryInsurance.trim() && !namesInsurer(form.coverage) ? form.complementaryNumber || null : null,
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
      toast.success(patient ? L('Patient mis à jour') : L('Patient créé'))
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
          <DialogTitle>{patient ? L('Modifier le patient') : L('Nouveau patient')}</DialogTitle>
          <DialogDescription>{L('Les champs médicaux ne sont visibles que par les praticiens.')}</DialogDescription>
        </DialogHeader>
        <form className="space-y-5" onSubmit={(e) => { e.preventDefault(); save.mutate() }}>
          {duplicates.length > 0 && (
            <div className="flex gap-2 rounded-xl border border-[#FFE0A3] bg-[#FFF8E6] p-3 text-sm text-[#8A5A00]">
              <AlertTriangle size={18} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">{L('Patient peut-être déjà enregistré :')}</p>
                <ul>{duplicates.map(d => <li key={d.id}>{d.lastName} {d.firstName}{d.phone ? ` · ${d.phone}` : ''}{d.cin ? ` · CIN ${d.cin}` : ''}</li>)}</ul>
              </div>
            </div>
          )}

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">{L('Identité')}</legend>
            <div className="space-y-1.5"><Label htmlFor="lastName">{L('Nom')}</Label><Input id="lastName" value={form.lastName} onChange={set('lastName')} required autoFocus /></div>
            <div className="space-y-1.5"><Label htmlFor="firstName">{L('Prénom')}</Label><Input id="firstName" value={form.firstName} onChange={set('firstName')} required /></div>
            <div className="space-y-1.5"><Label htmlFor="phone">{L('Téléphone')}</Label><Input id="phone" type="tel" value={form.phone} onChange={set('phone')} /></div>
            <div className="space-y-1.5"><Label htmlFor="birthDate">{L('Date de naissance')}</Label><Input id="birthDate" type="date" value={form.birthDate} onChange={set('birthDate')} /></div>
            <div className="space-y-1.5"><Label htmlFor="sex">{L('Sexe')}</Label>
              <NativeSelect id="sex" value={form.sex} onChange={set('sex')}><option value="">—</option><option value="F">{L('Femme')}</option><option value="M">{L('Homme')}</option></NativeSelect>
            </div>
            {more && <>
              <div className="space-y-1.5"><Label htmlFor="cin">{L('CIN')}</Label><Input id="cin" value={form.cin} onChange={set('cin')} /></div>
              <div className="space-y-1.5"><Label htmlFor="email">{L('Email')}</Label><Input id="email" type="email" value={form.email} onChange={set('email')} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="address">{L('Adresse')}</Label><Input id="address" value={form.address} onChange={set('address')} /></div>
            </>}
          </fieldset>

          <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">{L('Assurance maladie')}</legend>
            <div className="space-y-1.5"><Label htmlFor="coverage">{L('Couverture de base')}</Label>
              <NativeSelect id="coverage" value={form.coverage} onChange={set('coverage')}>
                {COVERAGES.map(c => <option key={c} value={c}>{t(`coverage.${c}`)}</option>)}
              </NativeSelect>
              <p className="text-xs text-[#5A6B65]">{L(COVERAGE_HINT[form.coverage])}</p>
            </div>
            {/* Private insurance or mutuelle alone: ask which company; otherwise this field is the top-up cover below. */}
            {namesInsurer(form.coverage) && (
              <div className="space-y-1.5"><Label htmlFor="complementaryInsurance">{form.coverage === 'MUTUELLE' ? L('Nom de la mutuelle') : L('Nom de l’assurance')}</Label>
                <Input id="complementaryInsurance" list="complementary-list" value={form.complementaryInsurance} onChange={set('complementaryInsurance')} placeholder={L('ex. Wafa Assurance')} />
              </div>
            )}
            {form.coverage !== 'NONE' && (
              <div className="space-y-1.5"><Label htmlFor="coverageNumber">{namesInsurer(form.coverage) ? L('N° d’adhérent / de police') : L('N° d’immatriculation')}</Label><Input id="coverageNumber" value={form.coverageNumber} onChange={set('coverageNumber')} /></div>
            )}
            {more && form.coverage !== 'NONE' && (
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="insuredName">{L('Assuré principal, si ce n’est pas le patient')}</Label><Input id="insuredName" value={form.insuredName} onChange={set('insuredName')} placeholder={L('ex. Mehdi Tazi (père)')} /></div>
            )}
            {more && !namesInsurer(form.coverage) && (
              <div className="space-y-1.5"><Label htmlFor="complementaryInsurance">{L('Complémentaire (mutuelle ou assurance)')}</Label>
                <Input id="complementaryInsurance" list="complementary-list" value={form.complementaryInsurance} onChange={set('complementaryInsurance')} placeholder={L('Aucune')} />
              </div>
            )}
            {more && !namesInsurer(form.coverage) && form.complementaryInsurance && (
              <div className="space-y-1.5"><Label htmlFor="complementaryNumber">{L('N° d’adhérent complémentaire')}</Label><Input id="complementaryNumber" value={form.complementaryNumber} onChange={set('complementaryNumber')} /></div>
            )}
            <datalist id="complementary-list">{COMPLEMENTARY.map(name => <option key={name} value={name} />)}</datalist>
          </fieldset>

          {more && <fieldset className="grid gap-3 sm:grid-cols-2">
            <legend className="mb-2 text-sm font-semibold">{L('Suivi')}</legend>
            <div className="space-y-1.5"><Label htmlFor="practitioner">{L('Praticien référent')}</Label>
              <NativeSelect id="practitioner" value={form.primaryPractitionerId} onChange={set('primaryPractitionerId')}>
                <option value="">—</option>
                {practitioners.map(p => <option key={p.id} value={p.id}>{practitionerName(p)}</option>)}
              </NativeSelect>
            </div>
          </fieldset>}

          {medical && (
            <fieldset className="grid gap-3 sm:grid-cols-2">
              <legend className="mb-2 text-sm font-semibold">{L('Antécédents (confidentiel)')}</legend>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="allergies">{L('Allergies (séparées par des virgules)')}</Label><Input id="allergies" value={form.allergies} onChange={set('allergies')} placeholder={L('ex. Pénicilline, latex')} /></div>
              {more && <>
              <div className="space-y-1.5"><Label htmlFor="medicalHistory">{L('Médicaux')}</Label><Textarea id="medicalHistory" rows={2} value={form.medicalHistory} onChange={set('medicalHistory')} /></div>
              <div className="space-y-1.5"><Label htmlFor="surgicalHistory">{L('Chirurgicaux')}</Label><Textarea id="surgicalHistory" rows={2} value={form.surgicalHistory} onChange={set('surgicalHistory')} /></div>
              <div className="space-y-1.5"><Label htmlFor="familyHistory">{L('Familiaux')}</Label><Textarea id="familyHistory" rows={2} value={form.familyHistory} onChange={set('familyHistory')} /></div>
              <div className="space-y-1.5"><Label htmlFor="currentTreatments">{L('Traitements en cours')}</Label><Textarea id="currentTreatments" rows={2} value={form.currentTreatments} onChange={set('currentTreatments')} /></div>
              <div className="space-y-1.5"><Label htmlFor="bloodGroup">{L('Groupe sanguin')}</Label>
                <NativeSelect id="bloodGroup" value={form.bloodGroup} onChange={set('bloodGroup')}>
                  <option value="">—</option>
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map(g => <option key={g}>{g}</option>)}
                </NativeSelect>
              </div>
              </>}
            </fieldset>
          )}

          {!more && (
            <button type="button" className="text-sm font-semibold text-primary" onClick={() => setMore(true)}>
              + {L('Plus de détails')} <span className="font-normal text-[#5A6B65]">({L('CIN, email, adresse, complémentaire, antécédents…')})</span>
            </button>
          )}

          <fieldset className="space-y-2 rounded-xl bg-muted p-3 text-sm">
            <legend className="sr-only">{L('Consentements')}</legend>
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#12705A]" checked={form.consentData} onChange={set('consentData')} />{L('Le patient consent au traitement de ses données de santé par le cabinet (loi 09-08).')}</label>
            <label className="flex items-start gap-2"><input type="checkbox" className="mt-1 h-4 w-4 accent-[#12705A]" checked={form.consentReminders} onChange={set('consentReminders')} />{L('Le patient accepte de recevoir des rappels de rendez-vous par WhatsApp / SMS.')}</label>
          </fieldset>

          <Button type="submit" className="w-full" disabled={save.isPending}>{patient ? L('Enregistrer') : L('Créer le patient')}</Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
