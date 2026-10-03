import { useState } from 'react'
import { Printer } from 'lucide-react'
import { formatDateFR } from '../lib/utils'
import { Patient } from '../types'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { NativeSelect } from '../components/ui/native-select'
import { cleanNumbers, today, useRecords } from './records'
import { COLORS, Empty, Field, RecordMeta, Section, toPoints, Trend } from './ui'

type Eye = { va?: string | null; vaCorrected?: string | null; sphere?: number | null; cylinder?: number | null; axis?: number | null; add?: number | null; iop?: number | null }
type Exam = { od: Eye; os: Eye; anteriorSegment?: string | null; fundus?: string | null; diagnosis?: string | null; notes?: string | null }
type Glasses = { od: Eye; os: Eye; pd?: number | null; usage: 'DISTANCE' | 'NEAR' | 'PROGRESSIVE' | 'BIFOCAL'; notes?: string | null }

const EYE_NUMBERS = ['sphere', 'cylinder', 'axis', 'add', 'iop']
const emptyEye = { va: '', vaCorrected: '', sphere: '', cylinder: '', axis: '', add: '', iop: '' }
const USAGE: Record<Glasses['usage'], string> = { DISTANCE: 'Vision de loin', NEAR: 'Vision de près', PROGRESSIVE: 'Verres progressifs', BIFOCAL: 'Double foyer' }

/** +1.25 / -0.50 / plan, as written on an optical prescription. */
const diopter = (v?: number | null) => (v === null || v === undefined ? '—' : v === 0 ? 'plan' : `${v > 0 ? '+' : ''}${v.toFixed(2)}`)
const refraction = (e: Eye) => [diopter(e.sphere), e.cylinder ? `(${diopter(e.cylinder)} à ${e.axis ?? '?'}°)` : null, e.add ? `Add ${diopter(e.add)}` : null].filter(Boolean).join(' ')

function EyeInputs({ side, label, value, onChange, withExam = true }: { side: string; label: string; value: typeof emptyEye; onChange: (v: typeof emptyEye) => void; withExam?: boolean }) {
  const set = (key: keyof typeof emptyEye) => (v: string) => onChange({ ...value, [key]: v })
  return (
    <fieldset className="grid grid-cols-2 gap-2.5 rounded-xl bg-[#F2F5F3] p-3 sm:grid-cols-3">
      <legend className="sr-only">{label}</legend>
      <p className="col-span-full text-[0.8rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{label}</p>
      {withExam && <Field id={`${side}-va`} label="AV sans correction" value={value.va} onChange={set('va')} placeholder="4/10" />}
      {withExam && <Field id={`${side}-vac`} label="AV corrigée" value={value.vaCorrected} onChange={set('vaCorrected')} placeholder="10/10" />}
      <Field id={`${side}-sph`} label="Sphère" type="number" step="0.25" value={value.sphere} onChange={set('sphere')} unit="δ" />
      <Field id={`${side}-cyl`} label="Cylindre" type="number" step="0.25" value={value.cylinder} onChange={set('cylinder')} unit="δ" />
      <Field id={`${side}-axe`} label="Axe" type="number" step="1" value={value.axis} onChange={set('axis')} unit="°" />
      <Field id={`${side}-add`} label="Addition" type="number" step="0.25" value={value.add} onChange={set('add')} unit="δ" />
      {withExam && <Field id={`${side}-iop`} label="Tonus" type="number" step="1" value={value.iop} onChange={set('iop')} unit="mmHg" />}
    </fieldset>
  )
}

const toEye = (v: typeof emptyEye): Eye => cleanNumbers(v, EYE_NUMBERS) as Eye
const fromEye = (e: Eye) => ({ ...emptyEye, ...Object.fromEntries(Object.entries(e || {}).map(([k, v]) => [k, v === null || v === undefined ? '' : String(v)])) })

