import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import api from '../../lib/api'
import { apiError, useAuth, useCabinetApi } from '../../lib/hooks'
import { useL } from '../../lib/labels'
import { cn, formatCurrency } from '../../lib/utils'
import { Act, Invoice, PaymentMethod } from '../../types'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { NativeSelect } from '../ui/native-select'

const METHODS: PaymentMethod[] = ['CASH', 'CARD', 'CHECK', 'TRANSFER']
type Line = { key: string; actId: string | null; code: string | null; label: string; quantity: number; unitPrice: number }
const today = () => new Date().toISOString().slice(0, 10)

/**
 * Bill and collect in one place: the usual acts as buttons, what the patient already owes, the payment method,
 * one "Encaisser" button. Used at the end of a visit, from the day screen and from the patient's billing tab.
 * - visit: the consultation act is preselected unless the patient was already billed today (e.g. dental acts).
 * - collect: only what is owed, no new act preselected.
 * - invoice: new invoice, can be left unpaid.
 */
export default function ChargeForm({ patientId, mode, onDone }: { patientId: string; mode: 'visit' | 'collect' | 'invoice'; onDone?: () => void }) {
  const L = useL()
  const { t } = useTranslation()
  const { user } = useAuth()
  const cabinetApi = useCabinetApi()
  const queryClient = useQueryClient()
  const currency = user?.cabinet?.currency || 'MAD'
  const { data: acts = [], isLoading: actsLoading } = useQuery({ queryKey: ['acts', cabinetApi], queryFn: async () => (await api.get(`${cabinetApi}/acts`)).data.data as Act[], staleTime: 5 * 60_000 })
  const { data: invoices = [], isLoading: invLoading } = useQuery({
    queryKey: ['invoices', 'patient', patientId],
    queryFn: async () => (await api.get(`${cabinetApi}/billing/invoices`, { params: { patientId } })).data.data as Invoice[],
  })

  // Select box: a doctor sees the acts of their own specialty (by category); the reception sees every specialty of the cabinet.
  const sorted = useMemo(() => {
    const active = acts.filter(a => a.isActive !== false)
    const mine = active.filter(a => a.specialty === user?.specialty)
    return mine.length ? mine : active
  }, [acts, user?.specialty])
  const groups = useMemo(() => {
    const out: { label: string; acts: Act[] }[] = []
    for (const a of sorted) {
      const label = a.specialty === user?.specialty ? a.category : t(`specialty.${a.specialty}`)
      const g = out.find(x => x.label === label) || (out.push({ label, acts: [] }), out[out.length - 1])
      g.acts.push(a)
    }
    return out
  }, [sorted, user?.specialty, t])
  const open = invoices.filter(i => i.status === 'OPEN' || i.status === 'PARTIAL')
  const due = open.reduce((s, i) => s + Number(i.total) - Number(i.paid), 0)
  const billedToday = invoices.some(i => i.date.slice(0, 10) === today() && i.status !== 'CANCELLED')

  const [lines, setLines] = useState<Line[]>([])
  const [includeOpen, setIncludeOpen] = useState(true)
  const [method, setMethod] = useState<PaymentMethod>('CASH')
  const [reference, setReference] = useState('')
  const [amount, setAmount] = useState('')
  const [touched, setTouched] = useState(false)
  const [ready, setReady] = useState(false)

  // Visit: preselect the consultation act once the data is there.
  useEffect(() => {
    if (ready || actsLoading || invLoading) return
    if (mode === 'visit' && !billedToday) {
      const act = sorted.find(a => a.specialty === user?.specialty && /consult/i.test(a.name)) || sorted.find(a => /consult/i.test(a.name))
      if (act) setLines([{ key: act.id, actId: act.id, code: act.code, label: act.name, quantity: 1, unitPrice: Number(act.price) }])
    }
    setReady(true)
  }, [ready, actsLoading, invLoading, mode, billedToday, sorted, user?.specialty])

  const newTotal = lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0)
  const owed = newTotal + (includeOpen ? due : 0)
  // The amount follows the total until the user types another one (partial payment).
  useEffect(() => { if (!touched) setAmount(owed ? String(Math.round(owed * 100) / 100) : '') }, [owed, touched])
  const value = Number(amount) || 0

  // Picking an act already on the invoice adds one to its quantity.
  const add = (a: Act) => setLines(list => (list.some(l => l.actId === a.id)
    ? list.map(l => (l.actId === a.id ? { ...l, quantity: l.quantity + 1 } : l))
    : [...list, { key: a.id, actId: a.id, code: a.code, label: a.name, quantity: 1, unitPrice: Number(a.price) }]))
  const setLine = (key: string, patch: Partial<Line>) => setLines(list => list.map(l => (l.key === key ? { ...l, ...patch } : l)))
  // Free line (any label and price) for what is not in the catalogue.
  const [free, setFree] = useState({ label: '', price: '' })
  const addFree = () => { if (!free.label.trim() || !(Number(free.price) >= 0)) return; setLines(list => [...list, { key: `free-${Date.now()}`, actId: null, code: null, label: free.label.trim(), quantity: 1, unitPrice: Number(free.price) || 0 }]); setFree({ label: '', price: '' }) }
  const charge = useMutation({
    mutationFn: async (pay: boolean) => (await api.post(`${cabinetApi}/billing/charge`, {
      patientId, items: lines.map(({ key: _key, ...l }) => l), amount: pay ? value : 0, method, reference: reference || null, includeOpen,
    })).data as { message: string; data: { remaining: number } },
    onSuccess: (res) => {
      toast.success(res.data.remaining > 0.001 ? `${L(res.message)} · ${L('reste à payer')} ${formatCurrency(res.data.remaining, currency)}` : L(res.message))
      for (const key of ['invoice', 'invoices', 'payments', 'patient', 'timeline', 'dashboard', 'unpaid', 'cash-day', 'waiting-room']) queryClient.invalidateQueries({ queryKey: [key] })
      setLines([]); setTouched(false); setReady(mode !== 'visit')
      onDone?.()
    },
    onError: (err) => toast.error(apiError(err)),
  })

  if (actsLoading || invLoading) return <p className="text-sm text-muted-foreground">{L('Chargement…')}</p>
  const valid = value > 0 && value <= owed + 0.001

  return (
    <div className="grid gap-3">
      {mode !== 'collect' && (
        <div className="grid gap-2">
          <NativeSelect aria-label={L('Ajouter un acte')} value="" className="h-11" onChange={e => { const a = sorted.find(x => x.id === e.target.value); if (a) add(a) }}>
            <option value="">{sorted.length ? L('Ajouter un acte…') : L('Aucun acte dans le catalogue (Paramètres › Actes et tarifs).')}</option>
            {groups.map(g => (
              <optgroup key={g.label} label={g.label}>
                {g.acts.map(a => <option key={a.id} value={a.id}>{a.name} — {formatCurrency(a.price, currency)}</option>)}
              </optgroup>
            ))}
          </NativeSelect>
          {lines.length > 0 && (
            <ul className="grid gap-1.5">
              {lines.map(l => (
                <li key={l.key} className="grid grid-cols-[1fr_64px_100px_auto] items-center gap-2 rounded-xl bg-[#F4F7F6] px-3 py-1.5 text-[0.88rem]">
                  <span className="min-w-0 truncate font-semibold">{l.label}</span>
                  <Input type="number" min={1} step={1} aria-label={L('Quantité')} className="h-9" value={l.quantity} onChange={e => setLine(l.key, { quantity: Math.max(1, Math.round(Number(e.target.value)) || 1) })} />
                  <Input type="number" min={0} step="0.01" aria-label={L('Prix unitaire')} className="h-9" value={l.unitPrice} onChange={e => setLine(l.key, { unitPrice: Math.max(0, Number(e.target.value) || 0) })} />
                  <button type="button" className="text-[0.8rem] font-semibold text-[#B8372C]" aria-label={`${L('Retirer')} ${l.label}`} onClick={() => setLines(list => list.filter(x => x.key !== l.key))}>{L('Retirer')}</button>
                </li>
              ))}
              <li className="flex justify-between px-3 text-[0.9rem]"><span className="text-[#5A6B65]">{L('Total des actes')}</span><b>{formatCurrency(newTotal, currency)}</b></li>
            </ul>
          )}
          {mode === 'invoice' && (
            <div className="grid grid-cols-[1fr_110px_auto] gap-2">
              <Input placeholder={L('Ligne libre (libellé)')} aria-label={L('Libellé')} value={free.label} onChange={e => setFree(f => ({ ...f, label: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFree() } }} />
              <Input type="number" min={0} step="0.01" placeholder={L('Prix')} aria-label={L('Prix')} value={free.price} onChange={e => setFree(f => ({ ...f, price: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addFree() } }} />
              <Button type="button" variant="outline" disabled={!free.label.trim()} onClick={addFree}>{L('Ajouter')}</Button>
            </div>
          )}
        </div>
      )}

      {due > 0.001 && (
        <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-[#FBEED6] px-3 py-2 text-[0.88rem] text-[#7A4D08]">
          <input type="checkbox" className="h-4 w-4 accent-[#12705A]" checked={includeOpen} onChange={e => setIncludeOpen(e.target.checked)} disabled={mode === 'collect'} />
          {L('Déjà dû')} : <b>{formatCurrency(due, currency)}</b> ({open.length} {open.length > 1 ? L('factures') : L('facture')})
        </label>
      )}

      {owed > 0.001 ? (
        <>
          <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
            {METHODS.map(m => (
              <button key={m} type="button" onClick={() => setMethod(m)} aria-pressed={method === m}
                className={cn('h-11 rounded-xl border text-sm font-semibold', method === m ? 'border-primary bg-accent text-primary' : 'border-border bg-white hover:bg-muted')}>
                {t(`paymentMethod.${m}`)}
              </button>
            ))}
          </div>
          <div className="grid gap-2 sm:grid-cols-[1fr_1fr] sm:items-end">
            <label className="space-y-1 text-[0.86rem] font-medium">{L('Montant reçu')}
              <Input type="number" inputMode="decimal" min={0} step="0.01" value={amount} onChange={e => { setTouched(true); setAmount(e.target.value) }} />
            </label>
            {(method === 'CHECK' || method === 'TRANSFER') && (
              <label className="space-y-1 text-[0.86rem] font-medium">{method === 'CHECK' ? L('Numéro du chèque') : L('Référence du virement')}
                <Input value={reference} onChange={e => setReference(e.target.value)} />
              </label>
            )}
          </div>
          <div className="flex flex-wrap justify-end gap-2">
            {lines.length > 0 && <Button type="button" variant="outline" disabled={charge.isPending} onClick={() => charge.mutate(false)}>{L('Facturer sans encaisser')}</Button>}
            <Button type="button" size="lg" disabled={!valid || charge.isPending} onClick={() => charge.mutate(true)}>
              {L('Encaisser')} {valid ? formatCurrency(value, currency) : ''}
            </Button>
          </div>
          {valid && value < owed - 0.001 && <p className="text-end text-[0.8rem] text-[#99600B]">{L('Paiement partiel : il restera')} {formatCurrency(owed - value, currency)}</p>}
        </>
      ) : (
        <p className="rounded-xl border border-dashed border-border p-3 text-center text-[0.88rem] text-muted-foreground">{mode === 'collect' ? L('Rien à encaisser pour ce patient.') : L('Choisissez un acte à facturer.')}</p>
      )}
    </div>
  )
}
