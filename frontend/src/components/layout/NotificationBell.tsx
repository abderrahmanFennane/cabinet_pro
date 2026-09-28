import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, MessageCircle, Phone } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import api from '../../lib/api'
import { formatDateTimeFR } from '../../lib/utils'
import { InboxMessage } from '../../types'
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover'
import { Button } from '../ui/button'
import { whatsappLink } from '../../pages/SubscriptionBlocked'

const kindStyle: Record<string, string> = {
  PLAN_EXPIRY: 'bg-[#FFD36A] text-[#0D4A3B]',
  OWNER_MESSAGE: 'bg-[#DCEEE7] text-[#12705A]',
  WELCOME: 'bg-[#78E7AE] text-[#087A4B]',
}

export default function NotificationBell() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['inbox'],
    queryFn: async () => (await api.get('/messages/inbox')).data.data as { items: InboxMessage[]; unread: number },
    refetchInterval: 60_000,
  })
  const readAll = useMutation({
    mutationFn: () => api.post('/messages/inbox/read-all'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['inbox'] }),
  })
  const items = data?.items || []
  const unread = data?.unread || 0

  return (
    <Popover onOpenChange={open => { if (!open && unread) readAll.mutate() }}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative h-10 w-10 rounded-xl bg-[#E9EFEC]" aria-label={t('inbox.title')}>
          <Bell size={18} />
          {unread > 0 && (
            <span className="absolute -end-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full border-2 border-white bg-[#FF6370] px-1 text-[10px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(24rem,calc(100vw-1.5rem))] rounded-2xl border-[#D8E1DD] p-0 shadow-[0_18px_40px_-20px_rgba(18,112,90,0.45)]">
        <div className="flex items-center justify-between border-b border-[#E3EAE7] px-4 py-3">
          <p className="font-bold text-[#14231E]">{t('inbox.title')}</p>
          {unread > 0 && (
            <button type="button" onClick={() => readAll.mutate()} className="flex items-center gap-1 text-xs font-semibold text-primary">
              <CheckCheck size={14} /> {t('inbox.markAll')}
            </button>
          )}
        </div>
        <div className="max-h-[min(28rem,70dvh)] overflow-y-auto">
          {!items.length ? (
            <p className="px-4 py-10 text-center text-sm text-[#5A6B65]">{t('inbox.empty')}</p>
          ) : (
            <ul className="divide-y divide-[#E3EAE7]">
              {items.map(item => (
                <li key={item.id} className={`flex gap-3 px-4 py-3.5 ${item.readAt ? '' : 'bg-[#F2F5F3]'}`}>
                  <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${kindStyle[item.kind] || 'bg-[#DCEEE7] text-[#12705A]'}`}>
                    <Bell size={15} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-[#14231E]">{item.subject || t(`messagesPage.kinds.${item.kind}`, item.kind)}</p>
                      {!item.readAt && <i aria-label={t('inbox.unread')} className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary" />}
                    </div>
                    <p className="mt-1 whitespace-pre-line text-sm text-[#3F514A]">{item.body}</p>
                    {(item.fromName || item.fromPhone) && (
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
                        <span className="text-[#5A6B65]">{t('inbox.from')} <b className="text-[#14231E]">{item.fromName}</b></span>
                        {item.fromPhone && (
                          <>
                            <a href={`tel:${item.fromPhone}`} className="flex items-center gap-1 font-semibold text-primary"><Phone size={12} /> {item.fromPhone}</a>
                            <a href={whatsappLink(item.fromPhone)} target="_blank" rel="noreferrer" className="flex items-center gap-1 font-semibold text-[#1DA851]"><MessageCircle size={12} /> WhatsApp</a>
                          </>
                        )}
                      </div>
                    )}
                    <p className="mt-1.5 text-[11px] text-[#8A9A94]">{formatDateTimeFR(item.createdAt)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
