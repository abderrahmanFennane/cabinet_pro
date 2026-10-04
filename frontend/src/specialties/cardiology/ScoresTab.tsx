import { useEffect, useState } from 'react'
import { useL } from '../../lib/labels'
import { cn, formatDateFR } from '../../lib/utils'
import { Patient } from '../../types'
import { Button } from '../../components/ui/button'
import { ClinicalRecord } from '../records'
import { Empty, RecordMeta, Section } from '../ui'
import { chadsvasc, chadsvascAdvice, hasbled, ScoreInput } from './calc'
import { ageYears, Badge, Risk, Scores } from './shared'

type Flags = Omit<Scores, 'chadsvasc' | 'hasbled' | 'notes'>
const none: Flags = { chf: false, hypertension: false, diabetes: false, strokeTia: false, vascular: false, uncontrolledHtn: false, renal: false, liver: false, bleeding: false, labileInr: false, drugs: false, alcohol: false }

// [key, label, points]
const CHA: [keyof Flags, string, number][] = [
  ['chf', 'Insuffisance cardiaque / dysfonction VG', 1], ['hypertension', 'Hypertension', 1], ['diabetes', 'Diabète', 1],
  ['strokeTia', 'AVC / AIT / embolie antérieurs', 2], ['vascular', 'Maladie vasculaire (IDM, AOMI, plaque aortique)', 1],
]
const BLED: [keyof Flags, string, number][] = [
  ['uncontrolledHtn', 'HTA non contrôlée (PAS > 160)', 1], ['renal', 'Insuffisance rénale (dialyse, greffe, créat > 200 µmol/L)', 1],
  ['liver', 'Atteinte hépatique (cirrhose, bilirubine > 2N)', 1], ['strokeTia', 'AVC antérieur', 1], ['bleeding', 'Saignement ou prédisposition', 1],
  ['labileInr', 'INR instable (< 60 % du temps dans la cible)', 1], ['drugs', 'Antiagrégant ou AINS', 1], ['alcohol', 'Alcool (≥ 8 verres / semaine)', 1],
]

