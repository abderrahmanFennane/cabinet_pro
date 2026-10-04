import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import api from '../../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi, useCabinetPath } from '../../lib/hooks'
import { useL } from '../../lib/labels'
import { formatDateFR } from '../../lib/utils'
import { Patient } from '../../types'
import { dueDate, gestationalAge } from './calc'

export type Pregnancy = {
  lmp: string; status: 'ONGOING' | 'DELIVERED' | 'ENDED'; gravidity?: number | null; parity?: number | null; outcome?: string | null; notes?: string | null
  datingLmp?: string | null; fetuses?: number | null; bloodGroup?: 'A' | 'B' | 'AB' | 'O' | null; rhesus?: 'POS' | 'NEG' | null; risk?: string | null
  deliveryDate?: string | null; deliveryMode?: 'VAGINAL' | 'CESAREAN' | 'INSTRUMENTAL' | null; babyWeight?: number | null; babySex?: 'F' | 'M' | null
}
export type Visit = { pregnancyId: string; type: 'VISIT' | 'ULTRASOUND' | 'LAB'; weight?: number | null; systolic?: number | null; diastolic?: number | null; fundalHeight?: number | null; fetalHeartRate?: number | null; notes?: string | null }
export type Followup = { contraception?: string | null; lastSmear?: string | null; cycle?: string | null; notes?: string | null; lastHpv?: string | null; hpvResult?: 'NEGATIVE' | 'POSITIVE' | null; lastMammogram?: string | null }
export type PrenatalCheck = { pregnancyId: string; code: string; result?: string | null }
export type Ultrasound = {
  pregnancyId: string; fetus?: number | null; crl?: number | null; nuchal?: number | null; bpd?: number | null; hc?: number | null; ac?: number | null; fl?: number | null; efw?: number | null
  fetalHeartRate?: number | null; presentation?: 'CEPHALIC' | 'BREECH' | 'TRANSVERSE' | null; placenta?: string | null; amnioticFluid?: 'NORMAL' | 'OLIGO' | 'HYDRAMNIOS' | null
  morphology?: string | null; conclusion?: string | null; attachmentId?: string | null
}
export type PastPregnancy = { year?: number | null; outcome: 'VAGINAL' | 'CESAREAN' | 'MISCARRIAGE' | 'ECTOPIC' | 'TERMINATION' | 'STILLBIRTH'; weeks?: number | null; babyWeight?: number | null; complications?: string | null }

export const VISIT_TYPE: Record<Visit['type'], string> = { VISIT: 'Consultation', ULTRASOUND: 'Échographie', LAB: 'Bilan' }
export const STATUS: Record<Pregnancy['status'], string> = { ONGOING: 'En cours', DELIVERED: 'Accouchée', ENDED: 'Interrompue' }
export const DELIVERY: Record<NonNullable<Pregnancy['deliveryMode']>, string> = { VAGINAL: 'Voie basse', CESAREAN: 'Césarienne', INSTRUMENTAL: 'Voie basse instrumentale' }
export const PAST_OUTCOME: Record<PastPregnancy['outcome'], string> = {
  VAGINAL: 'Accouchement par voie basse', CESAREAN: 'Césarienne', MISCARRIAGE: 'Fausse couche', ECTOPIC: 'Grossesse extra-utérine', TERMINATION: 'Interruption de grossesse', STILLBIRTH: 'Mort fœtale in utero',
}
export const PRESENTATION: Record<NonNullable<Ultrasound['presentation']>, string> = { CEPHALIC: 'Céphalique', BREECH: 'Siège', TRANSVERSE: 'Transverse' }
export const FLUID: Record<NonNullable<Ultrasound['amnioticFluid']>, string> = { NORMAL: 'Normal', OLIGO: 'Oligoamnios', HYDRAMNIOS: 'Hydramnios' }

/** LMP used for every calculation: the one corrected by the dating ultrasound when there is one. */
export const lmpOf = (p: Pregnancy) => p.datingLmp || p.lmp

/** Gravidity and parity from the history plus the current pregnancy: births at 22 SA or more count for parity. */
export function gravidityParity(past: PastPregnancy[], current: boolean) {
  const births = past.filter(p => p.outcome === 'VAGINAL' || p.outcome === 'CESAREAN' || (p.outcome === 'STILLBIRTH' && (p.weeks ?? 22) >= 22)).length
  return { g: past.length + (current ? 1 : 0), p: births, cesareans: past.filter(p => p.outcome === 'CESAREAN').length }
}

/** Pregnancy declaration (certificate for the employer, the insurer and the civil-status file), prefilled from the record. */
export function useDeclaration(patient: Patient) {
  const L = useL()
  const { user } = useAuth()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (p: Pregnancy) => {
      const lmp = lmpOf(p)
      const g = gestationalAge(lmp)
      const start = new Date(new Date(`${lmp}T00:00:00`).getTime() + 14 * 86_400_000)
      const body = `Je soussigné(e), ${practitionerName(user as any)}, certifie que Mme ${patient.firstName} ${patient.lastName.toUpperCase()}`
        + `${patient.birthDate ? `, née le ${formatDateFR(patient.birthDate)}` : ''}${patient.cin ? `, CIN ${patient.cin}` : ''},`
        + ` est enceinte${p.fetuses && p.fetuses > 1 ? ` (grossesse ${p.fetuses === 2 ? 'gémellaire' : 'multiple'})` : ''}.\n\nDate des dernières règles : ${formatDateFR(p.lmp)}`
        + `${p.datingLmp ? `\nDatation corrigée par l’échographie du 1er trimestre` : ''}`
        + `\nDébut présumé de la grossesse : ${formatDateFR(start.toISOString())}`
        + `\nÂge de la grossesse ce jour : ${g.weeks} semaines d’aménorrhée${g.days ? ` et ${g.days} jour(s)` : ''}`
        + `\nDate présumée de l’accouchement : ${formatDateFR(dueDate(lmp).toISOString())}`
        + `${p.gravidity != null ? `\nGestité / parité : G${p.gravidity} P${p.parity ?? 0}` : ''}`
        + `\n\nCertificat établi à la demande de l’intéressée et remis en main propre pour servir et valoir ce que de droit.`
      return (await api.post(`${cabinetApi}/patients/${patient.id}/documents`, { type: 'PREGNANCY_DECLARATION', title: 'Déclaration de grossesse', body })).data.data as { id: string }
    },
    onSuccess: (doc) => {
      toast.success(L('Déclaration de grossesse créée (onglet Documents)'))
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      window.open(cabinetPath(`/print/document/${patient.id}/${doc.id}`), '_blank')
    },
    onError: (err) => toast.error(apiError(err)),
  })
}
