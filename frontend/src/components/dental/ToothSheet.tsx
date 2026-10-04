import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CheckCircle2, FileImage, Plus, X } from 'lucide-react'
import api from '../../lib/api'
import { apiError, practitionerName } from '../../lib/hooks'
import { cn, formatCurrency, formatDateFR } from '../../lib/utils'
import { openAttachment } from '../../lib/files'
import { Face, ToothSheet as ToothSheetData, ToothStateCode } from '../../types'
import { Button } from '../ui/button'
import { Textarea } from '../ui/textarea'
import { Label } from '../ui/label'
import { TOOTH_STATE_CODES } from './Odontogram'
import ToothGlyph from './ToothGlyph'
import { useL } from '../../lib/labels'

const FACES: Face[] = ['M', 'D', 'O', 'I', 'V', 'L', 'P']

type Props = {
  base: string
  cabinetId: string
  patientId: string
  tooth: number
  currency: string
  onClose: () => void
  onAddAct: () => void
}

/** F-DEN-04: current state, faces, dated history with practitioner, X-rays and notes of one tooth. */
export default function ToothSheet({ base, cabinetId, patientId, tooth, currency, onClose, onAddAct }: Props) {
  const L = useL()
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['tooth', patientId, tooth],
    queryFn: async () => (await api.get(`${base}/teeth/${tooth}`)).data.data as ToothSheetData,
    refetchInterval: false,
  })
  const [state, setState] = useState<ToothStateCode>('HEALTHY')
  const [faces, setFaces] = useState<Face[]>([])
  const [notes, setNotes] = useState('')

  useEffect(() => {
    if (!data) return
    setState(data.state.state)
    setFaces((data.state.faces?.split(',').filter(Boolean) || []) as Face[])
    setNotes(data.state.notes || '')
  }, [data])

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ['tooth', patientId] })
    queryClient.invalidateQueries({ queryKey: ['dental-chart', patientId] })
    queryClient.invalidateQueries({ queryKey: ['dental-plans', patientId] })
    queryClient.invalidateQueries({ queryKey: ['patient', patientId] })
  }

  const save = useMutation({
    mutationFn: () => api.put(`${base}/teeth/${tooth}`, { state, faces, notes: notes || null }),
    onSuccess: () => { toast.success(`${L('Dent')} ${tooth} ${L('mise à jour')}`); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })

  const perform = useMutation({
    mutationFn: (actId: string) => api.post(`${base}/acts/${actId}/perform`),
    onSuccess: () => { toast.success(L('Acte réalisé')); refresh() },
    onError: (err) => toast.error(apiError(err)),
  })

  const toggleFace = (face: Face) => setFaces(list => (list.includes(face) ? list.filter(f => f !== face) : [...list, face]))

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">{L('Fiche de la dent')}</p>
          <div className="flex items-center gap-3">
            <ToothGlyph tooth={tooth} state={state} upper={Math.floor(tooth / 10) % 4 === 1 || Math.floor(tooth / 10) % 4 === 2} className="h-16 w-auto" />
            <h3 className="font-mono text-2xl font-bold text-primary">{tooth}</h3>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" onClick={onAddAct}><Plus size={16} className="me-1" />{L('Acte')}</Button>
          <Button size="icon" variant="ghost" className="h-9 w-9" onClick={onClose} aria-label={L('Fermer la fiche')}><X size={18} /></Button>
        </div>
      </div>

      {isLoading || !data ? (
        <p className="py-6 text-sm text-muted-foreground">{L('Chargement…')}</p>
      ) : (
        <div className="flex-1 space-y-5 overflow-y-auto py-4">
          <section className="space-y-2">
            <Label>{L('État')}</Label>
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
              {TOOTH_STATE_CODES.map(code => (
                <button
                  key={code}
                  type="button"
                  onClick={() => setState(code)}
                  aria-pressed={state === code}
                  className={cn('flex min-h-[48px] items-center gap-2 rounded-lg border px-2 text-start text-xs font-semibold', state === code ? 'border-primary bg-accent text-primary' : 'border-border hover:bg-muted')}
                >
                  <ToothGlyph tooth={tooth} state={code} upper={Math.floor(tooth / 10) % 4 === 1 || Math.floor(tooth / 10) % 4 === 2} className="h-8 w-auto shrink-0" />
                  {t(`toothState.${code}`)}
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <Label>{L('Faces concernées')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {FACES.map(face => (
                <button
                  key={face}
                  type="button"
                  onClick={() => toggleFace(face)}
                  aria-pressed={faces.includes(face)}
                  title={t(`face.${face}`)}
                  className={cn('min-h-[40px] min-w-[44px] rounded-lg border px-2 font-mono text-sm font-bold', faces.includes(face) ? 'border-primary bg-primary text-white' : 'border-border hover:bg-muted')}
                >
                  {face}
                </button>
              ))}
            </div>
            <p className="text-xs text-muted-foreground">{L('M mésiale · D distale · O occlusale · I incisive · V vestibulaire · L linguale · P palatine')}</p>
          </section>

          <section className="space-y-2">
            <Label htmlFor="tooth-notes">{L('Notes')}</Label>
            <Textarea id="tooth-notes" rows={2} value={notes} onChange={e => setNotes(e.target.value)} />
            <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>{L('Enregistrer l’état')}</Button>
          </section>

          {data.planned.length > 0 && (
            <section className="space-y-2">
              <h4 className="text-sm font-semibold">{L('Actes planifiés')}</h4>
              {data.planned.map(act => (
                <div key={act.id} className="flex items-center justify-between gap-2 rounded-xl border border-border p-2.5 text-sm">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{act.label}</p>
                    <p className="text-xs text-muted-foreground">{[act.faces && `faces ${act.faces.replace(/,/g, '')}`, formatCurrency(act.price, currency)].filter(Boolean).join(' · ')}</p>
                  </div>
                  <Button size="sm" variant="secondary" onClick={() => perform.mutate(act.id)} disabled={perform.isPending}>
                    <CheckCircle2 size={15} className="me-1" />{L('Réaliser')}
                  </Button>
                </div>
              ))}
            </section>
          )}

          <section className="space-y-2">
            <h4 className="text-sm font-semibold">{L('Historique')}</h4>
            {data.history.length === 0 ? (
              <p className="text-sm text-muted-foreground">{L('Aucun acte réalisé sur cette dent.')}</p>
            ) : (
              <ol className="space-y-2 border-s-2 border-border ps-3">
                {data.history.map(act => (
                  <li key={act.id} className="text-sm">
                    <p className="font-semibold">{act.label}{act.faces ? ` · ${act.faces.replace(/,/g, '')}` : ''}</p>
                    <p className="text-xs text-muted-foreground">{formatDateFR(act.performedAt)} · {practitionerName(act.practitioner)}</p>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="space-y-2">
            <h4 className="text-sm font-semibold">{L('Radios')}</h4>
            {data.attachments.length === 0 ? (
              <p className="text-sm text-muted-foreground">{L('Aucune radio rattachée. Ajoutez-en depuis l’onglet Fichiers en indiquant la dent')} {tooth}.</p>
            ) : data.attachments.map(file => (
              <button key={file.id} type="button" onClick={() => openAttachment(cabinetId, patientId, file.id)} className="flex w-full items-center gap-2 rounded-lg border border-border p-2 text-start text-sm hover:bg-muted">
                <FileImage size={16} className="text-primary" /> <span className="truncate">{file.title || file.fileName}</span>
                <span className="ms-auto text-xs text-muted-foreground">{formatDateFR(file.createdAt)}</span>
              </button>
            ))}
          </section>
        </div>
      )}
    </div>
  )
}
