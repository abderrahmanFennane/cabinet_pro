import { useEffect, useRef, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { Camera, Loader2, Trash2 } from 'lucide-react'
import api from '../../lib/api'
import { apiError } from '../../lib/hooks'
import { useL } from '../../lib/labels'
import { cn } from '../../lib/utils'
import { LANGUAGE_NAMES, specialtyByCode } from '../../lib/booking'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { Textarea } from '../ui/textarea'
import { SpecialtyArt } from '../brand'
import { LinkRow } from './LinkRow'

type Account = {
  id: string; firstName: string; lastName: string; title: string | null; specialty: string | null; cabinetId: string | null
  avatar: string | null; bio: string | null; languages: string[]; consultationFee: number | null
}
type Links = { enabled: boolean; slug: string | null; doctors: { id: string; specialty: string; slug: string }[] }

/** What a doctor shows on their public booking page: photo, presentation, languages, fee. */
export function DoctorProfileForm({ userId, onSaved }: { userId: string; onSaved?: () => void }) {
  const L = useL()
  const queryClient = useQueryClient()
  const fileInput = useRef<HTMLInputElement>(null)
  const { data: account } = useQuery({
    queryKey: ['user', userId],
    queryFn: async () => (await api.get(`/users/${userId}`)).data.data as Account,
  })
  const { data: links } = useQuery({
    queryKey: ['booking-links', account?.cabinetId],
    queryFn: async () => (await api.get(`/cabinets/${account!.cabinetId}/booking-links`)).data.data as Links,
    enabled: !!account?.cabinetId,
  })
  const [form, setForm] = useState({ avatar: '' as string | null, bio: '', languages: [] as string[], fee: '' })
  const [uploading, setUploading] = useState(false)
  useEffect(() => {
    if (account) setForm({ avatar: account.avatar, bio: account.bio || '', languages: account.languages, fee: account.consultationFee != null ? String(account.consultationFee) : '' })
  }, [account])

  const save = useMutation({
    mutationFn: () => api.patch(`/users/${userId}`, {
      avatar: form.avatar || null, bio: form.bio.trim() || null, languages: form.languages, consultationFee: form.fee.trim() ? Math.round(Number(form.fee)) : null,
    }),
    onSuccess: () => {
      toast.success(L('Page publique enregistrée'))
      queryClient.invalidateQueries({ queryKey: ['user', userId] })
      onSaved?.()
    },
    onError: (err) => toast.error(L(apiError(err))),
  })

  const upload = async (file?: File) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) { toast.error(L('Photo trop lourde (5 Mo maximum)')); return }
    setUploading(true)
    try {
      const body = new FormData()
      body.append('file', file)
      const { data } = await api.post('/uploads/avatars', body)
      // Full address: in production the photos are served by the API's domain, not the app's.
      setForm(f => ({ ...f, avatar: data.data.url }))
    } catch (err) { toast.error(L(apiError(err))) } finally { setUploading(false); if (fileInput.current) fileInput.current.value = '' }
  }

  if (!account) return <p className="text-sm text-[#5A6B65]">{L('Chargement…')}</p>
  const mine = links?.doctors.find(d => d.id === userId)
  const publicUrl = links?.enabled && links.slug && mine ? `/rdv/${specialtyByCode(mine.specialty)?.slug || 'medecin-generaliste'}/${links.slug}/${mine.slug}` : null
  const toggleLanguage = (code: string) => setForm(f => ({ ...f, languages: f.languages.includes(code) ? f.languages.filter(l => l !== code) : [...f.languages, code] }))

  return (
    <form className="grid gap-4" onSubmit={e => { e.preventDefault(); save.mutate() }}>
      {publicUrl && (
        <div className="grid gap-2 rounded-2xl bg-[#F2F7F5] p-3.5">
          <b className="text-[0.95rem]">{L('Lien de réservation')}</b>
          <LinkRow link={`${window.location.origin}${publicUrl}`} label={L('Lien de réservation')} />
          <p className="text-[0.82rem] text-[#5A6B65]">{L('Partagez-le sur Google Maps, Instagram, Facebook ou WhatsApp : le patient arrive directement sur l’agenda du médecin.')}</p>
        </div>
      )}
      <div className="flex flex-wrap items-center gap-4">
        {form.avatar
          ? <img src={form.avatar} alt="" className="h-20 w-20 rounded-full border border-[#D8E1DD] object-cover" />
          : <SpecialtyArt specialty={account.specialty} size="lg" className="!h-20 !w-20" />}
        <div className="grid gap-2">
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => upload(e.target.files?.[0])} />
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={uploading} onClick={() => fileInput.current?.click()}>
              {uploading ? <Loader2 size={16} className="me-1.5 animate-spin" /> : <Camera size={16} className="me-1.5" />}{form.avatar ? L('Changer la photo') : L('Ajouter une photo')}
            </Button>
            {form.avatar && <Button type="button" variant="ghost" onClick={() => setForm(f => ({ ...f, avatar: null }))}><Trash2 size={16} className="me-1.5" />{L('Retirer')}</Button>}
          </div>
          <p className="text-[0.82rem] text-[#5A6B65]">{L('Photo de face, JPG ou PNG, 5 Mo maximum.')}</p>
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="dp-bio">{L('Présentation du médecin')}</Label>
        <Textarea id="dp-bio" rows={5} maxLength={1500} value={form.bio} onChange={e => setForm(f => ({ ...f, bio: e.target.value }))}
          placeholder={L('ex. Diplômé de la Faculté de médecine de Rabat, 12 ans d’expérience. Suivi du nourrisson, vaccinations, pédiatrie générale.')} />
        <p className="text-end text-[0.78rem] text-[#5A6B65]">{form.bio.length} / 1500</p>
      </div>

      <div className="space-y-2">
        <span className="text-sm font-medium">{L('Langues parlées')}</span>
        <div className="flex flex-wrap gap-2">
          {Object.entries(LANGUAGE_NAMES).map(([code, name]) => (
            <button key={code} type="button" aria-pressed={form.languages.includes(code)} onClick={() => toggleLanguage(code)}
              className={cn('rounded-full border px-3.5 py-1.5 text-[0.9rem] font-semibold', form.languages.includes(code) ? 'border-primary bg-primary text-white' : 'border-[#D8E1DD] bg-white hover:border-primary')}>{name}</button>
          ))}
        </div>
      </div>

      <div className="max-w-[220px] space-y-1.5">
        <Label htmlFor="dp-fee">{L('Prix de la consultation (MAD)')}</Label>
        <Input id="dp-fee" type="number" inputMode="numeric" min={0} max={100000} value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))} placeholder={L('facultatif')} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button type="submit" disabled={save.isPending || uploading}>{L('Enregistrer')}</Button>
        {links && !links.enabled && <span className="text-[0.84rem] text-[#5A6B65]">{L('La page sera visible quand le cabinet activera les rendez-vous en ligne.')}</span>}
      </div>
    </form>
  )
}
