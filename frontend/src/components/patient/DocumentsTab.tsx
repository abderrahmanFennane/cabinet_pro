import { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileSignature, Pill, Plus, Printer, RefreshCw, Save, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi, useCabinetPath, useDebouncedValue } from '../../lib/hooks'
import { formatDateFR } from '../../lib/utils'
import { DocumentType, MedicalDocument, Patient, Prescription, PrescriptionItem } from '../../types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { NativeSelect } from '../ui/native-select'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'

type Template = { id: string; name: string; items: PrescriptionItem[] }

const DOC_TYPES: { type: DocumentType; label: string; template: (p: Patient, doctor: string) => string }[] = [
  { type: 'CERTIFICATE', label: 'Certificat médical', template: (p, d) => `Je soussigné(e), ${d}, certifie avoir examiné ce jour ${p.sex === 'F' ? 'Mme' : 'M.'} ${p.firstName} ${p.lastName}${p.birthDate ? `, né(e) le ${formatDateFR(p.birthDate)}` : ''}.\n\n\n\nCertificat établi à la demande de l’intéressé(e) et remis en main propre pour servir et valoir ce que de droit.` },
  { type: 'SICK_LEAVE', label: 'Arrêt de travail', template: (p, d) => `Je soussigné(e), ${d}, certifie que l’état de santé de ${p.sex === 'F' ? 'Mme' : 'M.'} ${p.firstName} ${p.lastName} nécessite un arrêt de travail de ___ jours, du ${formatDateFR(new Date())} au ___ inclus, sauf complications.` },
  { type: 'REFERRAL', label: 'Lettre d’orientation', template: (p) => `Cher(e) confrère,\n\nJe vous adresse ${p.sex === 'F' ? 'Mme' : 'M.'} ${p.firstName} ${p.lastName}${p.age !== null ? `, ${p.age} ans,` : ''} pour :\n\n\n\nJe vous remercie de votre avis et vous prie de croire à mes sentiments confraternels.` },
  { type: 'EXAM_REQUEST', label: 'Demande d’examens', template: (p) => `Prière de pratiquer à ${p.sex === 'F' ? 'Mme' : 'M.'} ${p.firstName} ${p.lastName} les examens suivants :\n\n- \n- \n\nRenseignements cliniques : ` },
]

