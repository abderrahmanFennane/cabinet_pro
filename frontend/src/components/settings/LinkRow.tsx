import { toast } from 'sonner'
import { Copy, ExternalLink } from 'lucide-react'
import { useL } from '../../lib/labels'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

/** Address of a booking page, with Copy and Open. */
export function LinkRow({ link, label }: { link: string; label: string }) {
  const L = useL()
  const copy = () => navigator.clipboard?.writeText(link).then(() => toast.success(L('Lien copié')), () => toast.error(L('Copie impossible : sélectionnez le lien')))
  return (
    <div className="flex flex-wrap gap-2">
      <Input readOnly value={link} aria-label={label} className="min-w-0 flex-1 basis-64 font-mono text-[0.84rem]" dir="ltr" onFocus={e => e.target.select()} />
      <Button type="button" variant="outline" onClick={copy}><Copy size={16} className="me-1.5" />{L('Copier')}</Button>
      <Button asChild variant="outline"><a href={link} target="_blank" rel="noreferrer"><ExternalLink size={16} className="me-1.5" />{L('Ouvrir')}</a></Button>
    </div>
  )
}
