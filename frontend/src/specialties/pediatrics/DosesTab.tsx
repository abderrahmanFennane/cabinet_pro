import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Printer } from 'lucide-react'
import api from '../../lib/api'
import { apiError, useCabinetApi, useCabinetPath } from '../../lib/hooks'
import { useL } from '../../lib/labels'
import { cn, formatDateFR } from '../../lib/utils'
import { Patient } from '../../types'
import { Button } from '../../components/ui/button'
import { ClinicalRecord } from '../records'
import { Field, Section } from '../ui'
import { allergic, DRUGS, doseFor, Drug } from './calc'
import { ageLabel, Birth, Growth, monthsBetween } from './shared'

const RHYTHM: Record<number, string> = { 1: '1 fois par jour', 2: 'matin et soir', 3: '3 fois par jour (toutes les 8 heures)', 4: 'toutes les 6 heures, 4 fois par jour au maximum' }

/** Prescription line, in French as printed on the prescription. */
function line(drug: Drug, weight: number) {
  const d = doseFor(drug, weight)
  const dosage = drug.volumeOnly ? `${d.ml} mL au total, par petites gorgées`
    : d.ml != null ? `${d.ml} mL (${d.mg} mg) ${RHYTHM[drug.dosesPerDay]}`
    : `${d.mg} mg ${drug.dosesPerDay === 1 ? 'le matin' : RHYTHM[drug.dosesPerDay]}`
  return { drug: `${drug.name}, ${drug.form}`, dosage, duration: drug.duration }
}

/** Usual oral doses calculated from the child's weight; the chosen lines become a prescription. */
export default function DosesTab({ patient, growth, birth }: { patient: Patient; growth: ClinicalRecord<Growth>[]; birth?: Birth }) {
  const L = useL()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const queryClient = useQueryClient()
  const lastWeight = growth.find(g => g.data.weight)
  const [weight, setWeight] = useState(lastWeight?.data.weight ? String(lastWeight.data.weight) : '')
  const [picked, setPicked] = useState<string[]>([])
  const kg = Number(weight.replace(',', '.')) || 0
  const age = patient.birthDate ? monthsBetween(new Date(patient.birthDate), new Date()) : null
  // Allergies noted in the pediatric file or in the patient's general record.
  const allergies = [birth?.allergies, patient.allergies].filter(Boolean).join(' ; ')

  const create = useMutation({
    mutationFn: async () => (await api.post(`${cabinetApi}/patients/${patient.id}/prescriptions`, {
      items: DRUGS.filter(d => picked.includes(d.code)).map(d => line(d, kg)), notes: `Poids : ${kg} kg`,
    })).data.data as { id: string },
    onSuccess: (rx) => {
      toast.success(L('Ordonnance créée'))
      queryClient.invalidateQueries({ queryKey: ['prescriptions', patient.id] })
      setPicked([])
      window.open(cabinetPath(`/print/prescription/${patient.id}/${rx.id}`), '_blank')
    },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <Section title={L('Doses selon le poids')} hint={L('Doses orales usuelles en pédiatrie. Vérifiez l’indication, les contre-indications et la concentration du produit délivré : le médecin reste seul juge.')}>
      <div className="grid gap-3 sm:grid-cols-[180px_1fr] sm:items-end">
        <Field id="dose-kg" label={L('Poids')} unit="kg" type="number" value={weight} onChange={setWeight} />
        <p className="text-[0.86rem] text-[#5A6B65]">
          {lastWeight ? `${L('Dernière pesée')} : ${lastWeight.data.weight} kg ${L('le')} ${formatDateFR(lastWeight.date)}` : L('Aucune pesée enregistrée : saisissez le poids du jour.')}
          {age !== null ? ` · ${L('Âge')} : ${ageLabel(age, L)}` : ''}
        </p>
      </div>
      {kg > 0 ? (
        <ul className="grid gap-2">
          {DRUGS.map(d => {
            const r = doseFor(d, kg)
            const tooYoung = d.minAgeMonths != null && age !== null && age < d.minAgeMonths
            const allergy = allergic(d, allergies)
            const on = picked.includes(d.code)
            return (
              <li key={d.code}>
                <label className={cn('grid cursor-pointer gap-1 rounded-xl border px-3 py-2.5 text-[0.9rem] sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-3',
                  tooYoung || allergy ? 'border-[#F6CFCA] bg-[#FDF3F2]' : on ? 'border-primary bg-[#EAF5F0]' : 'border-[#E3EAE7] hover:bg-[#F4F7F6]')}>
                  <input type="checkbox" className="h-4 w-4 accent-[#12705A]" checked={on} disabled={tooYoung || allergy} onChange={e => setPicked(p => (e.target.checked ? [...p, d.code] : p.filter(x => x !== d.code)))} />
                  <span className="min-w-0">
                    <b>{d.name}</b> <span className="text-[#5A6B65]">· {L(d.form)}</span>
                    <span className="block text-[0.8rem] text-[#5A6B65]">{L(d.note)}{tooYoung ? ` ${L('Pas avant')} ${ageLabel(d.minAgeMonths!, L)}.` : ''}</span>
                    {allergy && <span className="block text-[0.8rem] font-bold text-[#B8372C]">{L('Allergie notée dans le dossier')} : {allergies}</span>}
                  </span>
                  <span className="text-end font-semibold tabular-nums">
                    {d.volumeOnly ? `${r.ml} mL` : r.ml != null ? <>{r.ml} mL <span className="font-normal text-[#5A6B65]">({r.mg} mg)</span></> : `${r.mg} mg`}
                    <span className="block text-[0.78rem] font-normal text-[#5A6B65]">{d.volumeOnly ? L('sur 4 heures') : `${L(RHYTHM[d.dosesPerDay])}${r.capped ? ` · ${L('dose maximale atteinte')}` : ''}`}</span>
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      ) : <p className="rounded-xl border border-dashed border-[#D8E1DD] p-4 text-center text-[0.9rem] text-[#5A6B65]">{L('Saisissez le poids pour calculer les doses.')}</p>}
      <div className="flex justify-end">
        <Button disabled={!picked.length || !kg || create.isPending} onClick={() => create.mutate()}><Printer size={16} className="me-1.5" />{L('Créer l’ordonnance')} {picked.length ? `(${picked.length})` : ''}</Button>
      </div>
    </Section>
  )
}
