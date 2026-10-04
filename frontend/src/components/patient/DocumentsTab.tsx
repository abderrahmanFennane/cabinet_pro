import { useCallback, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FileSignature, Pill, Plus, Printer, RefreshCw, Send } from 'lucide-react'
import ShareDialog, { ShareTarget } from './ShareDialog'
import PrescriptionForm from './PrescriptionForm'
import api from '../../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi, useCabinetPath } from '../../lib/hooks'
import { formatDateFR } from '../../lib/utils'
import { DocumentType, MedicalDocument, Patient, Prescription } from '../../types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '../ui/dialog'
import { useL } from '../../lib/labels'

const DOC_TYPES: { type: DocumentType; label: string; template: (p: Patient, doctor: string) => string }[] = [
  { type: 'CERTIFICATE', label: 'Certificat médical', template: (p, d) => `Je soussigné(e), ${d}, certifie avoir examiné ce jour ${p.sex === 'F' ? 'Mme' : 'M.'} ${p.firstName} ${p.lastName}${p.birthDate ? `, né(e) le ${formatDateFR(p.birthDate)}` : ''}.\n\n\n\nCertificat établi à la demande de l’intéressé(e) et remis en main propre pour servir et valoir ce que de droit.` },
  { type: 'SICK_LEAVE', label: 'Arrêt de travail', template: (p, d) => `Je soussigné(e), ${d}, certifie que l’état de santé de ${p.sex === 'F' ? 'Mme' : 'M.'} ${p.firstName} ${p.lastName} nécessite un arrêt de travail de ___ jours, du ${formatDateFR(new Date())} au ___ inclus, sauf complications.` },
  { type: 'REFERRAL', label: 'Lettre d’orientation', template: (p) => `Cher(e) confrère,\n\nJe vous adresse ${p.sex === 'F' ? 'Mme' : 'M.'} ${p.firstName} ${p.lastName}${p.age !== null ? `, ${p.age} ans,` : ''} pour :\n\n\n\nJe vous remercie de votre avis et vous prie de croire à mes sentiments confraternels.` },
  { type: 'PHYSIO_PRESCRIPTION', label: 'Prescription de kinésithérapie', template: (p) => `Prière de pratiquer à ${p.sex === 'F' ? 'Mme' : 'M.'} ${p.firstName} ${p.lastName}${p.age !== null ? `, ${p.age} ans,` : ''} :\n\n___ séances de kinésithérapie / rééducation, à raison de ___ séance(s) par semaine.\n\nIndication : \n\nTechniques souhaitées : rééducation fonctionnelle, renforcement musculaire, physiothérapie antalgique, \n\nÀ domicile : non\nBilan kinésithérapique et compte rendu en fin de traitement souhaités.` },
  { type: 'EXAM_REQUEST', label: 'Demande d’examens', template: (p) => `Prière de pratiquer à ${p.sex === 'F' ? 'Mme' : 'M.'} ${p.firstName} ${p.lastName} les examens suivants :\n\n- \n- \n\nRenseignements cliniques : ` },
]

