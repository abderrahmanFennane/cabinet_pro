import { useMemo, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { FileText } from 'lucide-react'
import { toast } from 'sonner'
import api from '../../lib/api'
import { useL } from '../../lib/labels'
import { apiError, practitionerName, useAuth, useCabinetApi, useCabinetPath } from '../../lib/hooks'
import { cn, formatDateFR } from '../../lib/utils'
import { Patient } from '../../types'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord, today } from '../records'
import { DeleteButton, Empty, Field, RecordMeta, Section } from '../ui'
import { iolTable } from './iol'
import { Biometry, diopter, num, SHORT, Side, SIDE_LABEL, Surgery } from './shared'

type Props = {
  patient: Patient; biometries: ClinicalRecord<Biometry>[]; surgeries: ClinicalRecord<Surgery>[]
  onSave: (kind: 'BIOMETRY' | 'SURGERY', date: string, data: Biometry | Surgery, done: () => void) => void; onDelete: (id: string) => void; saving: boolean
}

/** Cataract surgery: biometry with the implant power (SRK/T), and the operation report. */
export default function SurgeryTab({ patient, biometries, surgeries, onSave, onDelete, saving }: Props) {
  const L = useL()
  const { user } = useAuth()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const queryClient = useQueryClient()
  const blankBio = { date: today(), eye: 'OD' as Side, device: 'IOLMaster', k1: '', k2: '', axialLength: '', acd: '', aConstant: '118.7', targetRefraction: '0', iolModel: '', chosenPower: '', notes: '' }
  const [b, setB] = useState(blankBio)
  const blankSx = { date: today(), eye: 'OD' as Side, procedure: 'Phacoémulsification avec implant en chambre postérieure', anesthesia: 'Topique', iolModel: '', iolPower: '', complications: '', report: '', postOp: '' }
  const [s, setS] = useState(blankSx)
  const setBio = (k: keyof typeof blankBio) => (v: string) => setB(x => ({ ...x, [k]: v }))
  const setSx = (k: keyof typeof blankSx) => (v: string) => setS(x => ({ ...x, [k]: v }))

  const calc = useMemo(() => {
    const [al, k1, k2, a] = [num(b.axialLength), num(b.k1), num(b.k2), num(b.aConstant)]
    if (!al || !k1 || !k2 || !a || al < 18 || al > 36 || k1 < 35 || k2 < 35 || k1 > 55 || k2 > 55) return null
    return iolTable({ axialLength: al, k1, k2, aConstant: a, targetRefraction: num(b.targetRefraction) ?? 0 })
  }, [b])

  const saveBio = () => onSave('BIOMETRY', b.date, {
    eye: b.eye, device: b.device || null, k1: num(b.k1), k2: num(b.k2), axialLength: num(b.axialLength), acd: num(b.acd), aConstant: num(b.aConstant),
    targetRefraction: num(b.targetRefraction), iolModel: b.iolModel || null, chosenPower: num(b.chosenPower), notes: b.notes || null,
  }, () => setB({ ...blankBio, eye: b.eye }))
  const applyBiometry = (r: ClinicalRecord<Biometry>) => setS(x => ({ ...x, eye: r.data.eye, iolModel: r.data.iolModel || '', iolPower: r.data.chosenPower?.toString() || '' }))
  const saveSx = () => onSave('SURGERY', s.date, {
    eye: s.eye, procedure: s.procedure, anesthesia: s.anesthesia || null, iolModel: s.iolModel || null, iolPower: num(s.iolPower),
    complications: s.complications || null, report: s.report || null, postOp: s.postOp || null,
  }, () => setS({ ...blankSx, eye: s.eye }))

  // The report as a medical document: printable, kept in Documents, can be sent to the patient.
  const toDocument = useMutation({
    mutationFn: async (r: ClinicalRecord<Surgery>) => {
      const d = r.data
      const body = [
        `Opéré(e) : ${patient.firstName} ${patient.lastName.toUpperCase()}${patient.age !== null ? `, ${patient.age} ans` : ''}`,
        `Date de l’intervention : ${formatDateFR(r.date)}`, `Œil opéré : ${SIDE_LABEL[d.eye]}`, `Intervention : ${d.procedure}`,
        d.anesthesia && `Anesthésie : ${d.anesthesia}`, (d.iolModel || d.iolPower != null) && `Implant : ${[d.iolModel, d.iolPower != null ? `${diopter(d.iolPower)} δ` : null].filter(Boolean).join(' ')}`,
        '', d.report || '', '', d.complications ? `Incidents / complications : ${d.complications}` : 'Pas d’incident peropératoire.', d.postOp && `\nSuites et consignes : ${d.postOp}`,
        '', `Opérateur : ${practitionerName(user as any)}`,
      ].filter(x => x !== null && x !== undefined && x !== false).join('\n')
      return (await api.post(`${cabinetApi}/patients/${patient.id}/documents`, { type: 'OTHER', title: 'Compte rendu opératoire', body })).data.data as { id: string }
    },
    onSuccess: (doc) => { toast.success(L('Compte rendu créé (onglet Documents)')); queryClient.invalidateQueries({ queryKey: ['documents'] }); window.open(cabinetPath(`/print/document/${patient.id}/${doc.id}`), '_blank') },
    onError: (err) => toast.error(apiError(err)),
  })

  const eyeSelect = (id: string, value: Side, on: (v: Side) => void) => (
    <div className="space-y-1.5"><Label htmlFor={id}>{L('Œil')}</Label>
      <NativeSelect id={id} value={value} onChange={e => on(e.target.value as Side)}>{(['OD', 'OS'] as Side[]).map(x => <option key={x} value={x}>{L(SIDE_LABEL[x])}</option>)}</NativeSelect>
    </div>
  )

  return (
    <div className="grid gap-5">
      <Section title={L('Biométrie et calcul d’implant')} hint={L('Formule SRK/T. Aide au contrôle : décidez avec le calcul de votre biomètre.')}>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); saveBio() }}>
          <div className="grid gap-3 sm:grid-cols-4">
            {eyeSelect('bi-eye', b.eye, v => setB(x => ({ ...x, eye: v })))}
            <Field id="bi-dev" label={L('Biomètre')} value={b.device} onChange={setBio('device')} placeholder="IOLMaster, Lenstar…" />
            <Field id="bi-al" label={L('Longueur axiale')} type="number" step="0.01" unit="mm" value={b.axialLength} onChange={setBio('axialLength')} />
            <Field id="bi-acd" label={L('Profondeur de chambre antérieure')} type="number" step="0.01" unit="mm" value={b.acd} onChange={setBio('acd')} />
            <Field id="bi-k1" label="K1" type="number" step="0.01" unit="δ" value={b.k1} onChange={setBio('k1')} />
            <Field id="bi-k2" label="K2" type="number" step="0.01" unit="δ" value={b.k2} onChange={setBio('k2')} />
            <Field id="bi-a" label={L('Constante A de l’implant')} type="number" step="0.1" value={b.aConstant} onChange={setBio('aConstant')} />
            <Field id="bi-t" label={L('Réfraction visée')} type="number" step="0.25" unit="δ" value={b.targetRefraction} onChange={setBio('targetRefraction')} />
          </div>
          {calc ? (
            <div className="grid gap-2 rounded-xl bg-[#F2F5F3] p-3 sm:grid-cols-[auto_1fr] sm:items-start sm:gap-5">
              <div>
                <p className="text-[0.8rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{L('Puissance calculée')}</p>
                <p className="text-3xl font-extrabold tabular-nums text-primary">{calc.exact.toFixed(2)} δ</p>
                <p className="text-[0.8rem] text-[#5A6B65]">{L('pour une réfraction de')} {diopter(num(b.targetRefraction) ?? 0)}</p>
              </div>
              <table className="w-full max-w-sm text-[0.88rem]">
                <thead className="text-[0.72rem] uppercase tracking-[0.07em] text-[#5A6B65]"><tr><th className="text-start">{L('Implant')}</th><th className="text-end">{L('Réfraction prévue')}</th></tr></thead>
                <tbody>
                  {calc.rows.map(r => (
                    <tr key={r.power} className={cn('border-t border-[#D8E1DD] cursor-pointer hover:bg-white', num(b.chosenPower) === r.power && 'bg-white font-bold')} onClick={() => setB(x => ({ ...x, chosenPower: String(r.power) }))}>
                      <td className="py-1 font-mono">{diopter(r.power)}</td><td className="py-1 text-end font-mono">{diopter(Math.round(r.refraction * 100) / 100)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <Empty>{L('Saisissez la longueur axiale, K1, K2 et la constante A pour voir le calcul.')}</Empty>}
          <div className="grid gap-3 sm:grid-cols-[1fr_160px_160px_auto] sm:items-end">
            <Field id="bi-model" label={L('Modèle d’implant')} value={b.iolModel} onChange={setBio('iolModel')} />
            <Field id="bi-pow" label={L('Puissance choisie')} type="number" step="0.5" unit="δ" value={b.chosenPower} onChange={setBio('chosenPower')} />
            <Field id="bi-date" label={L('Date')} type="date" value={b.date} onChange={setBio('date')} />
            <Button type="submit" disabled={saving || !b.axialLength}>{L('Enregistrer la biométrie')}</Button>
          </div>
        </form>
        {biometries.length > 0 && (
          <ul className="grid gap-2 border-t border-[#E3EAE7] pt-3 text-[0.9rem]">
            {biometries.map(r => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2">
                <span><span className="font-mono text-[#5A6B65]">{formatDateFR(r.date)}</span> · <b>{L(SHORT[r.data.eye])}</b> · LA {r.data.axialLength} mm · K {r.data.k1}/{r.data.k2}
                  {r.data.chosenPower != null && <> · {L('implant')} <b>{diopter(r.data.chosenPower)}</b>{r.data.iolModel ? ` ${r.data.iolModel}` : ''}</>}</span>
                <span className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => applyBiometry(r)}>{L('Utiliser pour l’intervention')}</Button>
                  <DeleteButton onDelete={() => onDelete(r.id)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={L('Compte rendu opératoire')} hint={L('Enregistré dans le dossier ; transformable en document imprimable et envoyable au patient.')}>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); saveSx() }}>
          <div className="grid gap-3 sm:grid-cols-4">
            {eyeSelect('sx-eye', s.eye, v => setS(x => ({ ...x, eye: v })))}
            <Field id="sx-date" label={L('Date')} type="date" value={s.date} onChange={setSx('date')} />
            <Field id="sx-an" label={L('Anesthésie')} value={s.anesthesia} onChange={setSx('anesthesia')} />
            <Field id="sx-pow" label={L('Puissance de l’implant')} type="number" step="0.5" unit="δ" value={s.iolPower} onChange={setSx('iolPower')} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <Field id="sx-proc" label={L('Intervention')} value={s.procedure} onChange={setSx('procedure')} />
            <Field id="sx-model" label={L('Modèle d’implant')} value={s.iolModel} onChange={setSx('iolModel')} />
          </div>
          <div className="space-y-1.5"><Label htmlFor="sx-rep">{L('Déroulement')}</Label><Textarea id="sx-rep" rows={4} value={s.report} onChange={e => setSx('report')(e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field id="sx-comp" label={L('Incidents / complications')} value={s.complications} onChange={setSx('complications')} />
            <Field id="sx-post" label={L('Consignes postopératoires')} value={s.postOp} onChange={setSx('postOp')} />
            <Button type="submit" disabled={saving || !s.procedure.trim()}>{L('Enregistrer')}</Button>
          </div>
        </form>
        {surgeries.length === 0 ? <Empty>{L('Aucune intervention enregistrée.')}</Empty> : (
          <ul className="grid gap-2 border-t border-[#E3EAE7] pt-3 text-[0.9rem]">
            {surgeries.map(r => (
              <li key={r.id} className="grid gap-1 rounded-xl border border-[#E3EAE7] p-3">
                <RecordMeta record={r} onDelete={() => onDelete(r.id)} />
                <p><b>{L(SHORT[r.data.eye])}</b> · {r.data.procedure}{r.data.iolPower != null ? ` · ${L('implant')} ${diopter(r.data.iolPower)}${r.data.iolModel ? ` ${r.data.iolModel}` : ''}` : ''}</p>
                {r.data.complications && <p className="text-[#B8372C]">{r.data.complications}</p>}
                <Button size="sm" variant="outline" className="justify-self-start" disabled={toDocument.isPending} onClick={() => toDocument.mutate(r)}><FileText size={15} className="me-1" />{L('Créer le compte rendu imprimable')}</Button>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
