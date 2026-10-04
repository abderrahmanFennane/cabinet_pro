import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Printer } from 'lucide-react'
import api from '../../lib/api'
import { useL } from '../../lib/labels'
import { practitionerName, useAuth, useCabinetId } from '../../lib/hooks'
import { formatDateFR } from '../../lib/utils'
import { Cabinet, Patient } from '../../types'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord, cleanNumbers, today } from '../records'
import { DeleteButton, Empty, Field, Section } from '../ui'
import { ContactLens, diopter, emptyEye, Exam, EyeInputs, fromEye, Glasses, GlassesEye, Lens, refraction, toEye } from './shared'

const USAGE: Record<Glasses['usage'], string> = { DISTANCE: 'Vision de loin', NEAR: 'Vision de près', PROGRESSIVE: 'Verres progressifs', BIFOCAL: 'Double foyer' }
const BASE: Record<NonNullable<GlassesEye['base']>, string> = { UP: 'base supérieure', DOWN: 'base inférieure', IN: 'base nasale', OUT: 'base temporale' }
const LENS_TYPE: Record<ContactLens['lensType'], string> = { SOFT: 'Souples sphériques', TORIC: 'Souples toriques', MULTIFOCAL: 'Multifocales', RGP: 'Rigides perméables (LRPG)', ORTHO_K: 'Orthokératologie', OTHER: 'Autres' }
const REPLACEMENT: Record<ContactLens['replacement'], string> = { DAILY: 'Journalières', TWO_WEEKS: 'Bimensuelles', MONTHLY: 'Mensuelles', YEARLY: 'Annuelles', OTHER: 'Autre' }

const esc = (s: unknown) => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]!))

/** Optical prescription on its own page, with the cabinet's letterhead (always in French, the language of the opticians' forms). */
function printOptical(cabinet: Cabinet | undefined, doctor: string, patient: Patient, title: string, date: string, body: string) {
  const w = window.open('', '_blank', 'width=820,height=980')
  if (!w) return
  w.document.write(`<html><head><title>${esc(title)}</title><style>
    body{font-family:Segoe UI,Arial,sans-serif;padding:36px;color:#14231E;font-size:13px}h1{font-size:19px;letter-spacing:.06em;text-align:center;margin:26px 0 14px}
    header{display:flex;justify-content:space-between;border-bottom:2px solid #12705A;padding-bottom:12px}header p{margin:2px 0}
    table{border-collapse:collapse;width:100%;margin:14px 0}td,th{border:1px solid #bbb;padding:7px;text-align:center}th{background:#f2f5f3}
    .sig{margin-top:56px;text-align:right}.muted{color:#5A6B65}</style></head><body>
    <header><div><p><b>${esc(cabinet?.name)}</b></p>${cabinet?.letterhead ? `<p style="white-space:pre-line">${esc(cabinet.letterhead)}</p>` : ''}</div>
    <div style="text-align:right">${[cabinet?.address, cabinet?.city, cabinet?.phone && `Tél. ${cabinet.phone}`].filter(Boolean).map(x => `<p>${esc(x)}</p>`).join('')}</div></header>
    <p style="text-align:right;margin-top:14px">Le ${formatDateFR(date)}</p>
    <p><b>${esc(patient.lastName.toUpperCase())} ${esc(patient.firstName)}</b>${patient.age !== null ? `, ${patient.age} ans` : ''}</p>
    <h1>${esc(title.toUpperCase())}</h1>${body}
    <p class="sig">${esc(doctor)}<br><span class="muted">Signature et cachet</span></p></body></html>`)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 300)
}

const emptyPrism = { prism: '', base: '', pd: '' }
const emptyLens = { power: '', cylinder: '', axis: '', add: '', baseCurve: '', diameter: '', brand: '' }
const LENS_NUMBERS = ['power', 'cylinder', 'axis', 'add', 'baseCurve', 'diameter']

type Props = {
  patient: Patient; exams: ClinicalRecord<Exam>[]; glasses: ClinicalRecord<Glasses>[]; lenses: ClinicalRecord<ContactLens>[]
  onSave: (kind: 'GLASSES' | 'CONTACT_LENS', data: Glasses | ContactLens, done: () => void) => void; onDelete: (id: string) => void; saving: boolean
}