export default function DocumentsTab({ patient }: { patient: Patient }) {
  const L = useL()
  const { t } = useTranslation()
  const { user, hasPermissions } = useAuth()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const base = `${cabinetApi}/patients/${patient.id}`
  const queryClient = useQueryClient()
  const canWrite = hasPermissions('MANAGE_PRESCRIPTIONS')
  const [rxOpen, setRxOpen] = useState(false)
  const [sharing, setSharing] = useState<ShareTarget | null>(null)
  const closeShare = useCallback(() => setSharing(null), [])
  const [docType, setDocType] = useState<DocumentType | null>(null)
  const [docTitle, setDocTitle] = useState('')
  const [docBody, setDocBody] = useState('')

  const { data: prescriptions = [] } = useQuery({ queryKey: ['prescriptions', patient.id], queryFn: async () => (await api.get(`${base}/prescriptions`)).data.data as Prescription[] })
  const { data: documents = [] } = useQuery({ queryKey: ['documents', patient.id], queryFn: async () => (await api.get(`${base}/documents`)).data.data as MedicalDocument[] })

  const refresh = () => ['prescriptions', 'documents', 'timeline'].forEach(key => queryClient.invalidateQueries({ queryKey: [key, patient.id] }))
  const printRx = (id: string) => window.open(cabinetPath(`/print/prescription/${patient.id}/${id}`), '_blank')

  const renew = useMutation({
    mutationFn: async (id: string) => (await api.post(`${base}/prescriptions/${id}/renew`)).data.data as Prescription,
    onSuccess: (rx) => { toast.success(L('Ordonnance renouvelée')); refresh(); printRx(rx.id) },
    onError: (err) => toast.error(apiError(err)),
  })
  const createDoc = useMutation({
    mutationFn: async () => (await api.post(`${base}/documents`, { type: docType, title: docTitle, body: docBody })).data.data as MedicalDocument,
    onSuccess: (doc) => { toast.success(L('Document créé')); refresh(); setDocType(null); window.open(cabinetPath(`/print/document/${patient.id}/${doc.id}`), '_blank') },
    onError: (err) => toast.error(apiError(err)),
  })

  const openRx = () => setRxOpen(true)
  const openDoc = (type: DocumentType) => {
    const def = DOC_TYPES.find(d => d.type === type)!
    setDocType(type); setDocTitle(def.label); setDocBody(def.template(patient, practitionerName(user as any)))
  }

  return (
    <div className="space-y-6">
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">{L('Ordonnances')}</h3>
          {canWrite && <Button size="sm" onClick={openRx}><Plus size={16} className="me-1" />{L('Nouvelle ordonnance')}</Button>}
        </div>
        {prescriptions.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{L('Aucune ordonnance.')}</p>}
        {prescriptions.map(rx => (
          <article key={rx.id} className="flex flex-wrap items-start justify-between gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4">
            <div className="min-w-0 space-y-1">
              <p className="text-xs text-muted-foreground">{formatDateFR(rx.date)} · {practitionerName(rx.practitioner)}</p>
              <ul className="text-sm">{rx.items.map((item, i) => <li key={i}><Pill size={13} className="me-1.5 inline text-primary" /><b>{item.drug}</b>{item.dosage ? ` — ${item.dosage}` : ''}{item.duration ? ` · ${item.duration}` : ''}</li>)}</ul>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => printRx(rx.id)}><Printer size={15} className="me-1" />{L('Imprimer')}</Button>
              <Button size="sm" variant="outline" onClick={() => setSharing({ kind: 'PRESCRIPTION', refId: rx.id, patientId: patient.id, label: t('share.kind.PRESCRIPTION') })}><Send size={15} className="me-1 rtl:rotate-180" />{t('share.send')}</Button>
              {canWrite && <Button size="sm" variant="secondary" onClick={() => renew.mutate(rx.id)}><RefreshCw size={15} className="me-1" />{L('Renouveler')}</Button>}
            </div>
          </article>
        ))}
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">{L('Certificats et courriers')}</h3>
          {canWrite && (
            <div className="flex flex-wrap gap-1.5">
              {DOC_TYPES.map(d => <Button key={d.type} size="sm" variant="outline" onClick={() => openDoc(d.type)}><FileSignature size={15} className="me-1" />{L(d.label)}</Button>)}
            </div>
          )}
        </div>
        {documents.length === 0 && <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{L('Aucun document.')}</p>}
        {documents.map(doc => (
          <div key={doc.id} className="flex items-center justify-between gap-2 rounded-xl border border-border bg-white p-3 text-sm">
            <span><b>{doc.title}</b> · {formatDateFR(doc.createdAt)}</span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => window.open(cabinetPath(`/print/document/${patient.id}/${doc.id}`), '_blank')}><Printer size={15} className="me-1" />{L('Imprimer')}</Button>
              <Button size="sm" variant="outline" onClick={() => setSharing({ kind: 'DOCUMENT', refId: doc.id, patientId: patient.id, label: doc.title })}><Send size={15} className="me-1 rtl:rotate-180" />{t('share.send')}</Button>
            </div>
          </div>
        ))}
      </section>

      <Dialog open={rxOpen} onOpenChange={setRxOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{L('Nouvelle ordonnance')}</DialogTitle>
            <DialogDescription>{patient.allergies ? `${patient.lastName} ${patient.firstName}` : L('Aucune allergie connue.')}</DialogDescription>
          </DialogHeader>
          <PrescriptionForm patient={patient} onCreated={() => setRxOpen(false)} />
        </DialogContent>
      </Dialog>

      <Dialog open={docType !== null} onOpenChange={(open) => !open && setDocType(null)}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader><DialogTitle>{docTitle}</DialogTitle></DialogHeader>
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); createDoc.mutate() }}>
            <div className="space-y-1.5"><Label htmlFor="doc-title">{L('Titre')}</Label><Input id="doc-title" value={docTitle} onChange={e => setDocTitle(e.target.value)} /></div>
            <div className="space-y-1.5"><Label htmlFor="doc-body">{L('Texte')}</Label><Textarea id="doc-body" rows={10} value={docBody} onChange={e => setDocBody(e.target.value)} /></div>
            <Button type="submit" className="w-full" disabled={createDoc.isPending}><Printer size={15} className="me-1.5" />{L('Créer et imprimer')}</Button>
          </form>
        </DialogContent>
      </Dialog>
      <ShareDialog target={sharing} onClose={closeShare} />
    </div>
  )
}
