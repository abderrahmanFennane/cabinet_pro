import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCircle2, Inbox, MessageCircle, MessageSquareText, Send, Smartphone, TestTube2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { useAuth } from '../lib/hooks'
import { cn, formatDateTimeFR } from '../lib/utils'
import { OutgoingMessage, Cabinet } from '../types'
import { PageHeader, EmptyState } from '../components/layout/PageHeader'
import { SearchInput } from '../components/layout/ListToolbar'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Textarea } from '../components/ui/textarea'
import { Badge } from '../components/ui/badge'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { toast } from '../components/ui/toast'

type Channel = 'IN_APP' | 'SMS' | 'WHATSAPP'

const statusVariant: Record<string, any> = { SENT: 'success', LOGGED: 'secondary', FAILED: 'destructive', PENDING: 'warning' }
const channelIcon = (channel: string) => channel === 'SMS' ? <Smartphone size={14} /> : <MessageCircle size={14} />

export default function MessagesAdmin() {
  const { t } = useTranslation()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const [searchParams] = useSearchParams()
  const [target, setTarget] = useState<'all' | 'selected'>('selected')
  const [selected, setSelected] = useState<string[]>([])
  const [cabinetSearch, setCabinetSearch] = useState('')
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [channels, setChannels] = useState<Channel[]>(['IN_APP', 'WHATSAPP', 'SMS'])
  const [kindFilter, setKindFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [testPhone, setTestPhone] = useState('')

  useEffect(() => {
    const cabinet = searchParams.get('cabinet')
    if (cabinet) { setTarget('selected'); setSelected([cabinet]) }
  }, [searchParams])

  const { data: cabinets = [] } = useQuery({
    queryKey: ['all-cabinets'],
    queryFn: async () => ((await api.get('/cabinets')).data.data || []) as Cabinet[],
  })
  const { data: providers } = useQuery({
    queryKey: ['message-providers'],
    queryFn: async () => (await api.get('/messages/providers')).data.data as { sms: { provider: string; sender: string }; whatsapp: { provider: string; templates: Record<string, string> } },
  })
  const { data: log, isLoading } = useQuery({
    queryKey: ['messages-log', kindFilter, statusFilter],
    queryFn: async () => (await api.get('/messages', { params: { kind: kindFilter === 'all' ? undefined : kindFilter, status: statusFilter === 'all' ? undefined : statusFilter } })).data.data as { items: OutgoingMessage[]; counts: Record<string, number> },
  })

  const send = useMutation({
    mutationFn: async () => (await api.post('/messages', { all: target === 'all', cabinetIds: target === 'selected' ? selected : undefined, subject: subject || null, body, channels })).data.data,
    onSuccess: (summary: any) => {
      toast({ title: t('messagesPage.sent'), description: String(t('messagesPage.summary', summary)), variant: 'success' })
      setBody(''); setSubject('')
      queryClient.invalidateQueries({ queryKey: ['messages-log'] })
    },
    onError: (err: any) => toast({ title: t('common.error'), description: err.response?.data?.error || err.response?.data?.message, variant: 'destructive' }),
  })
  const test = useMutation({
    mutationFn: async (channel: 'SMS' | 'WHATSAPP') => (await api.post('/messages/test', { phone: testPhone, channel })).data.data as OutgoingMessage,
    onSuccess: (result) => {
      toast({ title: t(`messagesPage.statuses.${result.status}`), description: result.error || result.toPhone || '', variant: result.status === 'FAILED' ? 'destructive' : 'success' })
      queryClient.invalidateQueries({ queryKey: ['messages-log'] })
    },
  })

  const filteredCabinets = useMemo(() => {
    const q = cabinetSearch.trim().toLowerCase()
    return cabinets.filter(cabinet => !q || cabinet.name.toLowerCase().includes(q) || (cabinet.phone || '').includes(q))
  }, [cabinets, cabinetSearch])

  const toggleChannel = (channel: Channel) => setChannels(current => current.includes(channel) ? current.filter(c => c !== channel) : [...current, channel])
  const toggleCabinet = (id: string) => setSelected(current => current.includes(id) ? current.filter(s => s !== id) : [...current, id])
  const canSend = body.trim().length > 0 && channels.length > 0 && (target === 'all' || selected.length > 0) && !send.isPending
  const senderName = `${user?.firstName || ''} ${user?.lastName || ''}`.trim()

  const providerRow = (label: string, icon: JSX.Element, provider?: string, name?: string) => (
    <div className="flex items-center gap-3 rounded-2xl bg-[#F2F5F3] p-3">
      <span className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', provider && provider !== 'log' ? 'bg-[#78E7AE] text-[#087A4B]' : 'bg-[#FFD36A] text-[#0D4A3B]')}>{icon}</span>
      <div className="min-w-0">
        <p className="font-semibold text-[#14231E]">{label}</p>
        <p className="text-xs text-[#5A6B65]">{provider && provider !== 'log' ? t('messagesPage.providerLive', { name }) : t('messagesPage.providerLog')}</p>
      </div>
    </div>
  )

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader eyebrow="Super Admin" title={t('messagesPage.title')} subtitle={t('messagesPage.subtitle')} />

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2.5">
              <span className="icon-chip h-9 w-9 rounded-xl bg-[#DCEEE7] text-[#12705A]"><MessageSquareText size={17} /></span>
              {t('messagesPage.compose')}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <Label>{t('messagesPage.to')}</Label>
              <div className="grid grid-cols-2 gap-2 sm:flex">
                {(['selected', 'all'] as const).map(value => (
                  <button key={value} type="button" onClick={() => setTarget(value)} className={cn('h-11 rounded-xl border px-4 text-sm font-semibold transition-colors', target === value ? 'border-primary bg-[#E9EFEC] text-primary' : 'border-[#D8E1DD] text-[#3F514A] hover:bg-[#F2F5F3]')}>
                    {value === 'all' ? t('messagesPage.allCabinets') : `${t('messagesPage.selectCabinets')}${selected.length ? ` (${selected.length})` : ''}`}
                  </button>
                ))}
              </div>
              {target === 'selected' && (
                <div className="space-y-2 rounded-2xl border border-[#D8E1DD] bg-[#F2F5F3] p-3">
                  <SearchInput value={cabinetSearch} onChange={setCabinetSearch} placeholder="Rechercher un cabinet..." />
                  <div className="max-h-52 space-y-1 overflow-y-auto pe-1">
                    {filteredCabinets.map(cabinet => (
                      <label key={cabinet.id} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl bg-white px-3 py-2 text-sm hover:bg-[#DCEEE7]">
                        <input type="checkbox" checked={selected.includes(cabinet.id)} onChange={() => toggleCabinet(cabinet.id)} className="h-4 w-4 accent-primary" />
                        <span className="min-w-0 flex-1 truncate font-medium text-[#14231E]">{cabinet.name}</span>
                        <span className="shrink-0 text-xs text-[#5A6B65]">{cabinet.phone || '—'}</span>
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label>{t('messagesPage.subject')}</Label>
              <Input value={subject} maxLength={120} onChange={e => setSubject(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label>{t('messagesPage.body')}</Label>
                <span className="text-xs text-[#8A9A94]">{body.length}/1000</span>
              </div>
              <Textarea rows={5} value={body} maxLength={1000} onChange={e => setBody(e.target.value)} />
              <p className="text-xs text-[#5A6B65]">{t('messagesPage.signature', { name: senderName || '—', phone: user?.phone || '—' })}</p>
            </div>

            <div className="space-y-2">
              <Label>{t('messagesPage.channels')}</Label>
              <div className="grid grid-cols-3 gap-2">
                {([
                  ['IN_APP', t('messagesPage.inApp'), <Bell size={17} key="i" />],
                  ['WHATSAPP', t('messagesPage.whatsapp'), <MessageCircle size={17} key="w" />],
                  ['SMS', t('messagesPage.sms'), <Smartphone size={17} key="s" />],
                ] as [Channel, string, JSX.Element][]).map(([value, label, icon]) => (
                  <button key={value} type="button" onClick={() => toggleChannel(value)} aria-pressed={channels.includes(value)} className={cn('flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl border px-2 text-xs font-semibold transition-colors sm:flex-row sm:gap-2 sm:text-sm', channels.includes(value) ? 'border-primary bg-[#E9EFEC] text-primary' : 'border-[#D8E1DD] text-[#5A6B65]')}>
                    {icon} {label}
                  </button>
                ))}
              </div>
            </div>

            <Button size="lg" className="w-full gap-2 sm:w-auto" disabled={!canSend} onClick={() => send.mutate()}>
              <Send size={17} /> {t('messagesPage.send')}
            </Button>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader><CardTitle>{t('messagesPage.providers')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {providerRow('WhatsApp', <MessageCircle size={18} />, providers?.whatsapp.provider, 'Meta')}
            {providerRow('SMS', <Smartphone size={18} />, providers?.sms.provider, `Infobip · ${providers?.sms.sender || ''}`)}
            <div className="space-y-2 border-t border-[#E3EAE7] pt-3">
              <Label>{t('messagesPage.testPhone')}</Label>
              <Input type="tel" value={testPhone} onChange={e => setTestPhone(e.target.value)} placeholder="06 12 34 56 78" />
              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" className="gap-1.5" disabled={testPhone.length < 6 || test.isPending} onClick={() => test.mutate('WHATSAPP')}><TestTube2 size={15} /> WhatsApp</Button>
                <Button variant="outline" className="gap-1.5" disabled={testPhone.length < 6 || test.isPending} onClick={() => test.mutate('SMS')}><TestTube2 size={15} /> SMS</Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <CardHeader className="flex-col gap-3 space-y-0 sm:flex-row sm:items-center sm:justify-between">
          <CardTitle className="flex items-center gap-2.5">
            <span className="icon-chip h-9 w-9 rounded-xl bg-[#E1FAEC] text-[#087A4B]"><CheckCircle2 size={17} /></span>
            {t('messagesPage.log')}
          </CardTitle>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select value={kindFilter} onValueChange={setKindFilter}>
              <SelectTrigger className="sm:w-44"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {['APPOINTMENT_REMINDER', 'PLAN_EXPIRY', 'OWNER_MESSAGE', 'TEST'].map(kind => <SelectItem key={kind} value={kind}>{t(`messagesPage.kinds.${kind}`)}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="sm:w-40"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('common.all')}</SelectItem>
                {['SENT', 'LOGGED', 'FAILED'].map(status => <SelectItem key={status} value={status}>{t(`messagesPage.statuses.${status}`)} {log?.counts?.[status] ? `(${log.counts[status]})` : ''}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? null : !log?.items.length ? (
            <EmptyState icon={<Inbox size={26} />} title={t('messagesPage.empty')} />
          ) : (
            <>
              <ul className="divide-y divide-[#E3EAE7] border-t border-[#E3EAE7] md:hidden">
                {log.items.map(item => (
                  <li key={item.id} className="space-y-1.5 px-4 py-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="flex min-w-0 items-center gap-1.5 text-sm font-semibold text-[#14231E]">{channelIcon(item.channel)} <span className="truncate">{item.cabinetName || item.toPhone}</span></span>
                      <Badge variant={statusVariant[item.status]}>{t(`messagesPage.statuses.${item.status}`)}</Badge>
                    </div>
                    <p className="line-clamp-2 text-sm text-[#3F514A]">{item.body}</p>
                    <p className="text-xs text-[#8A9A94]">{t(`messagesPage.kinds.${item.kind}`, item.kind)} · {item.toPhone} · {formatDateTimeFR(item.createdAt)}</p>
                    {item.error && <p className="text-xs text-destructive">{item.error}</p>}
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('common.date')}</TableHead>
                      <TableHead>{t('audit.cabinet')}</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>{t('messagesPage.channels')}</TableHead>
                      <TableHead>{t('common.phone')}</TableHead>
                      <TableHead>{t('messagesPage.body')}</TableHead>
                      <TableHead>{t('common.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {log.items.map(item => (
                      <TableRow key={item.id}>
                        <TableCell className="text-[#5A6B65]">{formatDateTimeFR(item.createdAt)}</TableCell>
                        <TableCell className="font-semibold">{item.cabinetName || '—'}</TableCell>
                        <TableCell>{t(`messagesPage.kinds.${item.kind}`, item.kind)}</TableCell>
                        <TableCell><span className="flex items-center gap-1.5">{channelIcon(item.channel)} {item.channel === 'SMS' ? 'SMS' : 'WhatsApp'}</span></TableCell>
                        <TableCell>{item.toPhone || '—'}</TableCell>
                        <TableCell className="max-w-xs whitespace-normal">
                          <p className="line-clamp-2">{item.body}</p>
                          {item.error && <p className="mt-1 text-xs text-destructive">{item.error}</p>}
                        </TableCell>
                        <TableCell><Badge variant={statusVariant[item.status]}>{t(`messagesPage.statuses.${item.status}`)}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
