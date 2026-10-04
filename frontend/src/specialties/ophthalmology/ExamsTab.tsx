import { useState } from 'react'
import { useL } from '../../lib/labels'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { ClinicalRecord, today } from '../records'
import { COLORS, Empty, Field, RecordMeta, Section, toPoints, Trend } from '../ui'
import { emptyEye, Exam, EyeInputs, refraction, toEye, vaDecimal } from './shared'

type Props = { exams: ClinicalRecord<Exam>[]; onSave: (date: string, data: Exam, done: () => void) => void; onDelete: (id: string) => void; saving: boolean }

/** Eye exam of both eyes (acuity, refraction, pressure, pachymetry), with pressure and acuity curves. */
export default function ExamsTab({ exams, onSave, onDelete, saving }: Props) {
  const L = useL()
  const [od, setOd] = useState(emptyEye)
  const [os, setOs] = useState(emptyEye)
  const [exam, setExam] = useState({ date: today(), anteriorSegment: '', fundus: '', diagnosis: '' })
  const save = () => onSave(exam.date, { od: toEye(od), os: toEye(os), anteriorSegment: exam.anteriorSegment || null, fundus: exam.fundus || null, diagnosis: exam.diagnosis || null }, () => {
    setOd(emptyEye); setOs(emptyEye); setExam({ date: today(), anteriorSegment: '', fundus: '', diagnosis: '' })
  })
  const pressure = toPoints(exams.filter(e => e.data.od?.iop || e.data.os?.iop), r => ({ od: r.data.od?.iop ?? null, os: r.data.os?.iop ?? null }))
  const acuity = toPoints(exams.filter(e => vaDecimal(e.data.od?.vaCorrected) !== null || vaDecimal(e.data.os?.vaCorrected) !== null),
    r => ({ od: vaDecimal(r.data.od?.vaCorrected), os: vaDecimal(r.data.os?.vaCorrected) }))

  return (
    <div className="grid gap-5">
      <Section title={L('Nouvel examen')} hint={L('Acuité visuelle, réfraction, tonus et pachymétrie de chaque œil.')}>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); save() }}>
          <div className="grid gap-3 lg:grid-cols-2">
            <EyeInputs side="od" label="Œil droit (OD)" value={od} onChange={setOd} />
            <EyeInputs side="os" label="Œil gauche (OG)" value={os} onChange={setOs} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="eye-ant">{L('Segment antérieur')}</Label><Textarea id="eye-ant" rows={2} value={exam.anteriorSegment} onChange={e => setExam(x => ({ ...x, anteriorSegment: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="eye-fo">{L('Fond d’œil')}</Label><Textarea id="eye-fo" rows={2} value={exam.fundus} onChange={e => setExam(x => ({ ...x, fundus: e.target.value }))} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <Field id="eye-dx" label={L('Diagnostic')} value={exam.diagnosis} onChange={v => setExam(x => ({ ...x, diagnosis: v }))} placeholder={L('ex. Myopie, glaucome à angle ouvert…')} />
            <Field id="eye-date" label={L('Date')} type="date" value={exam.date} onChange={v => setExam(x => ({ ...x, date: v }))} />
            <Button type="submit" disabled={saving}>{L('Enregistrer l’examen')}</Button>
          </div>
        </form>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={L('Tonus oculaire')} hint={L('Pression intraoculaire de chaque œil ; au-delà de 21 mmHg, surveiller un glaucome.')}>
          <Trend data={pressure} unit="mmHg" series={[{ key: 'od', label: 'OD', color: COLORS.primary }, { key: 'os', label: L('OG'), color: COLORS.blue }]} references={[{ y: 21, label: '21 mmHg' }]} />
        </Section>
        <Section title={L('Acuité visuelle corrigée')} hint={L('En dixièmes (10/10 = 1,0).')}>
          <Trend data={acuity} series={[{ key: 'od', label: 'OD', color: COLORS.primary }, { key: 'os', label: L('OG'), color: COLORS.blue }]} />
        </Section>
      </div>

      <Section title={L('Examens précédents')}>
        {exams.length === 0 ? <Empty>{L('Aucun examen enregistré.')}</Empty> : (
          <ul className="grid gap-2.5 lg:grid-cols-2">
            {exams.map(r => (
              <li key={r.id} className="grid gap-1 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
                <RecordMeta record={r} onDelete={() => onDelete(r.id)} />
                {(['od', 'os'] as const).map(k => (
                  <p key={k}><b>{L(k === 'od' ? 'OD' : 'OG')}</b> {r.data[k]?.va || '—'} → {r.data[k]?.vaCorrected || '—'} · {refraction(r.data[k] || {})}
                    {r.data[k]?.iop ? ` · ${r.data[k]!.iop} mmHg` : ''}{r.data[k]?.cct ? ` · ${L('pachy')} ${r.data[k]!.cct} µm` : ''}</p>
                ))}
                {r.data.diagnosis && <p className="font-semibold">{r.data.diagnosis}</p>}
                {r.data.anteriorSegment && <p className="text-[#5A6B65]">{L('SA')} : {r.data.anteriorSegment}</p>}
                {r.data.fundus && <p className="text-[#5A6B65]">{L('FO')} : {r.data.fundus}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
