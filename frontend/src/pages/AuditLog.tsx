import { useState } from 'react'
import { keepPreviousData, useInfiniteQuery, useQuery } from '@tanstack/react-query'
import { AlertTriangle, History, Inbox } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { useDebouncedValue } from '../lib/hooks'
import { formatDateTimeFR } from '../lib/utils'
import { Cabinet } from '../types'
import { EmptyState, PageHeader } from '../components/layout/PageHeader'
import { SearchInput, Toolbar } from '../components/layout/ListToolbar'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Badge } from '../components/ui/badge'
import { Skeleton } from '../components/ui/skeleton'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../components/ui/table'
import { useL } from '../lib/labels'

interface AuditEntry {
  id: string
  action: string
  method: string
  path: string
  status: number
  createdAt: string
  cabinetName: string | null
  user: { firstName: string; lastName: string; email: string; role: string } | null
}

const methodTone: Record<string, string> = {
  POST: 'bg-[#E1FAEC] text-[#087A4B]',
  PATCH: 'bg-[#DCEEE7] text-[#12705A]',
  PUT: 'bg-[#DCEEE7] text-[#12705A]',
  DELETE: 'bg-[#FFE8EB] text-[#C52B45]',
}

// Named events (sign-in, password…) in plain words; other entries are API calls such as "PATCH /:id/subscription".
const EVENTS: Record<string, { label: string; tone: string; kind: string }> = {
  LOGIN_SUCCESS: { label: 'Connexion', tone: 'bg-[#E9EFEC] text-[#5A6B65]', kind: 'Accès' },
  LOGIN_FAILURE: { label: 'Échec de connexion', tone: 'bg-[#FBE3E0] text-[#B8372C]', kind: 'Accès' },
  PASSWORD_RESET_REQUESTED: { label: 'Code de changement de mot de passe envoyé', tone: 'bg-[#FBEED6] text-[#99600B]', kind: 'Accès' },
  PASSWORD_RESET: { label: 'Mot de passe changé', tone: 'bg-[#FBEED6] text-[#99600B]', kind: 'Accès' },
  DEMO_RESET: { label: 'Cabinet de démonstration remis à zéro', tone: 'bg-[#EEE7F8] text-[#6746A8]', kind: 'Démo' },
}
const readableAction = (entry: AuditEntry) => EVENTS[entry.action]?.label || (entry.action.includes(' ')
  ? entry.action.split(' ').slice(1).join(' ').replace(/\/:\w+/g, '').replace(/^\//, '') || entry.path
  : entry.action)

export default function AuditLog() {
  const L = useL()
  const { t } = useTranslation()
  const [cabinetId, setCabinetId] = useState('all')
  const [method, setMethod] = useState('all')
  const [search, setSearch] = useState('')
  const searchTerm = useDebouncedValue(search.trim(), 300)
  const [failed, setFailed] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  const { data: cabinets = [] } = useQuery({
    queryKey: ['all-cabinets'],
    queryFn: async () => ((await api.get('/cabinets')).data.data || []) as Cabinet[],
  })

  const query = useInfiniteQuery({
    queryKey: ['audit-logs', cabinetId, method, searchTerm, failed, from, to],
    placeholderData: keepPreviousData,
    initialPageParam: undefined as string | undefined,
    queryFn: async ({ pageParam }) => (await api.get('/audit-logs', {
      params: {
        cabinetId: cabinetId === 'all' ? undefined : cabinetId,
        method: method === 'all' ? undefined : method,
        search: searchTerm || undefined,
        failed: failed ? 'true' : undefined,
        from: from || undefined,
        to: to || undefined,
        cursor: pageParam,
      },
    })).data.data as { items: AuditEntry[]; nextCursor: string | null },
    getNextPageParam: last => last.nextCursor || undefined,
  })
  const items = query.data?.pages.flatMap(page => page.items) || []

  const who = (entry: AuditEntry) => entry.user ? `${entry.user.firstName} ${entry.user.lastName}` : t('audit.system')

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader title={t('audit.title')} subtitle={t('audit.subtitle')} />

      <Toolbar className="lg:flex-wrap">
        <SearchInput value={search} onChange={setSearch} placeholder={t('audit.search')} className="lg:w-80" />
        <div className="grid flex-1 grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
          <Select value={cabinetId} onValueChange={setCabinetId}>
            <SelectTrigger className="bg-white sm:w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('audit.allCabinets')}</SelectItem>
              {cabinets.map(cabinet => <SelectItem key={cabinet.id} value={cabinet.id}>{cabinet.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="bg-white sm:w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t('audit.allMethods')}</SelectItem>
              {['POST', 'PATCH', 'DELETE'].map(m => <SelectItem key={m} value={m}>{t(`audit.methods.${m}`)}</SelectItem>)}
            </SelectContent>
          </Select>
          <Input type="date" value={from} onChange={e => setFrom(e.target.value)} className="bg-white sm:w-40" aria-label={t('dashboard.from')} />
          <Input type="date" value={to} onChange={e => setTo(e.target.value)} className="bg-white sm:w-40" aria-label={t('dashboard.to')} />
          <button type="button" onClick={() => setFailed(v => !v)} aria-pressed={failed} className={`col-span-2 flex h-11 items-center justify-center gap-2 rounded-xl border px-4 text-sm font-semibold sm:col-span-1 ${failed ? 'border-[#FFC2CA] bg-[#FFE8EB] text-[#C52B45]' : 'border-[#D8E1DD] bg-white text-[#3F514A]'}`}>
            <AlertTriangle size={15} /> {t('audit.failedOnly')}
          </button>
        </div>
      </Toolbar>

      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {query.isLoading ? (
            <div className="space-y-3 p-4 sm:p-6">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-12 rounded-xl" />)}</div>
          ) : !items.length ? (
            <EmptyState icon={<Inbox size={26} />} title={t('audit.empty')} />
          ) : (
            <>
              <ul className="divide-y divide-[#E3EAE7] md:hidden">
                {items.map(entry => (
                  <li key={entry.id} className="flex items-start gap-3 px-4 py-3.5">
                    <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${methodTone[entry.method] || 'bg-[#F0E8FF] text-[#5731B7]'}`}><History size={15} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-sm font-semibold text-[#14231E]">{EVENTS[entry.action] ? L(readableAction(entry)) : `${t(`audit.methods.${entry.method}`, entry.method)} · ${readableAction(entry)}`}</p>
                        <Badge variant={entry.status >= 400 ? 'destructive' : 'success'} className="shrink-0">{entry.status}</Badge>
                      </div>
                      <p className="truncate text-xs text-[#5A6B65]">{who(entry)}{entry.cabinetName ? ` · ${entry.cabinetName}` : ''}</p>
                      <p className="mt-0.5 text-xs text-[#8A9A94]">{formatDateTimeFR(entry.createdAt)}</p>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t('audit.when')}</TableHead>
                      <TableHead>{t('audit.user')}</TableHead>
                      <TableHead>{t('audit.cabinet')}</TableHead>
                      <TableHead>{t('audit.method')}</TableHead>
                      <TableHead>{L('Détail')}</TableHead>
                      <TableHead>{t('audit.status')}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {items.map(entry => (
                      <TableRow key={entry.id}>
                        <TableCell className="text-[#5A6B65]">{formatDateTimeFR(entry.createdAt)}</TableCell>
                        <TableCell>
                          <p className="font-semibold">{who(entry)}</p>
                          {entry.user && <p className="text-xs text-[#5A6B65]">{entry.user.email}</p>}
                        </TableCell>
                        <TableCell>{entry.cabinetName || '—'}</TableCell>
                        <TableCell><span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${EVENTS[entry.action]?.tone || methodTone[entry.method] || 'bg-[#EEE7F8] text-[#6746A8]'}`}>{EVENTS[entry.action] ? L(EVENTS[entry.action].kind) : t(`audit.methods.${entry.method}`, entry.method)}</span></TableCell>
                        <TableCell className="max-w-sm whitespace-normal">
                          <p className="font-medium">{readableAction(entry)}</p>
                          <p className="truncate text-xs text-[#8A9A94]">{entry.path}</p>
                        </TableCell>
                        <TableCell><Badge variant={entry.status >= 400 ? 'destructive' : 'success'}>{entry.status}</Badge></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {query.hasNextPage && (
                <div className="border-t border-[#E3EAE7] p-4 text-center">
                  <Button variant="outline" disabled={query.isFetchingNextPage} onClick={() => query.fetchNextPage()}>{t('audit.loadMore')}</Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
