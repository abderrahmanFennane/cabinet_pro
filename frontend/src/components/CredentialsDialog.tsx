import { useState } from 'react'
import { Check, Copy, MessageCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from './ui/dialog'
import { Button } from './ui/button'
import { whatsappLink } from '../pages/SubscriptionBlocked'

// No 0/O, 1/l/I: the password is often read aloud or typed from a phone.
const LETTERS = 'abcdefghjkmnpqrstuvwxyz'
const UPPER = 'ABCDEFGHJKMNPQRSTUVWXYZ'
const DIGITS = '23456789'

/** Easy to read and dictate, e.g. "Kmr-7tq4-Zp". Meets the 8-character minimum. */
export function generatePassword() {
  const pick = (set: string) => set[crypto.getRandomValues(new Uint32Array(1))[0] % set.length]
  const chunk = (n: number) => Array.from({ length: n }, () => pick(LETTERS + DIGITS)).join('')
  return `${pick(UPPER)}${chunk(2)}-${chunk(4)}-${pick(UPPER)}${pick(DIGITS)}`
}

export type Credentials = { name: string; email: string; password: string; phone?: string | null; cabinetName?: string | null }

/** Shown once after creating an account or resetting a password, so the details can be passed on. */
export default function CredentialsDialog({ credentials, onClose }: { credentials: Credentials | null; onClose: () => void }) {
  const [copied, setCopied] = useState(false)
  if (!credentials) return null
  const loginUrl = `${window.location.origin}/login`
  const message = [
    `Bonjour ${credentials.name},`,
    `Votre accès à Cabinet Pro${credentials.cabinetName ? ` (${credentials.cabinetName})` : ''} :`,
    `Adresse : ${loginUrl}`,
    `Email : ${credentials.email}`,
    `Mot de passe : ${credentials.password}`,
    'Pensez à le changer après votre première connexion.',
  ].join('\n')

  const copy = async () => {
    try { await navigator.clipboard.writeText(message); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* clipboard blocked: the text stays selectable */ }
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Identifiants de {credentials.name}</DialogTitle>
          <DialogDescription>Transmettez-les maintenant : le mot de passe ne sera plus affiché.</DialogDescription>
        </DialogHeader>
        <dl className="grid grid-cols-[110px_1fr] gap-x-3 gap-y-2 rounded-xl bg-[#F2F5F3] p-4 text-[0.95rem]">
          <dt className="text-[#5A6B65]">Adresse</dt><dd className="break-all font-medium">{loginUrl}</dd>
          <dt className="text-[#5A6B65]">Email</dt><dd className="break-all font-medium">{credentials.email}</dd>
          <dt className="text-[#5A6B65]">Mot de passe</dt><dd className="select-all font-mono text-[1.05rem] font-semibold tracking-wide">{credentials.password}</dd>
        </dl>
        <div className="flex flex-wrap gap-2">
          <Button onClick={copy}>{copied ? <Check size={16} className="me-1.5" /> : <Copy size={16} className="me-1.5" />}{copied ? 'Copié' : 'Copier le message'}</Button>
          {credentials.phone && (
            <Button asChild variant="outline"><a href={`${whatsappLink(credentials.phone)}?text=${encodeURIComponent(message)}`} target="_blank" rel="noreferrer"><MessageCircle size={16} className="me-1.5" />Envoyer par WhatsApp</a></Button>
          )}
          <Button variant="ghost" onClick={onClose}>Terminé</Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
