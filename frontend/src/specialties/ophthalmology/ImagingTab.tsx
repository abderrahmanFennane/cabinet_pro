import { useMemo, useState } from 'react'
import { toast } from 'sonner'
import { useL } from '../../lib/labels'
import { apiError, useCabinetApi, useCabinetId } from '../../lib/hooks'
import { formatDateFR } from '../../lib/utils'
import { openAttachment } from '../../lib/files'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Input } from '../../components/ui/input'
import { Textarea } from '../../components/ui/textarea'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord, today } from '../records'
import { COLORS, Empty, Field, RecordMeta, Section, Trend } from '../ui'
import { byDate, Imaging, Modality, MODALITY, num, SHORT, SIDE_LABEL, Thumb, uploadImage } from './shared'

const MEASURES: Partial<Record<Modality, [keyof Imaging, string, string][]>> = {
  OCT_RNFL: [['rnflAvg', 'RNFL moyen', 'µm'], ['rnflSup', 'RNFL supérieur', 'µm'], ['rnflInf', 'RNFL inférieur', 'µm']],
  OCT_GCC: [['gcc', 'GCC moyen', 'µm']],
  OCT_MACULA: [['cmt', 'Épaisseur maculaire centrale', 'µm']],
}

type Props = { patientId: string; images: ClinicalRecord<Imaging>[]; onSave: (date: string, data: Imaging, done: () => void) => void; onDelete: (id: string) => void; saving: boolean }