/** Prints an optical prescription on its own page. */
function printGlasses(patient: Patient, g: Glasses, date: string) {
  const row = (label: string, e: Eye) => `<tr><td>${label}</td><td>${diopter(e.sphere)}</td><td>${e.cylinder ? diopter(e.cylinder) : '—'}</td><td>${e.cylinder ? `${e.axis ?? ''}°` : '—'}</td><td>${e.add ? diopter(e.add) : '—'}</td></tr>`
  const w = window.open('', '_blank', 'width=800,height=900')
  if (!w) return
  w.document.write(`<html><head><title>Ordonnance de lunettes</title><style>body{font-family:Segoe UI,Arial,sans-serif;padding:40px;color:#14231E}h1{font-size:20px}table{border-collapse:collapse;width:100%;margin:18px 0}td,th{border:1px solid #ccc;padding:8px;text-align:center}th{background:#f2f5f3}</style></head><body>
    <h1>Ordonnance de verres correcteurs</h1><p>Le ${formatDateFR(date)}</p>
    <p><b>${patient.lastName.toUpperCase()} ${patient.firstName}</b>${patient.age !== null ? `, ${patient.age} ans` : ''}</p>
    <table><tr><th></th><th>Sphère</th><th>Cylindre</th><th>Axe</th><th>Addition</th></tr>${row('Œil droit (OD)', g.od)}${row('Œil gauche (OG)', g.os)}</table>
    <p>${USAGE[g.usage]}${g.pd ? ` · Écart pupillaire : ${g.pd} mm` : ''}</p>${g.notes ? `<p>${g.notes}</p>` : ''}
    <p style="margin-top:60px;text-align:right">Signature et cachet</p></body></html>`)
  w.document.close()
  w.focus()
  w.print()
}

