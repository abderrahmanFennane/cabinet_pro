import { useState } from 'react'
import { cn } from '../lib/utils'
import { Patient } from '../types'
import { Button } from '../components/ui/button'
import { Label } from '../components/ui/label'
import { NativeSelect } from '../components/ui/native-select'
import { Textarea } from '../components/ui/textarea'
import { ClinicalRecord, useRecords } from './records'
import { Empty, Field, RecordMeta, Section } from './ui'

type Lesion = { zone: string; type?: string | null; sizeMm?: number | null; description?: string | null; status: 'ACTIVE' | 'IMPROVING' | 'HEALED' }
type Shape = { code: string; label: string; kind: 'rect' | 'ellipse'; x: number; y: number; w: number; h: number }

// Body map as seen facing the patient (patient's right on the left of the screen). Front and back share the outline.
const outline = (side: 'FRONT' | 'BACK'): Shape[] => {
  const f = side === 'FRONT'
  return [
    { code: `${side}_HEAD`, label: f ? 'Visage' : 'Cuir chevelu', kind: 'ellipse', x: 100, y: 36, w: 24, h: 28 },
    { code: `${side}_NECK`, label: f ? 'Cou' : 'Nuque', kind: 'rect', x: 90, y: 64, w: 20, h: 12 },
    { code: `${side}_TRUNK_UP`, label: f ? 'Thorax' : 'Haut du dos', kind: 'rect', x: 66, y: 76, w: 68, h: 56 },
    { code: `${side}_TRUNK_LOW`, label: f ? 'Abdomen' : 'Bas du dos', kind: 'rect', x: 69, y: 132, w: 62, h: 50 },
    { code: `${side}_PELVIS`, label: f ? 'Région génitale' : 'Fesses', kind: 'rect', x: 70, y: 182, w: 60, h: 30 },
    { code: `${side}_R_ARM`, label: 'Bras droit', kind: 'rect', x: 42, y: 78, w: 22, h: 84 },
    { code: `${side}_L_ARM`, label: 'Bras gauche', kind: 'rect', x: 136, y: 78, w: 22, h: 84 },
    { code: `${side}_R_FOREARM`, label: 'Avant-bras droit', kind: 'rect', x: 36, y: 162, w: 20, h: 66 },
    { code: `${side}_L_FOREARM`, label: 'Avant-bras gauche', kind: 'rect', x: 144, y: 162, w: 20, h: 66 },
    { code: `${side}_R_HAND`, label: 'Main droite', kind: 'ellipse', x: 46, y: 242, w: 11, h: 14 },
    { code: `${side}_L_HAND`, label: 'Main gauche', kind: 'ellipse', x: 154, y: 242, w: 11, h: 14 },
    { code: `${side}_R_THIGH`, label: 'Cuisse droite', kind: 'rect', x: 72, y: 212, w: 27, h: 90 },
    { code: `${side}_L_THIGH`, label: 'Cuisse gauche', kind: 'rect', x: 101, y: 212, w: 27, h: 90 },
    { code: `${side}_R_LEG`, label: f ? 'Jambe droite' : 'Mollet droit', kind: 'rect', x: 75, y: 302, w: 22, h: 82 },
    { code: `${side}_L_LEG`, label: f ? 'Jambe gauche' : 'Mollet gauche', kind: 'rect', x: 103, y: 302, w: 22, h: 82 },
    { code: `${side}_R_FOOT`, label: 'Pied droit', kind: 'ellipse', x: 84, y: 396, w: 13, h: 9 },
    { code: `${side}_L_FOOT`, label: 'Pied gauche', kind: 'ellipse', x: 116, y: 396, w: 13, h: 9 },
  ]
}
const ZONES = [...outline('FRONT'), ...outline('BACK')]
export const zoneLabel = (code: string) => {
  const z = ZONES.find(x => x.code === code)
  return z ? `${z.label} (${code.startsWith('FRONT') ? 'face avant' : 'face arrière'})` : code
}
const TYPES = ['Naevus', 'Eczéma', 'Psoriasis', 'Acné', 'Verrue', 'Kératose', 'Mycose', 'Urticaire', 'Lésion suspecte', 'Cicatrice', 'Autre']
const STATUS: Record<Lesion['status'], [string, string]> = {
  ACTIVE: ['Active', 'bg-[#FBE3E0] text-[#B8372C]'], IMPROVING: ['En amélioration', 'bg-[#FBEED6] text-[#99600B]'], HEALED: ['Guérie', 'bg-[#DFF1E6] text-[#1E7A45]'],
}

