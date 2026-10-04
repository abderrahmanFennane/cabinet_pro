import { useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileImage, FileText, Trash2, Upload } from 'lucide-react'
import api from '../../lib/api'
import { apiError, useCabinetApi, useCabinetId } from '../../lib/hooks'
import { formatDateFR } from '../../lib/utils'
import { formatSize, openAttachment } from '../../lib/files'
import { Attachment, Patient } from '../../types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { NativeSelect } from '../ui/native-select'
import { useL } from '../../lib/labels'

const TYPES: { value: Attachment['type']; label: string }[] = [
  { value: 'XRAY', label: 'Radio' }, { value: 'LAB', label: 'Analyse' }, { value: 'REPORT', label: 'Compte rendu' }, { value: 'PHOTO', label: 'Photo' }, { value: 'OTHER', label: 'Autre' },
]

/** F-PAT-05: X-rays, lab results and reports (PDF, images), classified by type; dental X-rays linked to teeth. */
export default function FilesTab({ patient }: { patient: Patient }) {
  const L = useL()
  const cabinetApi = useCabinetApi()
  const cabinetId = useCabinetId()
  const base = `${cabinetApi}/patients/${patient.id}/attachments`
  const queryClient = useQueryClient()
  const input = useRef<HTMLInputElement>(null)
  const [type, setType] = useState<Attachment['type']>('XRAY')
  const [title, setTitle] = useState('')
  const [teeth, setTeeth] = useState('')
  const [filter, setFilter] = useState<'ALL' | Attachment['type']>('ALL')

  const { data: files = [] } = useQuery({ queryKey: ['attachments', patient.id], queryFn: async () => (await api.get(base)).data.data as Attachment[] })

  const upload = useMutation({
    mutationFn: (file: File) => {
      const form = new FormData()
      form.append('file', file)
      form.append('type', type)
      if (title) form.append('title', title)
      if (teeth) form.append('teeth', teeth)
      return api.post(base, form)
    },
    onSuccess: () => {
      toast.success(L('Fichier ajouté'))
      setTitle(''); setTeeth('')
      ;['attachments', 'timeline', 'tooth'].forEach(key => queryClient.invalidateQueries({ queryKey: [key, patient.id] }))
    },
    onError: (err) => toast.error(apiError(err)),
  })
  const remove = useMutation({
    mutationFn: (id: string) => api.delete(`${base}/${id}`),
    onSuccess: () => { toast.success(L('Fichier supprimé')); queryClient.invalidateQueries({ queryKey: ['attachments', patient.id] }) },
    onError: (err) => toast.error(apiError(err)),
  })

  const shown = files.filter(f => filter === 'ALL' || f.type === filter)

  return (
    <div className="space-y-4">
      <form className="grid gap-3 rounded-[14px] border border-[#D8E1DD] bg-white p-4 sm:grid-cols-[140px_1fr_140px_auto] sm:items-end" onSubmit={e => e.preventDefault()}>
        <div className="space-y-1.5"><Label htmlFor="f-type">{L('Type')}</Label>
          <NativeSelect id="f-type" value={type} onChange={e => setType(e.target.value as Attachment['type'])}>{TYPES.map(t => <option key={t.value} value={t.value}>{L(t.label)}</option>)}</NativeSelect>
        </div>
        <div className="space-y-1.5"><Label htmlFor="f-title">{L('Titre')}</Label><Input id="f-title" value={title} onChange={e => setTitle(e.target.value)} placeholder={L('ex. Panoramique initial')} /></div>
        <div className="space-y-1.5"><Label htmlFor="f-teeth">{L('Dent(s)')}</Label><Input id="f-teeth" value={teeth} onChange={e => setTeeth(e.target.value)} placeholder={L('ex. 36')} /></div>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload.mutate(f); e.target.value = '' }} />
        <Button type="button" onClick={() => input.current?.click()} disabled={upload.isPending}><Upload size={16} className="me-1.5" />{upload.isPending ? L('Envoi…') : L('Ajouter')}</Button>
      </form>

      <div className="flex flex-wrap gap-1.5">
        {[{ value: 'ALL', label: L('Tous') }, ...TYPES].map(t => (
          <Button key={t.value} size="sm" variant={filter === t.value ? 'default' : 'outline'} onClick={() => setFilter(t.value as any)}>{L(t.label)}</Button>
        ))}
      </div>

      {shown.length === 0 ? <p className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">{L('Aucun fichier.')}</p> : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {shown.map(file => (
            <li key={file.id} className="flex items-center gap-3 rounded-xl border border-border bg-white p-3">
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-start" onClick={() => openAttachment(cabinetId, patient.id, file.id).catch(() => toast.error('Ouverture impossible'))}>
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent text-primary">{file.mimeType === 'application/pdf' ? <FileText size={18} /> : <FileImage size={18} />}</span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{file.title || file.fileName}</span>
                  <span className="block text-xs text-muted-foreground">{L(TYPES.find(t => t.value === file.type)?.label || '')} · {formatDateFR(file.createdAt)} · {formatSize(file.size)}{file.teeth ? ` · dent(s) ${file.teeth}` : ''}</span>
                </span>
              </button>
              <Button size="icon" variant="ghost" className="h-9 w-9" aria-label={L('Supprimer')} onClick={() => { if (window.confirm(L('Supprimer ce fichier ?'))) remove.mutate(file.id) }}><Trash2 size={15} /></Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