export default function DocumentsTab({ patient }: { patient: Patient }) {
  const { user, hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const base = `${cabinetApi}/patients/${patient.id}`
  const queryClient = useQueryClient()
  const canWrite = hasPermissions('MANAGE_PRESCRIPTIONS')
  const [rxOpen, setRxOpen] = useState(false)
  const [items, setItems] = useState<PrescriptionItem[]>([{ drug: '', dosage: '', duration: '' }])
  const [rxNotes, setRxNotes] = useState('')
  const [drugSearch, setDrugSearch] = useState('')
  const [docType, setDocType] = useState<DocumentType | null>(null)
  const [docTitle, setDocTitle] = useState('')
  const [docBody, setDocBody] = useState('')

  const { data: prescriptions = [] } = useQuery({ queryKey: ['prescriptions', patient.id], queryFn: async () => (await api.get(`${base}/prescriptions`)).data.data as Prescription[] })
  const { data: documents = [] } = useQuery({ queryKey: ['documents', patient.id], queryFn: async () => (await api.get(`${base}/documents`)).data.data as MedicalDocument[] })
  const { data: templates = [] } = useQuery({ queryKey: ['rx-templates'], queryFn: async () => (await api.get(`${cabinetApi}/prescription-templates`)).data.data as Template[], enabled: canWrite && rxOpen, refetchInterval: false })
  const drugTerm = useDebouncedValue(drugSearch)
  const { data: drugs = [] } = useQuery({ queryKey: ['drugs', drugTerm], queryFn: async () => (await api.get(`${cabinetApi}/drugs`, { params: { search: drugTerm } })).data.data as string[], enabled: canWrite && rxOpen, placeholderData: keepPreviousData, staleTime: Infinity })

  const refresh = () => ['prescriptions', 'documents', 'timeline'].forEach(key => queryClient.invalidateQueries({ queryKey: [key, patient.id] }))
  const printRx = (id: string) => window.open(cabinetPath(`/print/prescription/${patient.id}/${id}`), '_blank')

  const createRx = useMutation({
    mutationFn: async () => (await api.post(`${base}/prescriptions`, { items: items.filter(i => i.drug.trim()), notes: rxNotes || null })).data.data as Prescription,
    onSuccess: (rx) => { toast.success('Ordonnance créée'); refresh(); setRxOpen(false); printRx(rx.id) },
    onError: (err) => toast.error(apiError(err)),
  })
  const renew = useMutation({
    mutationFn: async (id: string) => (await api.post(`${base}/prescriptions/${id}/renew`)).data.data as Prescription,
    onSuccess: (rx) => { toast.success('Ordonnance renouvelée'); refresh(); printRx(rx.id) },
    onError: (err) => toast.error(apiError(err)),
  })
  const saveTemplate = useMutation({
    mutationFn: (name: string) => api.post(`${cabinetApi}/prescription-templates`, { name, items: items.filter(i => i.drug.trim()) }),
    onSuccess: () => { toast.success('Ordonnance type enregistrée'); queryClient.invalidateQueries({ queryKey: ['rx-templates'] }) },
    onError: (err) => toast.error(apiError(err)),
  })
  const createDoc = useMutation({
    mutationFn: async () => (await api.post(`${base}/documents`, { type: docType, title: docTitle, body: docBody })).data.data as MedicalDocument,
    onSuccess: (doc) => { toast.success('Document créé'); refresh(); setDocType(null); window.open(cabinetPath(`/print/document/${patient.id}/${doc.id}`), '_blank') },
    onError: (err) => toast.error(apiError(err)),
  })

  const openRx = () => { setItems([{ drug: '', dosage: '', duration: '' }]); setRxNotes(''); setRxOpen(true) }
  const openDoc = (type: DocumentType) => {
    const def = DOC_TYPES.find(d => d.type === type)!
    setDocType(type); setDocTitle(def.label); setDocBody(def.template(patient, practitionerName(user as any)))
  }
  const setItem = (index: number, patch: Partial<PrescriptionItem>) => setItems(list => list.map((item, i) => (i === index ? { ...item, ...patch } : item)))

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Ordonnances</h3>
          {canWrite && <Button size="sm" onClick={openRx}><Plus size={16} className="me-1" />Nouvelle ordonnance</Button>}
        </div>
        {prescriptions.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aucune ordonnance.</p>}
        {prescriptions.map(rx => (
          <article key={rx.id} className="flex flex-wrap items-start justify-between gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">{formatDateFR(rx.date)} · {practitionerName(rx.practitioner)}</p>
              <ul className="text-sm">{rx.items.map((item, i) => <li key={i}><Pill size={13} className="me-1.5 inline text-primary" /><b>{item.drug}</b>{item.dosage ? ` — ${item.dosage}` : ''}{item.duration ? ` · ${item.duration}` : ''}</li>)}</ul>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => printRx(rx.id)}><Printer size={15} className="me-1" />Imprimer</Button>
              {canWrite && <Button size="sm" variant="secondary" onClick={() => renew.mutate(rx.id)}><RefreshCw size={15} className="me-1" />Renouveler</Button>}
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">Certificats et courriers</h3>
          {canWrite && (
            <div className="flex flex-wrap gap-1.5">
              {DOC_TYPES.map(d => <Button key={d.type} size="sm" variant="outline" onClick={() => openDoc(d.type)}><FileSignature size={15} className="me-1" />{d.label}</Button>)}
            </div>
          )}
        </div>
        {documents.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">Aucun document.</p>}
        {documents.map(doc => (
          <div key={doc.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-white p-3 text-sm">
            <span><b>{doc.title}</b> · {formatDateFR(doc.createdAt)}</span>
            <Button size="sm" variant="outline" onClick={() => window.open(cabinetPath(`/print/document/${patient.id}/${doc.id}`), '_blank')}><Printer size={15} className="me-1" />Imprimer</Button>
          </div>
        ))}
      </section>

      <Dialog open={rxOpen} onOpenChange={setRxOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Nouvelle ordonnance</DialogTitle>
            <DialogDescription>{patient.allergies ? `⚠ Allergies : ${patient.allergies}` : 'Aucune allergie connue.'}</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); createRx.mutate() }}>
            {templates.length > 0 && (
              <NativeSelect aria-label="Ordonnance type" value="" onChange={e => { const tpl = templates.find(x => x.id === e.target.value); if (tpl) setItems(tpl.items) }}>
                <option value="">Partir d’une ordonnance type…</option>
                {templates.map(tpl => <option key={tpl.id} value={tpl.id}>{tpl.name}</option>)}
              </NativeSelect>
            )}
            <datalist id="drug-list">{drugs.map(d => <option key={d} value={d} />)}</datalist>
            {items.map((item, index) => (
              <div key={index} className="grid gap-2 rounded-xl bg-muted/60 p-2.5 sm:grid-cols-[1.4fr_1.4fr_0.8fr_auto]">
                <Input list="drug-list" placeholder="Médicament" value={item.drug} onChange={e => { setItem(index, { drug: e.target.value }); setDrugSearch(e.target.value) }} aria-label={`Médicament ${index + 1}`} />
                <Input placeholder="Posologie" value={item.dosage || ''} onChange={e => setItem(index, { dosage: e.target.value })} aria-label="Posologie" />
                <Input placeholder="Durée" value={item.duration || ''} onChange={e => setItem(index, { duration: e.target.value })} aria-label="Durée" />
                <Button type="button" size="icon" variant="ghost" aria-label="Retirer la ligne" onClick={() => setItems(list => (list.length > 1 ? list.filter((_, i) => i !== index) : list))}><Trash2 size={15} /></Button>
              </div>
            ))}
            <Button type="button" size="sm" variant="outline" onClick={() => setItems(list => [...list, { drug: '', dosage: '', duration: '' }])}><Plus size={15} className="me-1" />Ligne</Button>
            <div className="space-y-1.5"><Label htmlFor="rx-notes">Recommandations</Label><Textarea id="rx-notes" rows={2} value={rxNotes} onChange={e => setRxNotes(e.target.value)} /></div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => { const name = window.prompt('Nom de l’ordonnance type'); if (name) saveTemplate.mutate(name) }} disabled={!items.some(i => i.drug.trim())}><Save size={15} className="me-1" />Enregistrer comme type</Button>
              <Button type="submit" disabled={!items.some(i => i.drug.trim()) || createRx.isPending}><Printer size={15} className="me-1.5" />Créer et imprimer</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={docType !== null} onOpenChange={(open) => !open && setDocType(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{docTitle}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); createDoc.mutate() }}>
            <div className="space-y-1.5"><Label htmlFor="doc-title">Titre</Label><Input id="doc-title" value={docTitle} onChange={e => setDocTitle(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="doc-body">Texte</Label><Textarea id="doc-body" rows={10} value={docBody} onChange={e => setDocBody(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={createDoc.isPending}><Printer size={15} className="me-1.5" />Créer et imprimer</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  )
}
