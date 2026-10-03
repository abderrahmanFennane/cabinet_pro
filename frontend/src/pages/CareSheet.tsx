import { useEffect, useMemo, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Move, Plus, Printer, RotateCcw, Trash2 } from 'lucide-react'
import api from '../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi, useCabinetId, useTeam } from '../lib/hooks'
import { cn, formatDateFR } from '../lib/utils'
import { Act, Cabinet, Invoice, Patient } from '../types'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { NativeSelect } from '../components/ui/native-select'

/**
 * CNSS "feuille de soins maladie" (doctor's part), pre-filled from the invoice, the patient and the doctor.
 * Two prints: the data alone, placed on the patient's official pre-printed CNSS form (positions adjustable
 * per cabinet), or a plain-paper summary for the file, which does not replace the official form.
 */

type Line = { date: string; code: string; ngap: string; amount: string }
type Sheet = {
  immat: string; insured: string; relation: string; beneficiary: string; birthDate: string; cin: string; sex: string
  doctor: string; inpe: string; specialty: string; lines: Line[]; total: string; place: string
}
type Point = { x: number; y: number }
type Layout = Record<FieldKey, Point> & { rowHeight: number; dx: number; dy: number }

const FIELDS = {
  immat: 'N° d’immatriculation', insured: 'Assuré(e)', relation: 'Lien avec l’assuré', beneficiary: 'Bénéficiaire des soins',
  birthDate: 'Date de naissance', cin: 'CIN', sex: 'Sexe', doctor: 'Médecin', inpe: 'INPE', specialty: 'Spécialité',
  colDate: 'Col. date', colCode: 'Col. code', colNgap: 'Col. NGAP', colAmount: 'Col. montant', total: 'Total', place: 'Fait à / le',
} as const
type FieldKey = keyof typeof FIELDS
const MAX_LINES = 6

// First guess for the official form (A4 portrait, mm). Every cabinet adjusts it once on its own printer.
const DEFAULT_LAYOUT: Layout = {
  immat: { x: 125, y: 42 }, insured: { x: 35, y: 50 }, relation: { x: 150, y: 62 }, beneficiary: { x: 35, y: 70 },
  birthDate: { x: 135, y: 70 }, cin: { x: 35, y: 78 }, sex: { x: 135, y: 78 }, doctor: { x: 35, y: 102 }, inpe: { x: 135, y: 102 },
  specialty: { x: 35, y: 110 }, colDate: { x: 15, y: 128 }, colCode: { x: 42, y: 128 }, colNgap: { x: 110, y: 128 }, colAmount: { x: 160, y: 128 },
  total: { x: 160, y: 182 }, place: { x: 35, y: 192 }, rowHeight: 8, dx: 0, dy: 0,
}
const RELATIONS = ['Assuré(e)', 'Conjoint(e)', 'Enfant']
const ddmmyyyy = (d?: string | null) => (d ? formatDateFR(d) : '')
const money = (n: number) => n.toFixed(2).replace('.', ',')