export default function PrescriptionsTab({ patient, exams, glasses, lenses, onSave, onDelete, saving }: Props) {
  const L = useL()
  const { user } = useAuth()
  const cabinetId = useCabinetId()
  const { data: cabinet } = useQuery({ queryKey: ['cabinet', cabinetId], queryFn: async () => (await api.get(`/cabinets/${cabinetId}`)).data.data as Cabinet, enabled: !!cabinetId })
  const doctor = practitionerName(user as any)

  const [gOd, setGOd] = useState(emptyEye)
  const [gOs, setGOs] = useState(emptyEye)
  const [pOd, setPOd] = useState(emptyPrism)
  const [pOs, setPOs] = useState(emptyPrism)
  const [g, setG] = useState({ usage: 'DISTANCE' as Glasses['usage'], pd: '', notes: '' })
  const [lOd, setLOd] = useState(emptyLens)
  const [lOs, setLOs] = useState(emptyLens)
  const [cl, setCl] = useState({ lensType: 'SOFT' as ContactLens['lensType'], replacement: 'MONTHLY' as ContactLens['replacement'], renewalDate: '', contraindications: '', notes: '' })

  const fromLastExam = () => { if (exams[0]) { setGOd(fromEye(exams[0].data.od)); setGOs(fromEye(exams[0].data.os)) } }
  const glassesEye = (e: typeof emptyEye, p: typeof emptyPrism): GlassesEye => ({ ...toEye(e), ...(cleanNumbers({ prism: p.prism, pd: p.pd }, ['prism', 'pd'])), base: (p.base || null) as GlassesEye['base'] })
  const saveGlasses = () => onSave('GLASSES', { od: glassesEye(gOd, pOd), os: glassesEye(gOs, pOs), usage: g.usage, pd: g.pd ? Number(g.pd) : null, notes: g.notes || null }, () => {
    setGOd(emptyEye); setGOs(emptyEye); setPOd(emptyPrism); setPOs(emptyPrism); setG({ usage: 'DISTANCE', pd: '', notes: '' })
  })
  const lensOf = (v: typeof emptyLens) => cleanNumbers(v, LENS_NUMBERS) as Lens
  const saveLenses = () => onSave('CONTACT_LENS', {
    od: lensOf(lOd), os: lensOf(lOs), lensType: cl.lensType, replacement: cl.replacement, renewalDate: cl.renewalDate || null, contraindications: cl.contraindications || null, notes: cl.notes || null,
  }, () => { setLOd(emptyLens); setLOs(emptyLens); setCl({ lensType: 'SOFT', replacement: 'MONTHLY', renewalDate: '', contraindications: '', notes: '' }) })

  const printGlasses = (r: ClinicalRecord<Glasses>) => {
    const row = (label: string, e: GlassesEye) => `<tr><td><b>${label}</b></td><td>${diopter(e.sphere)}</td><td>${e.cylinder ? diopter(e.cylinder) : '—'}</td><td>${e.cylinder ? `${e.axis ?? ''}°` : '—'}</td><td>${e.add ? diopter(e.add) : '—'}</td><td>${e.prism ? `${e.prism} Δ ${BASE[e.base || 'IN'] || ''}` : '—'}</td><td>${e.pd ?? '—'}</td></tr>`
    printOptical(cabinet, doctor, patient, 'Ordonnance de verres correcteurs', r.date,
      `<table><tr><th></th><th>Sphère</th><th>Cylindre</th><th>Axe</th><th>Addition</th><th>Prisme</th><th>EP (mm)</th></tr>${row('Œil droit (OD)', r.data.od)}${row('Œil gauche (OG)', r.data.os)}</table>
       <p>${USAGE[r.data.usage]}${r.data.pd ? ` · Écart pupillaire : ${r.data.pd} mm` : ''}</p>${r.data.notes ? `<p>${esc(r.data.notes)}</p>` : ''}`)
  }
  const printLenses = (r: ClinicalRecord<ContactLens>) => {
    const row = (label: string, l: Lens) => `<tr><td><b>${label}</b></td><td>${diopter(l.power)}</td><td>${l.cylinder ? diopter(l.cylinder) : '—'}</td><td>${l.cylinder ? `${l.axis ?? ''}°` : '—'}</td><td>${l.add ? diopter(l.add) : '—'}</td><td>${l.baseCurve ?? '—'}</td><td>${l.diameter ?? '—'}</td><td>${esc(l.brand || '—')}</td></tr>`
    printOptical(cabinet, doctor, patient, 'Ordonnance de lentilles de contact', r.date,
      `<table><tr><th></th><th>Puissance</th><th>Cylindre</th><th>Axe</th><th>Addition</th><th>Rayon (mm)</th><th>Diamètre (mm)</th><th>Marque / modèle</th></tr>${row('Œil droit (OD)', r.data.od)}${row('Œil gauche (OG)', r.data.os)}</table>
       <p>${LENS_TYPE[r.data.lensType]} · renouvellement ${REPLACEMENT[r.data.replacement].toLowerCase()}${r.data.renewalDate ? ` · à revoir avant le ${formatDateFR(r.data.renewalDate)}` : ''}</p>
       ${r.data.contraindications ? `<p>Contre-indications : ${esc(r.data.contraindications)}</p>` : ''}${r.data.notes ? `<p>${esc(r.data.notes)}</p>` : ''}`)
  }

  const prismInputs = (side: string, v: typeof emptyPrism, on: (x: typeof emptyPrism) => void) => (
    <div className="grid grid-cols-3 gap-2.5 rounded-xl bg-[#F2F5F3] p-3">
      <Field id={`${side}-pr`} label={L('Prisme')} type="number" step="0.5" unit="Δ" value={v.prism} onChange={x => on({ ...v, prism: x })} />
      <div className="space-y-1.5"><Label htmlFor={`${side}-base`}>{L('Base')}</Label>
        <NativeSelect id={`${side}-base`} value={v.base} onChange={e => on({ ...v, base: e.target.value })}><option value="">—</option>{Object.entries(BASE).map(([k, x]) => <option key={k} value={k}>{L(x)}</option>)}</NativeSelect>
      </div>
      <Field id={`${side}-pd`} label={L('EP monoculaire')} type="number" step="0.5" unit="mm" value={v.pd} onChange={x => on({ ...v, pd: x })} />
    </div>
  )
  const lensInputs = (side: string, label: string, v: typeof emptyLens, on: (x: typeof emptyLens) => void) => (
    <fieldset className="grid grid-cols-2 gap-2.5 rounded-xl bg-[#F2F5F3] p-3 sm:grid-cols-4">
      <legend className="sr-only">{L(label)}</legend>
      <p className="col-span-full text-[0.8rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">{L(label)}</p>
      <Field id={`${side}-pw`} label={L('Puissance')} type="number" step="0.25" unit="δ" value={v.power} onChange={x => on({ ...v, power: x })} />
      <Field id={`${side}-cy`} label={L('Cylindre')} type="number" step="0.25" unit="δ" value={v.cylinder} onChange={x => on({ ...v, cylinder: x })} />
      <Field id={`${side}-ax`} label={L('Axe')} type="number" step="1" unit="°" value={v.axis} onChange={x => on({ ...v, axis: x })} />
      <Field id={`${side}-ad`} label={L('Addition')} type="number" step="0.25" unit="δ" value={v.add} onChange={x => on({ ...v, add: x })} />
      <Field id={`${side}-bc`} label={L('Rayon de base')} type="number" step="0.1" unit="mm" value={v.baseCurve} onChange={x => on({ ...v, baseCurve: x })} />
      <Field id={`${side}-di`} label={L('Diamètre')} type="number" step="0.1" unit="mm" value={v.diameter} onChange={x => on({ ...v, diameter: x })} />
      <Field id={`${side}-br`} label={L('Marque / modèle')} value={v.brand} onChange={x => on({ ...v, brand: x })} className="col-span-2" />
    </fieldset>
  )

  return (
    <div className="grid gap-5">
      <Section title={L('Ordonnance de lunettes')} hint={L('Reprenez la réfraction du dernier examen ou saisissez-la, puis imprimez.')}
        action={exams.length > 0 ? <Button type="button" variant="outline" size="sm" onClick={fromLastExam}>{L('Reprendre le dernier examen')}</Button> : undefined}>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); saveGlasses() }}>
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="grid gap-2"><EyeInputs side="god" label="Œil droit (OD)" value={gOd} onChange={setGOd} withExam={false} />{prismInputs('pod', pOd, setPOd)}</div>
            <div className="grid gap-2"><EyeInputs side="gos" label="Œil gauche (OG)" value={gOs} onChange={setGOs} withExam={false} />{prismInputs('pos', pOs, setPOs)}</div>
          </div>
          <div className="grid gap-3 sm:grid-cols-[200px_160px_1fr_auto] sm:items-end">
            <div className="space-y-1.5"><Label htmlFor="g-usage">{L('Type de verres')}</Label>
              <NativeSelect id="g-usage" value={g.usage} onChange={e => setG(x => ({ ...x, usage: e.target.value as Glasses['usage'] }))}>
                {Object.entries(USAGE).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}
              </NativeSelect>
            </div>
            <Field id="g-pd" label={L('Écart pupillaire')} type="number" step="0.5" unit="mm" value={g.pd} onChange={v => setG(x => ({ ...x, pd: v }))} />
            <Field id="g-notes" label={L('Remarques')} value={g.notes} onChange={v => setG(x => ({ ...x, notes: v }))} placeholder={L('ex. Antireflet, photochromique')} />
            <Button type="submit" disabled={saving}>{L('Enregistrer')}</Button>
          </div>
        </form>
        {glasses.length > 0 && (
          <ul className="grid gap-2 border-t border-[#E3EAE7] pt-3">
            {glasses.map(r => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-[0.9rem]">
                <span><span className="font-mono text-[#5A6B65]">{formatDateFR(r.date)}</span> · {L(USAGE[r.data.usage])} · OD {refraction(r.data.od)} · {L('OG')} {refraction(r.data.os)}</span>
                <span className="flex items-center gap-1">
                  <Button size="sm" variant="outline" onClick={() => printGlasses(r)}><Printer size={15} className="me-1" />{L('Imprimer')}</Button>
                  <DeleteButton onDelete={() => onDelete(r.id)} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title={L('Ordonnance de lentilles de contact')} hint={L('Adaptation, marque et renouvellement ; les contre-indications sont imprimées sur l’ordonnance.')}>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); saveLenses() }}>
          <div className="grid gap-3 lg:grid-cols-2">
            {lensInputs('lod', 'Œil droit (OD)', lOd, setLOd)}
            {lensInputs('los', 'Œil gauche (OG)', lOs, setLOs)}
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5"><Label htmlFor="cl-type">{L('Type de lentilles')}</Label>
              <NativeSelect id="cl-type" value={cl.lensType} onChange={e => setCl(x => ({ ...x, lensType: e.target.value as ContactLens['lensType'] }))}>{Object.entries(LENS_TYPE).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}</NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="cl-rep">{L('Renouvellement')}</Label>
              <NativeSelect id="cl-rep" value={cl.replacement} onChange={e => setCl(x => ({ ...x, replacement: e.target.value as ContactLens['replacement'] }))}>{Object.entries(REPLACEMENT).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}</NativeSelect>
            </div>
            <Field id="cl-ren" label={L('Contrôle d’adaptation avant le')} type="date" value={cl.renewalDate} onChange={v => setCl(x => ({ ...x, renewalDate: v }))} />
          </div>
          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Field id="cl-ci" label={L('Contre-indications')} value={cl.contraindications} onChange={v => setCl(x => ({ ...x, contraindications: v }))} placeholder={L('ex. Pas de port la nuit, pas de baignade')} />
            <Field id="cl-notes" label={L('Remarques')} value={cl.notes} onChange={v => setCl(x => ({ ...x, notes: v }))} />
            <Button type="submit" disabled={saving || (!lOd.power && !lOs.power)}>{L('Enregistrer')}</Button>
          </div>
        </form>
        {lenses.length === 0 ? <Empty>{L('Aucune ordonnance de lentilles.')}</Empty> : (
          <ul className="grid gap-2 border-t border-[#E3EAE7] pt-3">
            {lenses.map(r => {
              const late = r.data.renewalDate && r.data.renewalDate < today()
              return (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-[0.9rem]">
                  <span><span className="font-mono text-[#5A6B65]">{formatDateFR(r.date)}</span> · {L(LENS_TYPE[r.data.lensType])} · OD {diopter(r.data.od.power)} · {L('OG')} {diopter(r.data.os.power)}
                    {r.data.renewalDate && <span className={late ? 'font-semibold text-[#B8372C]' : 'text-[#5A6B65]'}> · {L(late ? 'contrôle dépassé depuis le' : 'contrôle avant le')} {formatDateFR(r.data.renewalDate)}</span>}</span>
                  <span className="flex items-center gap-1">
                    <Button size="sm" variant="outline" onClick={() => printLenses(r)}><Printer size={15} className="me-1" />{L('Imprimer')}</Button>
                    <DeleteButton onDelete={() => onDelete(r.id)} />
                  </span>
                </li>
              )
            })}
          </ul>
        )}
      </Section>
    </div>
  )
}