/** Ophthalmology: eye exam for each eye, pressure follow-up, glasses prescriptions. */
export default function Ophthalmology({ patient }: { patient: Patient }) {
  const { ofKind, save, remove, isLoading } = useRecords(patient.id, 'OPHTHALMOLOGY')
  const exams = ofKind<Exam>('EYE_EXAM')
  const glasses = ofKind<Glasses>('GLASSES')
  const [od, setOd] = useState(emptyEye)
  const [os, setOs] = useState(emptyEye)
  const [exam, setExam] = useState({ date: today(), anteriorSegment: '', fundus: '', diagnosis: '' })
  const [gOd, setGOd] = useState(emptyEye)
  const [gOs, setGOs] = useState(emptyEye)
  const [g, setG] = useState({ usage: 'DISTANCE' as Glasses['usage'], pd: '', notes: '' })

  const saveExam = () => save.mutate({ kind: 'EYE_EXAM', date: exam.date, data: { od: toEye(od), os: toEye(os), anteriorSegment: exam.anteriorSegment || null, fundus: exam.fundus || null, diagnosis: exam.diagnosis || null } }, {
    onSuccess: () => { setOd(emptyEye); setOs(emptyEye); setExam({ date: today(), anteriorSegment: '', fundus: '', diagnosis: '' }) },
  })
  const fromLastExam = () => { if (exams[0]) { setGOd(fromEye(exams[0].data.od)); setGOs(fromEye(exams[0].data.os)) } }
  const saveGlasses = () => save.mutate({ kind: 'GLASSES', data: { od: toEye(gOd), os: toEye(gOs), usage: g.usage, pd: g.pd ? Number(g.pd) : null, notes: g.notes || null } }, {
    onSuccess: () => { setGOd(emptyEye); setGOs(emptyEye); setG({ usage: 'DISTANCE', pd: '', notes: '' }) },
  })
  const pressure = toPoints(exams.filter(e => e.data.od?.iop || e.data.os?.iop), r => ({ od: r.data.od?.iop ?? null, os: r.data.os?.iop ?? null }))

  if (isLoading) return <p className="py-8 text-center text-[#5A6B65]">Chargement…</p>

  return (
    <div className="grid gap-5">
      <Section title="Nouvel examen" hint="Acuité visuelle, réfraction et tonus de chaque œil.">
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); saveExam() }}>
          <div className="grid gap-3 lg:grid-cols-2">
            <EyeInputs side="od" label="Œil droit (OD)" value={od} onChange={setOd} />
            <EyeInputs side="os" label="Œil gauche (OG)" value={os} onChange={setOs} />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="eye-ant">Segment antérieur</Label><Textarea id="eye-ant" rows={2} value={exam.anteriorSegment} onChange={e => setExam(x => ({ ...x, anteriorSegment: e.target.value }))} /></div>
            <div className="space-y-1.5"><Label htmlFor="eye-fo">Fond d’œil</Label><Textarea id="eye-fo" rows={2} value={exam.fundus} onChange={e => setExam(x => ({ ...x, fundus: e.target.value }))} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_180px_auto] sm:items-end">
            <Field id="eye-dx" label="Diagnostic" value={exam.diagnosis} onChange={v => setExam(x => ({ ...x, diagnosis: v }))} placeholder="ex. Myopie, glaucome à angle ouvert…" />
            <Field id="eye-date" label="Date" type="date" value={exam.date} onChange={v => setExam(x => ({ ...x, date: v }))} />
            <Button type="submit" disabled={save.isPending}>Enregistrer l’examen</Button>
          </div>
        </form>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Tonus oculaire" hint="Pression intraoculaire de chaque œil ; au-delà de 21 mmHg, surveiller un glaucome.">
          <Trend data={pressure} unit="mmHg" series={[{ key: 'od', label: 'OD', color: COLORS.primary }, { key: 'os', label: 'OG', color: COLORS.blue }]} references={[{ y: 21, label: '21 mmHg' }]} />
        </Section>
        <Section title="Examens précédents">
          {exams.length === 0 ? <Empty>Aucun examen enregistré.</Empty> : (
            <ul className="grid gap-2.5">
              {exams.map(r => (
                <li key={r.id} className="grid gap-1 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
                  <RecordMeta record={r} onDelete={() => remove.mutate(r.id)} />
                  <p><b>OD</b> {r.data.od?.va || '—'} → {r.data.od?.vaCorrected || '—'} · {refraction(r.data.od || {})}{r.data.od?.iop ? ` · ${r.data.od.iop} mmHg` : ''}</p>
                  <p><b>OG</b> {r.data.os?.va || '—'} → {r.data.os?.vaCorrected || '—'} · {refraction(r.data.os || {})}{r.data.os?.iop ? ` · ${r.data.os.iop} mmHg` : ''}</p>
                  {r.data.diagnosis && <p className="font-semibold">{r.data.diagnosis}</p>}
                  {r.data.fundus && <p className="text-[#5A6B65]">FO : {r.data.fundus}</p>}
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>

      <Section title="Ordonnance de lunettes" hint="Reprenez la réfraction du dernier examen ou saisissez-la, puis imprimez."
        action={exams.length > 0 ? <Button type="button" variant="outline" size="sm" onClick={fromLastExam}>Reprendre le dernier examen</Button> : undefined}>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); saveGlasses() }}>
          <div className="grid gap-3 lg:grid-cols-2">
            <EyeInputs side="god" label="Œil droit (OD)" value={gOd} onChange={setGOd} withExam={false} />
            <EyeInputs side="gos" label="Œil gauche (OG)" value={gOs} onChange={setGOs} withExam={false} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[200px_160px_1fr_auto] sm:items-end">
            <div className="space-y-1.5"><Label htmlFor="g-usage">Type de verres</Label>
              <NativeSelect id="g-usage" value={g.usage} onChange={e => setG(x => ({ ...x, usage: e.target.value as Glasses['usage'] }))}>
                {Object.entries(USAGE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </NativeSelect>
            </div>
            <Field id="g-pd" label="Écart pupillaire" type="number" step="0.5" unit="mm" value={g.pd} onChange={v => setG(x => ({ ...x, pd: v }))} />
            <Field id="g-notes" label="Remarques" value={g.notes} onChange={v => setG(x => ({ ...x, notes: v }))} placeholder="ex. Antireflet, photochromique" />
            <Button type="submit" disabled={save.isPending}>Enregistrer</Button>
          </div>
        </form>
        {glasses.length > 0 && (
          <ul className="grid gap-2 border-t border-[#E3EAE7] pt-3">
            {glasses.map(r => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-[0.9rem]">
                <span><span className="font-mono text-[#5A6B65]">{formatDateFR(r.date)}</span> · {USAGE[r.data.usage]} · OD {refraction(r.data.od)} · OG {refraction(r.data.os)}</span>
                <span className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={() => printGlasses(patient, r.data, r.date)}><Printer size={15} className="me-1" />Imprimer</Button>
                  <RecordMeta record={r} onDelete={() => remove.mutate(r.id)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