export default function CareSheet() {
  const { invoiceId = '' } = useParams()
  const { t } = useTranslation()
  const { hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const cabinetId = useCabinetId()
  const queryClient = useQueryClient()
  const { data: team = [] } = useTeam()
  const canAdjust = hasPermissions('MANAGE_SETTINGS')
  const [mode, setMode] = useState<'official' | 'summary'>('official')
  const [adjusting, setAdjusting] = useState(false)

  const { data: invoice } = useQuery({ queryKey: ['invoice', invoiceId], queryFn: async () => (await api.get(`${cabinetApi}/billing/invoices/${invoiceId}`)).data.data as Invoice & { practitionerId?: string | null } })
  const { data: patient } = useQuery({ queryKey: ['patient', invoice?.patient.id], queryFn: async () => (await api.get(`${cabinetApi}/patients/${invoice!.patient.id}`)).data.data as Patient, enabled: !!invoice })
  const { data: acts = [] } = useQuery({ queryKey: ['acts', cabinetApi], queryFn: async () => (await api.get(`${cabinetApi}/acts`)).data.data as Act[] })
  const { data: cabinet } = useQuery({ queryKey: ['cabinet', cabinetId], queryFn: async () => (await api.get(`/cabinets/${cabinetId}`)).data.data as Cabinet, enabled: !!cabinetId })

  const [sheet, setSheet] = useState<Sheet | null>(null)
  const [layout, setLayout] = useState<Layout>(DEFAULT_LAYOUT)
  useEffect(() => {
    if (cabinet?.careSheetLayout) {
      try { setLayout({ ...DEFAULT_LAYOUT, ...JSON.parse(cabinet.careSheetLayout) }) } catch { /* keep defaults */ }
    }
  }, [cabinet?.careSheetLayout])

  // Pre-fill once everything is loaded; afterwards the form is the doctor's to edit.
  useEffect(() => {
    if (sheet || !invoice || !patient) return
    const doctor = team.find(m => m.id === invoice.practitionerId) || team.find(m => m.role === 'OWNER')
    const ngapOf = (actId?: string | null) => acts.find(a => a.id === actId)?.ngap || ''
    const lines = (invoice.items || []).slice(0, MAX_LINES).map(item => ({
      date: ddmmyyyy(invoice.date),
      code: `${item.code || ''}${item.teeth ? ` (${item.teeth})` : ''}`.trim(),
      ngap: ngapOf((item as any).actId),
      amount: money(Number(item.total)),
    }))
    setSheet({
      immat: patient.coverageNumber || '',
      insured: patient.insuredName ? patient.insuredName.replace(/\s*\(.*\)\s*$/, '') : `${patient.lastName.toUpperCase()} ${patient.firstName}`,
      relation: patient.insuredName ? (/(père|mère|parent)/i.test(patient.insuredName) ? 'Enfant' : 'Conjoint(e)') : 'Assuré(e)',
      beneficiary: `${patient.lastName.toUpperCase()} ${patient.firstName}`,
      birthDate: ddmmyyyy(patient.birthDate), cin: patient.cin || '', sex: patient.sex === 'F' ? 'F' : patient.sex === 'M' ? 'M' : '',
      doctor: doctor ? practitionerName(doctor) : '', inpe: doctor?.inpe || '', specialty: doctor?.specialty ? t(`specialty.${doctor.specialty}`) : '',
      lines: lines.length ? lines : [{ date: ddmmyyyy(invoice.date), code: '', ngap: '', amount: '' }],
      total: money(Number(invoice.total)),
      place: `${cabinet?.city || ''}${cabinet?.city ? ', ' : ''}le ${formatDateFR(new Date())}`,
    })
  }, [invoice, patient, team, acts, cabinet, sheet, t])

  const saveLayout = useMutation({
    mutationFn: () => api.patch(`/cabinets/${cabinetId}`, { careSheetLayout: JSON.stringify(layout) }),
    onSuccess: () => { toast.success('Mise en page enregistrée pour ce cabinet'); setAdjusting(false); queryClient.invalidateQueries({ queryKey: ['cabinet', cabinetId] }) },
    onError: (err) => toast.error(apiError(err)),
  })

  const missing = useMemo(() => !sheet ? [] : [!sheet.immat && 'N° d’immatriculation', !sheet.inpe && 'INPE du médecin', sheet.lines.some(l => l.code && !l.ngap) && 'cotation NGAP'].filter(Boolean) as string[], [sheet])

  if (!sheet) return <p className="p-10 text-center text-sm text-[#5A6B65]">Préparation de la feuille de soins…</p>
  const set = (key: keyof Sheet) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setSheet(s => ({ ...s!, [key]: e.target.value }))
  const setLine = (i: number, key: keyof Line, value: string) => setSheet(s => ({ ...s!, lines: s!.lines.map((l, j) => (j === i ? { ...l, [key]: value } : l)) }))
  const recomputeTotal = (lines: Line[]) => money(lines.reduce((sum, l) => sum + (Number(l.amount.replace(',', '.')) || 0), 0))

  const print = () => window.print()

  return (
    <div className="min-h-screen bg-[#F2F5F3] print:bg-white">
      {/* Overlay printing: no margins, nothing but the data. Summary printing: normal A4 margins. */}
      <style>{mode === 'official' ? '@page { size: A4; margin: 0 }' : '@page { size: A4; margin: 14mm }'}</style>

      <div className="no-print mx-auto grid max-w-[1240px] gap-5 px-4 py-6 lg:grid-cols-[minmax(0,420px)_minmax(0,1fr)]">
        <section className="grid content-start gap-4 rounded-[14px] border border-[#D8E1DD] bg-white p-[18px]">
          <div>
            <h1 className="text-[1.3rem] font-extrabold">Feuille de soins CNSS</h1>
            <p className="text-[0.88rem] text-[#5A6B65]">Partie « Déclaration du médecin traitant », pré-remplie depuis la facture {invoice?.number}. Vérifiez puis imprimez.</p>
          </div>
          {missing.length > 0 && <p className="rounded-xl bg-[#FBEED6] px-3 py-2 text-[0.85rem] font-semibold text-[#99600B]">À compléter : {missing.join(', ')}.</p>}

          <fieldset className="grid grid-cols-2 gap-2.5">
            <legend className="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">Assuré et bénéficiaire</legend>
            <div className="col-span-2 space-y-1"><Label htmlFor="cs-immat">N° d’immatriculation</Label><Input id="cs-immat" value={sheet.immat} onChange={set('immat')} /></div>
            <div className="space-y-1"><Label htmlFor="cs-insured">Assuré(e)</Label><Input id="cs-insured" value={sheet.insured} onChange={set('insured')} /></div>
            <div className="space-y-1"><Label htmlFor="cs-rel">Lien</Label><NativeSelect id="cs-rel" value={sheet.relation} onChange={set('relation')}>{RELATIONS.map(r => <option key={r}>{r}</option>)}</NativeSelect></div>
            <div className="col-span-2 space-y-1"><Label htmlFor="cs-benef">Bénéficiaire des soins</Label><Input id="cs-benef" value={sheet.beneficiary} onChange={set('beneficiary')} /></div>
            <div className="space-y-1"><Label htmlFor="cs-birth">Date de naissance</Label><Input id="cs-birth" value={sheet.birthDate} onChange={set('birthDate')} placeholder="jj/mm/aaaa" /></div>
            <div className="grid grid-cols-[1fr_70px] gap-2">
              <div className="space-y-1"><Label htmlFor="cs-cin">CIN</Label><Input id="cs-cin" value={sheet.cin} onChange={set('cin')} /></div>
              <div className="space-y-1"><Label htmlFor="cs-sex">Sexe</Label><NativeSelect id="cs-sex" value={sheet.sex} onChange={set('sex')}><option value="">—</option><option>F</option><option>M</option></NativeSelect></div>
            </div>
          </fieldset>

          <fieldset className="grid grid-cols-2 gap-2.5">
            <legend className="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">Médecin traitant</legend>
            <div className="col-span-2 space-y-1"><Label htmlFor="cs-doc">Nom</Label><Input id="cs-doc" value={sheet.doctor} onChange={set('doctor')} /></div>
            <div className="space-y-1"><Label htmlFor="cs-inpe">INPE</Label><Input id="cs-inpe" value={sheet.inpe} onChange={set('inpe')} /></div>
            <div className="space-y-1"><Label htmlFor="cs-spec">Spécialité</Label><Input id="cs-spec" value={sheet.specialty} onChange={set('specialty')} /></div>
          </fieldset>

          <fieldset className="grid gap-2">
            <legend className="mb-1 text-[0.72rem] font-bold uppercase tracking-[0.08em] text-[#5A6B65]">Actes</legend>
            <div className="grid grid-cols-[92px_1fr_70px_80px_32px] gap-1.5 text-[0.75rem] font-semibold text-[#5A6B65]"><span>Date</span><span>Code / désignation</span><span>NGAP</span><span>Montant</span><span /></div>
            {sheet.lines.map((l, i) => (
              <div key={i} className="grid grid-cols-[92px_1fr_70px_80px_32px] gap-1.5">
                <Input aria-label={`Date ligne ${i + 1}`} className="h-9 px-2 text-[0.85rem]" value={l.date} onChange={e => setLine(i, 'date', e.target.value)} />
                <Input aria-label={`Code ligne ${i + 1}`} className="h-9 px-2 text-[0.85rem]" value={l.code} onChange={e => setLine(i, 'code', e.target.value)} />
                <Input aria-label={`NGAP ligne ${i + 1}`} className={cn('h-9 px-2 text-[0.85rem]', l.code && !l.ngap && 'border-[#99600B]')} value={l.ngap} onChange={e => setLine(i, 'ngap', e.target.value)} />
                <Input aria-label={`Montant ligne ${i + 1}`} className="h-9 px-2 text-end text-[0.85rem]" value={l.amount} onChange={e => setLine(i, 'amount', e.target.value)} onBlur={() => setSheet(s => ({ ...s!, total: recomputeTotal(s!.lines) }))} />
                <Button type="button" size="icon" variant="ghost" className="h-9 w-8" aria-label="Retirer la ligne" onClick={() => setSheet(s => { const lines = s!.lines.filter((_, j) => j !== i); return { ...s!, lines, total: recomputeTotal(lines) } })}><Trash2 size={14} /></Button>
              </div>
            ))}
            {sheet.lines.length < MAX_LINES && <Button type="button" size="sm" variant="ghost" className="justify-self-start" onClick={() => setSheet(s => ({ ...s!, lines: [...s!.lines, { date: s!.lines[0]?.date || '', code: '', ngap: '', amount: '' }] }))}><Plus size={14} className="me-1" />Ligne</Button>}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="space-y-1"><Label htmlFor="cs-total">Total (MAD)</Label><Input id="cs-total" value={sheet.total} onChange={set('total')} /></div>
              <div className="space-y-1"><Label htmlFor="cs-place">Fait à / le</Label><Input id="cs-place" value={sheet.place} onChange={set('place')} /></div>
            </div>
          </fieldset>
        </section>

        <section className="grid content-start gap-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1 rounded-xl bg-[#E9EFEC] p-1" role="tablist">
              {([['official', 'Sur la feuille officielle'], ['summary', 'Récapitulatif papier']] as const).map(([k, label]) => (
                <button key={k} role="tab" aria-selected={mode === k} onClick={() => { setMode(k); setAdjusting(false) }}
                  className={cn('rounded-lg px-3 py-1.5 text-[0.86rem] font-semibold', mode === k ? 'bg-white text-[#14231E] shadow-sm' : 'text-[#5A6B65]')}>{label}</button>
              ))}
            </div>
            <div className="flex flex-wrap gap-2">
              {mode === 'official' && canAdjust && !adjusting && <Button variant="outline" onClick={() => setAdjusting(true)}><Move size={16} className="me-1.5" />Ajuster la position</Button>}
              <Button onClick={print}><Printer size={16} className="me-1.5" />Imprimer</Button>
            </div>
          </div>

          {mode === 'official' && (
            <p className="text-[0.86rem] text-[#5A6B65]">
              Placez la feuille de soins CNSS du patient dans l’imprimante : seules les informations sont imprimées, dans les cases du formulaire.
              {canAdjust && ' La première fois, ajustez la position des champs puis faites un essai sur une feuille vierge.'}
            </p>
          )}
          {adjusting && (
            <div className="grid gap-2 rounded-xl border border-primary bg-[#DCEEE7] p-3 text-[0.86rem]">
              <p><b>Ajustement :</b> faites glisser chaque champ à sa case. Les décalages corrigent toute la page d’un coup (marges de l’imprimante).</p>
              <div className="flex flex-wrap items-end gap-3">
                {([['dx', 'Décalage horizontal'], ['dy', 'Décalage vertical'], ['rowHeight', 'Hauteur des lignes d’actes']] as const).map(([k, label]) => (
                  <label key={k} className="grid gap-1"><span>{label} (mm)</span><Input type="number" step="0.5" className="h-9 w-28" value={layout[k]} onChange={e => setLayout(l => ({ ...l, [k]: Number(e.target.value) }))} /></label>
                ))}
                <Button size="sm" onClick={() => saveLayout.mutate()} disabled={saveLayout.isPending}>Enregistrer la mise en page</Button>
                <Button size="sm" variant="ghost" onClick={() => setLayout(DEFAULT_LAYOUT)}><RotateCcw size={14} className="me-1" />Par défaut</Button>
                <Button size="sm" variant="ghost" onClick={() => setAdjusting(false)}>Fermer</Button>
              </div>
            </div>
          )}

          <div className="overflow-x-auto">
            {mode === 'official'
              ? <OfficialPreview sheet={sheet} layout={layout} adjusting={adjusting} onMove={(key, p) => setLayout(l => ({ ...l, [key]: p }))} />
              : <div className="mx-auto w-[210mm] max-w-full bg-white p-[14mm] shadow-lg"><Summary sheet={sheet} cabinet={cabinet} /></div>}
          </div>
        </section>
      </div>

      {/* What actually gets printed */}
      <div className="hidden print:block">
        {mode === 'official' ? <OfficialPrint sheet={sheet} layout={layout} /> : <Summary sheet={sheet} cabinet={cabinet} />}
      </div>
    </div>
  )
}

/** Text of a field (or of a table cell) for the overlay. */
function valuesOf(sheet: Sheet): Partial<Record<FieldKey, string>> {
  return {
    immat: sheet.immat, insured: sheet.insured, relation: sheet.relation, beneficiary: sheet.beneficiary, birthDate: sheet.birthDate,
    cin: sheet.cin, sex: sheet.sex, doctor: sheet.doctor, inpe: sheet.inpe, specialty: sheet.specialty, total: sheet.total, place: sheet.place,
  }
}
const COLUMNS: [FieldKey, keyof Line][] = [['colDate', 'date'], ['colCode', 'code'], ['colNgap', 'ngap'], ['colAmount', 'amount']]

/** The data alone, placed in mm on an A4 page, for the pre-printed official form. */
function OfficialPrint({ sheet, layout }: { sheet: Sheet; layout: Layout }) {
  const values = valuesOf(sheet)
  const at = (p: Point, row = 0): React.CSSProperties => ({ position: 'absolute', left: `${p.x + layout.dx}mm`, top: `${p.y + layout.dy + row * layout.rowHeight}mm`, whiteSpace: 'nowrap' })
  return (
    <div style={{ position: 'relative', width: '210mm', height: '296mm', fontFamily: 'Arial, sans-serif', fontSize: '10pt', color: '#000' }}>
      {(Object.keys(values) as FieldKey[]).map(key => values[key] ? <span key={key} style={at(layout[key])}>{values[key]}</span> : null)}
      {sheet.lines.map((line, row) => COLUMNS.map(([key, field]) => line[field] ? <span key={`${row}-${key}`} style={at(layout[key], row)}>{line[field]}</span> : null))}
    </div>
  )
}

/** On-screen version of the overlay, with a faint grid; fields can be dragged while adjusting. */
function OfficialPreview({ sheet, layout, adjusting, onMove }: { sheet: Sheet; layout: Layout; adjusting: boolean; onMove: (key: FieldKey, p: Point) => void }) {
  const box = useRef<HTMLDivElement>(null)
  const drag = useRef<{ key: FieldKey; startX: number; startY: number; from: Point } | null>(null)
  const values = valuesOf(sheet)
  const mmPerPx = () => 210 / (box.current?.clientWidth || 793)

  const handle = (key: FieldKey, text: string, row = 0) => {
    const p = layout[key]
    return (
      <span
        key={`${key}-${row}`}
        title={FIELDS[key]}
        onPointerDown={adjusting && row === 0 ? (e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); drag.current = { key, startX: e.clientX, startY: e.clientY, from: p } } : undefined}
        onPointerMove={adjusting ? (e) => {
          const d = drag.current
          if (!d || d.key !== key) return
          const k = mmPerPx()
          onMove(key, { x: Math.round((d.from.x + (e.clientX - d.startX) * k) * 2) / 2, y: Math.round((d.from.y + (e.clientY - d.startY) * k) * 2) / 2 })
        } : undefined}
        onPointerUp={() => { drag.current = null }}
        className={cn('absolute whitespace-nowrap leading-none', adjusting && row === 0 && 'cursor-move rounded bg-[#DCEEE7] px-0.5 outline outline-1 outline-primary')}
        style={{ left: `${((p.x + layout.dx) / 210) * 100}%`, top: `${((p.y + layout.dy + row * layout.rowHeight) / 297) * 100}%`, fontSize: '1.68cqw' }}
      >
        {text || (adjusting ? `‹${FIELDS[key]}›` : '')}
      </span>
    )
  }

  return (
    <div ref={box} className="relative mx-auto aspect-[210/297] w-full max-w-[640px] select-none bg-white shadow-lg"
      // 10 pt text on a 210 mm page = 1.68 % of the page width, whatever the preview size.
      style={{ backgroundImage: 'linear-gradient(#E9EFEC 1px, transparent 1px), linear-gradient(90deg, #E9EFEC 1px, transparent 1px)', backgroundSize: `${(10 / 210) * 100}% ${(10 / 297) * 100}%`, containerType: 'inline-size' } as React.CSSProperties}>
      <span className="absolute end-2 top-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8A9A94]">Aperçu · quadrillage 1 cm</span>
      {(Object.keys(values) as FieldKey[]).map(key => handle(key, values[key] || ''))}
      {sheet.lines.map((line, row) => COLUMNS.map(([key, field]) => handle(key, line[field], row)))}
    </div>
  )
}

