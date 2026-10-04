import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { FileSignature, Printer } from 'lucide-react'
import api from '../../lib/api'
import { apiError, practitionerName, useAuth, useCabinetApi, useCabinetPath } from '../../lib/hooks'
import { useL } from '../../lib/labels'
import { cn, formatDateFR } from '../../lib/utils'
import { Patient } from '../../types'
import { Button } from '../../components/ui/button'
import { Label } from '../../components/ui/label'
import { Textarea } from '../../components/ui/textarea'
import { ClinicalRecord } from '../records'
import { Section } from '../ui'
import { PNI_CALENDAR, Vaccine } from './shared'

type Kind = 'COLLECTIVITY' | 'SPORT' | 'VACCINATION' | 'NO_CONTAGION'
const TITLES: Record<Kind, string> = {
  COLLECTIVITY: 'Certificat de bonne santé (crèche, école)', SPORT: 'Certificat d’aptitude au sport',
  VACCINATION: 'Certificat de vaccination', NO_CONTAGION: 'Certificat de non-contagion',
}

/** Pediatric certificates, prefilled from the file (vaccines done) and editable before printing. Printed in French. */
export default function CertificatesTab({ patient, vaccines }: { patient: Patient; vaccines: ClinicalRecord<Vaccine>[] }) {
  const L = useL()
  const { user } = useAuth()
  const cabinetApi = useCabinetApi()
  const cabinetPath = useCabinetPath()
  const queryClient = useQueryClient()
  const [kind, setKind] = useState<Kind | null>(null)
  const [body, setBody] = useState('')

  const child = `l’enfant ${patient.firstName} ${patient.lastName}${patient.birthDate ? `, né${patient.sex === 'F' ? 'e' : ''} le ${formatDateFR(patient.birthDate)}` : ''}`
  const me = `Je soussigné(e), ${practitionerName(user) || 'Dr'},`
  const template = (k: Kind) => {
    switch (k) {
      case 'COLLECTIVITY': return `${me} certifie avoir examiné ce jour ${child}.\n\nSon état de santé est compatible avec la vie en collectivité (crèche, garderie, école). Ses vaccinations sont à jour selon le Programme national d’immunisation.\n\nCertificat établi à la demande des parents et remis en main propre pour servir et valoir ce que de droit.`
      case 'SPORT': return `${me} certifie avoir examiné ce jour ${child}, et n’avoir constaté aucune contre-indication apparente à la pratique de l’éducation physique et sportive et des sports suivants : ____________ , y compris en compétition.\n\nCertificat valable pour la saison en cours, établi à la demande des parents et remis en main propre.`
      case 'NO_CONTAGION': return `${me} certifie avoir examiné ce jour ${child}, et que son état ne présente plus de risque de contagion.\n\nL’enfant peut reprendre la crèche / l’école à compter du ${formatDateFR(new Date())}.\n\nCertificat établi à la demande des parents et remis en main propre.`
      case 'VACCINATION': {
        const done = [...vaccines].sort((a, b) => a.date.localeCompare(b.date)).map(v => `- ${PNI_CALENDAR.find(c => c.code === v.data.code)?.label || v.data.code} : ${formatDateFR(v.date)}${v.data.lot ? ` (lot ${v.data.lot})` : ''}`)
        return `${me} certifie que ${child}, a reçu les vaccinations suivantes :\n\n${done.join('\n') || '- (aucune vaccination enregistrée)'}\n\nCertificat établi à la demande des parents et remis en main propre pour servir et valoir ce que de droit.`
      }
    }
  }
  const create = useMutation({
    mutationFn: async () => (await api.post(`${cabinetApi}/patients/${patient.id}/documents`, { type: 'CERTIFICATE', title: TITLES[kind!], body })).data.data as { id: string },
    onSuccess: (doc) => {
      toast.success(L('Document créé'))
      queryClient.invalidateQueries({ queryKey: ['documents', patient.id] })
      setKind(null)
      window.open(cabinetPath(`/print/document/${patient.id}/${doc.id}`), '_blank')
    },
    onError: (err) => toast.error(apiError(err)),
  })

  return (
    <Section title={L('Certificats pédiatriques')} hint={L('Choisissez un modèle, complétez le texte si besoin, puis créez-le : il est imprimé et rangé dans l’onglet Documents.')}>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(TITLES) as Kind[]).map(k => (
          <Button key={k} type="button" size="sm" variant="outline" className={cn(kind === k && 'border-primary bg-[#EAF5F0] text-primary')} onClick={() => { setKind(k); setBody(template(k)) }}>
            <FileSignature size={15} className="me-1" />{L(TITLES[k])}
          </Button>
        ))}
      </div>
      {kind && (
        <form className="grid gap-3" onSubmit={e => { e.preventDefault(); create.mutate() }}>
          <div className="space-y-1.5"><Label htmlFor="cert-body">{L(TITLES[kind])}</Label><Textarea id="cert-body" rows={10} value={body} onChange={e => setBody(e.target.value)} /></div>
          <p className="text-[0.8rem] text-[#5A6B65]">{L('Le document imprimé reste en français.')}</p>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => setKind(null)}>{L('Annuler')}</Button>
            <Button type="submit" disabled={create.isPending || !body.trim()}><Printer size={16} className="me-1.5" />{L('Créer et imprimer')}</Button>
          </div>
        </form>
      )}
    </Section>
  )
}