/** OCT, retinal photographs, angiographies: images attached to the file, measures and interpretation, compared over time. */
export default function ImagingTab({ patientId, images, onSave, onDelete, saving }: Props) {
  const L = useL()
  const cabinetApi = useCabinetApi()
  const cabinetId = useCabinetId()
  const empty = { date: today(), eye: 'OD' as Imaging['eye'], modality: 'OCT_RNFL' as Modality, device: '', rnflAvg: '', rnflSup: '', rnflInf: '', gcc: '', cmt: '', interpretation: '' }
  const [f, setF] = useState(empty)
  const [files, setFiles] = useState<File[]>([])
  const [busy, setBusy] = useState(false)
  const [compare, setCompare] = useState<{ modality: Modality; eye: Imaging['eye'] }>({ modality: 'OCT_RNFL', eye: 'OD' })
  const set = (k: keyof typeof empty) => (v: string) => setF(x => ({ ...x, [k]: v }))
  const open = (id: string) => openAttachment(cabinetId!, patientId, id).catch(() => toast.error(L('Ouverture impossible')))

  const submit = async () => {
    setBusy(true)
    try {
      const ids: string[] = []
      for (const file of files) ids.push(await uploadImage(cabinetApi, patientId, file, `${MODALITY[f.modality]} ${SHORT[f.eye]} ${f.date}`))
      onSave(f.date, {
        eye: f.eye, modality: f.modality, device: f.device || null, rnflAvg: num(f.rnflAvg), rnflSup: num(f.rnflSup), rnflInf: num(f.rnflInf),
        gcc: num(f.gcc), cmt: num(f.cmt), interpretation: f.interpretation || null, attachmentIds: ids,
      }, () => { setF({ ...empty, eye: f.eye, modality: f.modality, device: f.device }); setFiles([]) })
    } catch (err) { toast.error(apiError(err)) } finally { setBusy(false) }
  }

  const rnfl = byDate(images.filter(r => r.data.modality === 'OCT_RNFL' && r.data.rnflAvg != null && r.data.eye !== 'OU'), d => ({ [d.eye === 'OD' ? 'od' : 'os']: d.rnflAvg }))
  const series = useMemo(() => images.filter(r => r.data.modality === compare.modality && r.data.eye === compare.eye), [images, compare])
  const [latest, previous] = series
  const delta = latest?.data.rnflAvg != null && previous?.data.rnflAvg != null ? latest.data.rnflAvg - previous.data.rnflAvg : null

  return (
    <div className="grid gap-5">
      <Section title={L('Nouvelle imagerie')} hint={L('Exportez la capture ou le rapport de l’appareil (OCT, rétinographe…) en image ou PDF et joignez-le ici avec les mesures principales.')}>
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); void submit() }}>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="space-y-1.5"><Label htmlFor="im-mod">{L('Examen')}</Label>
              <NativeSelect id="im-mod" value={f.modality} onChange={e => set('modality')(e.target.value)}>{Object.entries(MODALITY).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}</NativeSelect>
            </div>
            <div className="space-y-1.5"><Label htmlFor="im-eye">{L('Œil')}</Label>
              <NativeSelect id="im-eye" value={f.eye} onChange={e => set('eye')(e.target.value)}>{(['OD', 'OS', 'OU'] as const).map(s => <option key={s} value={s}>{L(SIDE_LABEL[s])}</option>)}</NativeSelect>
            </div>
            <Field id="im-dev" label={L('Appareil')} value={f.device} onChange={set('device')} placeholder="Cirrus, Spectralis, Topcon…" />
            <Field id="im-date" label={L('Date')} type="date" value={f.date} onChange={set('date')} />
            {(MEASURES[f.modality] || []).map(([k, label, unit]) => (
              <Field key={k} id={`im-${k}`} label={L(label)} type="number" step="1" unit={unit} value={(f as any)[k]} onChange={set(k as keyof typeof empty)} />
            ))}
          </div>
          <div className="space-y-1.5"><Label htmlFor="im-int">{L('Interprétation')}</Label><Textarea id="im-int" rows={2} value={f.interpretation} onChange={e => set('interpretation')(e.target.value)} placeholder={L('ex. Amincissement temporal supérieur, pas d’œdème maculaire')} /></div>
          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <div className="space-y-1.5"><Label htmlFor="im-files">{L('Images ou rapports (plusieurs possibles)')}</Label>
              <Input id="im-files" type="file" multiple accept="image/*,application/pdf" onChange={e => setFiles(Array.from(e.target.files || []).slice(0, 12))} className="cursor-pointer pt-2" />
            </div>
            <Button type="submit" disabled={saving || busy || (!files.length && !f.interpretation && !f.rnflAvg && !f.gcc && !f.cmt)}>{busy ? L('Envoi…') : L('Enregistrer')}</Button>
          </div>
        </form>
      </Section>

      <div className="grid gap-5 lg:grid-cols-2">
        <Section title={L('Évolution du RNFL moyen')} hint={L('Une perte de plus de 5 µm entre deux examens mérite attention.')}>
          <Trend data={rnfl} unit="µm" series={[{ key: 'od', label: 'OD', color: COLORS.primary }, { key: 'os', label: L('OG'), color: COLORS.blue }]} />
        </Section>
        <Section title={L('Comparer deux examens')}
          action={
            <div className="flex gap-1.5">
              <NativeSelect aria-label={L('Examen')} className="h-8 w-auto text-sm" value={compare.modality} onChange={e => setCompare(c => ({ ...c, modality: e.target.value as Modality }))}>{Object.entries(MODALITY).map(([k, v]) => <option key={k} value={k}>{L(v)}</option>)}</NativeSelect>
              <NativeSelect aria-label={L('Œil')} className="h-8 w-auto text-sm" value={compare.eye} onChange={e => setCompare(c => ({ ...c, eye: e.target.value as Imaging['eye'] }))}>{(['OD', 'OS', 'OU'] as const).map(s => <option key={s} value={s}>{L(SHORT[s])}</option>)}</NativeSelect>
            </div>
          }>
          {!latest ? <Empty>{L('Aucun examen de ce type pour cet œil.')}</Empty> : (
            <div className="grid gap-2">
              <div className="grid grid-cols-2 gap-2">
                {[latest, previous].map((r, i) => (
                  <div key={i} className="grid gap-1">
                    {r?.data.attachmentIds?.[0] ? <Thumb patientId={patientId} attachmentId={r.data.attachmentIds[0]} label={formatDateFR(r.date)} onOpen={() => open(r.data.attachmentIds[0])} />
                      : <span className="flex aspect-[4/3] items-center justify-center rounded-xl bg-[#F2F5F3] text-sm text-[#5A6B65]">{r ? formatDateFR(r.date) : L('Pas d’examen précédent')}</span>}
                    {r?.data.rnflAvg != null && <p className="text-center text-sm">RNFL <b>{r.data.rnflAvg} µm</b></p>}
                  </div>
                ))}
              </div>
              {delta !== null && <p className={delta <= -5 ? 'text-sm font-semibold text-[#B8372C]' : 'text-sm text-[#5A6B65]'}>{L('Écart RNFL')} : {delta > 0 ? '+' : ''}{delta} µm</p>}
            </div>
          )}
        </Section>
      </div>

      <Section title={L('Imagerie')}>
        {images.length === 0 ? <Empty>{L('Aucune imagerie enregistrée.')}</Empty> : (
          <ul className="grid gap-3 lg:grid-cols-2">
            {images.map(r => (
              <li key={r.id} className="grid gap-2 rounded-xl border border-[#E3EAE7] p-3 text-[0.9rem]">
                <RecordMeta record={r} onDelete={() => onDelete(r.id)} />
                <p><b>{L(MODALITY[r.data.modality])}</b> · {L(SHORT[r.data.eye])}{r.data.device ? ` · ${r.data.device}` : ''}</p>
                {r.data.attachmentIds?.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {r.data.attachmentIds.map(id => <Thumb key={id} patientId={patientId} attachmentId={id} onOpen={() => open(id)} />)}
                  </div>
                )}
                {(MEASURES[r.data.modality] || []).some(([k]) => r.data[k] != null) && (
                  <p className="font-mono text-[0.85rem]">{(MEASURES[r.data.modality] || []).filter(([k]) => r.data[k] != null).map(([k, label, unit]) => `${L(label)} ${r.data[k]} ${unit}`).join(' · ')}</p>
                )}
                {r.data.interpretation && <p>{r.data.interpretation}</p>}
              </li>
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}