/** Plain-paper summary for the patient's file. Does not replace the official CNSS form. */
function Summary({ sheet, cabinet }: { sheet: Sheet; cabinet?: Cabinet }) {
  const row = (label: string, value: string) => <tr><td className="w-[40%] border border-black/30 px-2 py-1.5 text-[#444]">{label}</td><td className="border border-black/30 px-2 py-1.5 font-semibold">{value || '—'}</td></tr>
  return (
    <div className="text-[12px] leading-relaxed text-black">
      <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[#666]">Récapitulatif · ne remplace pas la feuille de soins officielle CNSS</p>
      <h2 className="text-[18px] font-bold">Feuille de soins maladie (AMO) · déclaration du médecin traitant</h2>
      <p className="mb-4">{cabinet?.name}{cabinet?.city ? ` · ${cabinet.city}` : ''}</p>
      <table className="mb-4 w-full border-collapse"><tbody>
        {row('N° d’immatriculation', sheet.immat)}{row('Assuré(e)', sheet.insured)}{row('Lien avec l’assuré', sheet.relation)}
        {row('Bénéficiaire des soins', sheet.beneficiary)}{row('Date de naissance', sheet.birthDate)}{row('CIN', sheet.cin)}{row('Sexe', sheet.sex)}
        {row('Médecin traitant', sheet.doctor)}{row('INPE', sheet.inpe)}{row('Spécialité', sheet.specialty)}
      </tbody></table>
      <table className="w-full border-collapse">
        <thead><tr>{['Date', 'Code / désignation', 'Lettre clé et cotation (NGAP)', 'Montant (MAD)'].map(h => <th key={h} className="border border-black/40 bg-[#f2f2f2] px-2 py-1.5 text-start">{h}</th>)}</tr></thead>
        <tbody>
          {sheet.lines.map((l, i) => <tr key={i}><td className="border border-black/30 px-2 py-1.5">{l.date}</td><td className="border border-black/30 px-2 py-1.5">{l.code}</td><td className="border border-black/30 px-2 py-1.5">{l.ngap}</td><td className="border border-black/30 px-2 py-1.5 text-end">{l.amount}</td></tr>)}
          <tr><td colSpan={3} className="border border-black/30 px-2 py-1.5 text-end font-bold">Total</td><td className="border border-black/30 px-2 py-1.5 text-end font-bold">{sheet.total}</td></tr>
        </tbody>
      </table>
      <div className="mt-8 flex justify-between"><p>{sheet.place}</p><p className="w-60 border-t border-black/50 pt-1 text-center">Signature et cachet du médecin</p></div>
    </div>
  )
}
