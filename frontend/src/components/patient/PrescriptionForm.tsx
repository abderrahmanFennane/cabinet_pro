import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Plus, Printer, RefreshCw, Save, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { apiError, useCabinetApi, useCabinetPath, useDebouncedValue } from '../../lib/hooks'
import { useL } from '../../lib/labels'
import { formatDateFR } from '../../lib/utils'
import { Patient, Prescription, PrescriptionItem } from '../../types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { NativeSelect } from '../ui/native-select'

type Template = { id: string; name: string; items: PrescriptionItem[] }
const blank = (): PrescriptionItem[] => [{ drug: '', dosage: '', duration: '' }]

/**
 * Prescription editor: start from a template or the last prescription, drug suggestions, save as template,
 * create and print. Used in the Documents tab and at the end of a visit.
 */
export default function PrescriptionForm({ patient, onCreated, compact }: { patient: Patient; onCreated?: (rx: Prescription) => void; compact?: boolean }) {
  const L = useL()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const queryClient = useQueryClient()
  const base = `${cabinetApi}/patients/${patient.id}`
  const [items, setItems] = useState<PrescriptionItem[]>(blank)
  const [notes, setNotes] = useState('')
  const [drugSearch, setDrugSearch] = useState('')
  const drugTerm = useDebouncedValue(drugSearch)

  const { data: templates = [] } = useQuery({ queryKey: ['rx-templates'], queryFn: async () => (await api.get(`${cabinetApi}/prescription-templates`)).data.data as Template[], staleTime: 5 * 60_000 })
  const { data: previous = [] } = useQuery({ queryKey: ['prescriptions', patient.id], queryFn: async () => (await api.get(`${base}/prescriptions`)).data.data as Prescription[] })
  const { data: drugs = [] } = useQuery({ queryKey: ['drugs', drugTerm], queryFn: async () => (await api.get(`${cabinetApi}/drugs`, { params: { search: drugTerm } })).data.data as { name: string; detail?: string }[], placeholderData: keepPreviousData, staleTime: Infinity })

  const create = useMutation({
    mutationFn: async () => (await api.post(`${base}/prescriptions`, { items: items.filter(i => i.drug.trim()), notes: notes || null })).data.data as Prescription,
    onSuccess: (rx) => {
      toast.success(L('Ordonnance créée'))
      for (const key of ['prescriptions', 'timeline']) queryClient.invalidateQueries({ queryKey: [key, patient.id] })
      window.open(cabinetPath(`/print/prescription/${patient.id}/${rx.id}`), '_blank')
      setItems(blank()); setNotes('')
      onCreated?.(rx)
    },
    onError: (err) => toast.error(apiError(err)),
  })
  const saveTemplate = useMutation({
    mutationFn: (name: string) => api.post(`${cabinetApi}/prescription-templates`, { name, items: items.filter(i => i.drug.trim()) }),
    onSuccess: () => { toast.success(L('Ordonnance type enregistrée')); queryClient.invalidateQueries({ queryKey: ['rx-templates'] }) },
    onError: (err) => toast.error(apiError(err)),
  })
  const setItem = (index: number, patch: Partial<PrescriptionItem>) => setItems(list => list.map((item, i) => (i === index ? { ...item, ...patch } : item)))
  const last = previous[0]

  return (
    <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); create.mutate() }}>
      {patient.allergies && <p className="rounded-lg bg-[#FBE3E0] px-3 py-1.5 text-[0.86rem] font-semibold text-[#B8372C]">⚠ {L('Allergies')} : {patient.allergies}</p>}
      {(templates.length > 0 || last) && (
        <div className="flex flex-wrap gap-2">
          {templates.length > 0 && (
            <NativeSelect aria-label={L('Ordonnance type')} value="" className="h-10 w-auto min-w-[14rem] flex-1" onChange={e => { const tpl = templates.find(x => x.id === e.target.value); if (tpl) setItems(tpl.items.map(i => ({ ...i }))) }}>
              <option value="">{L('Partir d’une ordonnance type…')}</option>
              {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
            </NativeSelect>
          )}
          {last && <Button type="button" variant="outline" className="h-10" onClick={() => setItems(last.items.map(i => ({ ...i })))}><RefreshCw size={15} className="me-1.5" />{L('Reprendre la dernière')} ({formatDateFR(last.date)})</Button>}
        </div>
      )}
      <datalist id="drug-list">{drugs.map(d => <option key={d.name} value={d.name}>{d.detail}</option>)}</datalist>
      {items.map((item, index) => (
        <div key={index} className="grid gap-2 rounded-xl bg-muted/60 p-2.5 sm:grid-cols-[1.4fr_1.4fr_0.8fr_auto]">
          <Input list="drug-list" placeholder={L('Médicament')} value={item.drug} onChange={e => { setItem(index, { drug: e.target.value }); setDrugSearch(e.target.value) }} aria-label={`${L('Médicament')} ${index + 1}`}
            onKeyDown={e => { if (e.key === 'Enter' && index === items.length - 1 && item.drug.trim()) { e.preventDefault(); setItems(list => [...list, { drug: '', dosage: '', duration: '' }]) } }} />
          <Input placeholder={L('Posologie')} value={item.dosage || ''} onChange={e => setItem(index, { dosage: e.target.value })} aria-label={L('Posologie')} />
          <Input placeholder={L('Durée')} value={item.duration || ''} onChange={e => setItem(index, { duration: e.target.value })} aria-label={L('Durée')} />
          <Button type="button" size="icon" variant="ghost" aria-label={L('Retirer la ligne')} onClick={() => setItems(list => (list.length > 1 ? list.filter((_, i) => i !== index) : blank()))}><Trash2 size={15} /></Button>
        </div>
      ))}
      <Button type="button" size="sm" variant="outline" onClick={() => setItems(list => [...list, { drug: '', dosage: '', duration: '' }])}><Plus size={15} className="me-1" />{L('Ligne')}</Button>
      {!compact && <div className="space-y-1.5"><Label htmlFor="rx-notes">{L('Recommandations')}</Label><Textarea id="rx-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} /></div>}
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="ghost" onClick={() => { const name = window.prompt(L('Nom de l’ordonnance type')); if (name) saveTemplate.mutate(name) }} disabled={!items.some(i => i.drug.trim())}><Save size={15} className="me-1" />{L('Enregistrer comme type')}</Button>
        <Button type="submit" disabled={!items.some(i => i.drug.trim()) || create.isPending}><Printer size={15} className="me-1.5" />{L('Créer et imprimer')}</Button>
      </div>
    </form>
  )
}