/** CHA2DS2-VASc and HAS-BLED, age and sex taken from the patient file; the saved scores keep the history. */
export default function ScoresTab({ patient, scores, risk, saving, onSave, onDelete }: {
  patient: Patient; scores: ClinicalRecord<Scores>[]; risk?: Risk; saving: boolean
  onSave: (data: object) => void; onDelete: (id: string) => void
}) {
  const L = useL()
  const age = ageYears(patient.birthDate)
  const female = patient.sex === 'F'
  const [f, setF] = useState<Flags>(none)
  // Start from the last scoring, or from the risk factors already ticked in the follow-up.
  useEffect(() => {
    if (scores[0]) setF({ ...none, ...scores[0].data })
    else if (risk) setF(x => ({ ...x, hypertension: !!risk.hypertension, diabetes: !!risk.diabetes }))
  }, [scores[0]?.id, !!risk])
  const input: ScoreInput = { ...f, age, female }
  const cha = chadsvasc(input)
  const bled = hasbled(input)
  const advice = chadsvascAdvice(cha, female)

  const box = (list: [keyof Flags, string, number][], prefix: string) => (
    <div className="grid gap-1.5">
      {list.map(([k, label, pts]) => (
        <label key={prefix + k} className={cn('flex cursor-pointer items-center justify-between gap-3 rounded-xl border px-3 py-2 text-[0.9rem]', f[k] ? 'border-primary bg-[#EAF5F0]' : 'border-[#E3EAE7] bg-white hover:bg-[#F4F7F6]')}>
          <span className="flex items-center gap-2.5"><input type="checkbox" className="h-4 w-4 accent-[#12705A]" checked={f[k]} onChange={e => setF(x => ({ ...x, [k]: e.target.checked }))} />{L(label)}</span>
          <span className="font-mono text-[#5A6B65]">+{pts}</span>
        </label>
      ))}
    </div>
  )
  const auto = (label: string, pts: number) => (
    <div className="flex items-center justify-between rounded-xl bg-[#F4F7F6] px-3 py-2 text-[0.9rem]"><span>{label}</span><span className="font-mono text-[#5A6B65]">+{pts}</span></div>
  )

  return (
    <div className="grid gap-5">
      {age === null && <p className="rounded-xl bg-[#FBEED6] px-3 py-2 text-[0.88rem] text-[#99600B]">{L('Date de naissance absente du dossier : l’âge n’est pas compté dans les scores.')}</p>}
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="CHA₂DS₂-VASc" hint={L('Risque d’AVC en cas de fibrillation atriale.')}
          action={<span className="text-3xl font-bold text-primary">{cha}</span>}>
          {box(CHA, 'c')}
          {auto(`${L('Âge')} ${age ?? '?'} ${L('ans')} (${L('65–74 : +1, ≥ 75 : +2')})`, (age ?? 0) >= 75 ? 2 : (age ?? 0) >= 65 ? 1 : 0)}
          {auto(`${L('Sexe féminin')}${female ? '' : ` (${L('non')})`}`, female ? 1 : 0)}
          <p className={cn('rounded-xl px-3 py-2 text-[0.9rem] font-semibold', advice === 'RECOMMENDED' ? 'bg-[#FBE3E0] text-[#B8372C]' : advice === 'CONSIDER' ? 'bg-[#FBEED6] text-[#99600B]' : 'bg-[#DFF1E6] text-[#1E7A45]')}>
            {advice === 'RECOMMENDED' ? L('Anticoagulation orale recommandée (ESC 2020).') : advice === 'CONSIDER' ? L('Anticoagulation orale à envisager (ESC 2020).') : L('Pas d’anticoagulation au titre de la FA.')}
          </p>
        </Section>
        <Section title="HAS-BLED" hint={L('Risque hémorragique sous anticoagulant.')}
          action={<span className={cn('text-3xl font-bold', bled >= 3 ? 'text-[#B8372C]' : 'text-primary')}>{bled}</span>}>
          {box(BLED, 'b')}
          {auto(`${L('Âge > 65 ans')} (${age ?? '?'})`, (age ?? 0) > 65 ? 1 : 0)}
          <p className={cn('rounded-xl px-3 py-2 text-[0.9rem] font-semibold', bled >= 3 ? 'bg-[#FBE3E0] text-[#B8372C]' : 'bg-[#DFF1E6] text-[#1E7A45]')}>
            {bled >= 3 ? L('Risque élevé : corriger les facteurs modifiables et surveiller de près. Ce n’est pas une contre-indication en soi.') : L('Risque hémorragique faible à modéré.')}
          </p>
        </Section>
      </div>
      <div className="flex justify-end"><Button disabled={saving} onClick={() => onSave({ ...f, chadsvasc: cha, hasbled: bled })}>{L('Enregistrer les scores')}</Button></div>
      <Section title={L('Scores précédents')}>
        {scores.length === 0 ? <Empty>{L('Aucun score enregistré.')}</Empty> : (
          <ul className="grid gap-2">
            {scores.map(r => (
              <li key={r.id} className="grid gap-1 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
                <RecordMeta record={r} onDelete={() => onDelete(r.id)} />
                <p className="flex flex-wrap gap-2"><Badge tone={(r.data.chadsvasc ?? 0) >= 2 ? 'bad' : 'ok'}>CHA₂DS₂-VASc {r.data.chadsvasc}</Badge><Badge tone={(r.data.hasbled ?? 0) >= 3 ? 'bad' : 'ok'}>HAS-BLED {r.data.hasbled}</Badge></p>
              </li>
            ))}
          </ul>
        )}
      </Section>
      <p className="text-[0.8rem] text-[#5A6B65]">{L('Aide à la décision : le médecin reste seul juge du traitement.')} {scores[0] ? `${L('Dernier calcul le')} ${formatDateFR(scores[0].date)}.` : ''}</p>
    </div>
  )
}