function BodyMap({ side, lesions, selected, onSelect }: { side: 'FRONT' | 'BACK'; lesions: ClinicalRecord<Lesion>[]; selected: string; onSelect: (code: string) => void }) {
  return (
    <figure className="grid justify-items-center gap-1">
      <svg viewBox="20 0 160 420" className="h-[360px] w-auto max-w-full" role="group" aria-label={side === 'FRONT' ? 'Face avant' : 'Face arrière'}>
        {outline(side).map(z => {
          const here = lesions.filter(l => l.data.zone === z.code)
          const active = here.some(l => l.data.status !== 'HEALED')
          const fill = selected === z.code ? '#DCEEE7' : active ? '#FBE3E0' : here.length ? '#DFF1E6' : '#F2F5F3'
          const stroke = selected === z.code ? '#12705A' : active ? '#B8372C' : '#B5CCC2'
          const common = { fill, stroke, strokeWidth: selected === z.code ? 2.5 : 1.4, className: 'cursor-pointer', onClick: () => onSelect(z.code) }
          const cx = z.kind === 'rect' ? z.x + z.w / 2 : z.x
          const cy = z.kind === 'rect' ? z.y + z.h / 2 : z.y
          return (
            <g key={z.code}>
              <title>{z.label}{here.length ? ` · ${here.length} lésion(s)` : ''}</title>
              {z.kind === 'rect' ? <rect x={z.x} y={z.y} width={z.w} height={z.h} rx={9} {...common} /> : <ellipse cx={z.x} cy={z.y} rx={z.w} ry={z.h} {...common} />}
              {here.length > 0 && <text x={cx} y={cy + 4} textAnchor="middle" fontSize="12" fontWeight="700" fill={active ? '#B8372C' : '#1E7A45'} pointerEvents="none">{here.length}</text>}
            </g>
          )
        })}
      </svg>
      <figcaption className="text-[0.8rem] font-semibold text-[#5A6B65]">{side === 'FRONT' ? 'Face avant' : 'Face arrière'}</figcaption>
    </figure>
  )
}

/** Dermatology: body map to place lesions, lesion follow-up (photos go to the Documents tab). */
export default function Dermatology({ patient }: { patient: Patient }) {
  const { ofKind, save, remove, isLoading } = useRecords(patient.id, 'DERMATOLOGY')
  const lesions = ofKind<Lesion>('LESION')
  const [zone, setZone] = useState('')
  const [form, setForm] = useState({ type: 'Naevus', sizeMm: '', description: '' })
  const active = lesions.filter(l => l.data.status !== 'HEALED')

  if (isLoading) return <p className="py-8 text-center text-[#5A6B65]">Chargement…</p>

  return (
    <div className="grid gap-5">
      <Section title="Carte des lésions" hint="Touchez une zone du corps pour y noter une lésion. Les photos se joignent dans l’onglet Documents."
        action={active.length > 0 ? <span className="rounded-full bg-[#FBE3E0] px-2.5 py-1 text-[0.8rem] font-bold text-[#B8372C]">{active.length} active(s)</span> : undefined}>
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <div className="flex flex-wrap justify-center gap-4" dir="ltr">
            <BodyMap side="FRONT" lesions={lesions} selected={zone} onSelect={setZone} />
            <BodyMap side="BACK" lesions={lesions} selected={zone} onSelect={setZone} />
          </div>
          {zone ? (
            <form className="grid content-start gap-3 rounded-xl bg-[#F2F5F3] p-4" onSubmit={e => {
              e.preventDefault()
              save.mutate({ kind: 'LESION', data: { zone, type: form.type, sizeMm: form.sizeMm ? Number(form.sizeMm) : null, description: form.description || null, status: 'ACTIVE' } }, {
                onSuccess: () => setForm({ type: 'Naevus', sizeMm: '', description: '' }),
              })
            }}>
              <p className="font-bold">Nouvelle lésion · {zoneLabel(zone)}</p>
              <div className="grid grid-cols-[1fr_120px] gap-3">
                <div className="space-y-1.5"><Label htmlFor="les-type">Type</Label>
                  <NativeSelect id="les-type" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{TYPES.map(t => <option key={t}>{t}</option>)}</NativeSelect>
                </div>
                <Field id="les-size" label="Taille" type="number" unit="mm" value={form.sizeMm} onChange={v => setForm(f => ({ ...f, sizeMm: v }))} />
              </div>
              <div className="space-y-1.5"><Label htmlFor="les-desc">Description</Label><Textarea id="les-desc" rows={3} value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Aspect, couleur, bords, évolution…" /></div>
              <div className="flex gap-2"><Button type="submit" disabled={save.isPending}>Ajouter la lésion</Button><Button type="button" variant="ghost" onClick={() => setZone('')}>Annuler</Button></div>
            </form>
          ) : <Empty>Choisissez une zone sur le schéma.</Empty>}
        </div>
      </Section>

      <Section title="Suivi des lésions">
        {lesions.length === 0 ? <Empty>Aucune lésion notée.</Empty> : (
          <ul className="grid gap-2">
            {lesions.map(r => (
              <li key={r.id} className={cn('grid gap-1 rounded-xl border p-3 text-[0.9rem]', zone === r.data.zone ? 'border-primary' : 'border-[#E3EAE7]')}>
                <RecordMeta record={r} onDelete={() => remove.mutate(r.id)} />
                <div className="flex flex-wrap items-center gap-2">
                  <b>{r.data.type || 'Lésion'}</b><span className="text-[#5A6B65]">· {zoneLabel(r.data.zone)}{r.data.sizeMm ? ` · ${r.data.sizeMm} mm` : ''}</span>
                  <span className={cn('rounded-full px-2 py-0.5 text-[0.75rem] font-bold', STATUS[r.data.status][1])}>{STATUS[r.data.status][0]}</span>
                </div>
                {r.data.description && <p className="text-[#5A6B65]">{r.data.description}</p>}
                <div className="flex flex-wrap gap-1.5">
                  {(Object.keys(STATUS) as Lesion['status'][]).filter(s => s !== r.data.status).map(s => (
                    <Button key={s} size="sm" variant="outline" disabled={save.isPending} onClick={() => save.mutate({ id: r.id, kind: 'LESION', data: { ...r.data, status: s } })}>{STATUS[s][0]}</Button>
                  ))}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
