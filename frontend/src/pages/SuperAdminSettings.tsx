import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import api from '../lib/api'
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { toast } from '../components/ui/toast'
import { useTranslation } from 'react-i18next'
import { PageHeader } from '../components/layout/PageHeader'
import { Headset } from 'lucide-react'
import { AppSettings } from '../types'

export default function SuperAdminSettings() {
  const { t } = useTranslation()
  const queryClient = useQueryClient()

  const { data: appSettings, isLoading } = useQuery({
    queryKey: ['app-settings'],
    queryFn: async () => {
      const { data } = await api.get('/app-settings')
      return (data.data || data) as AppSettings
    },
  })

  const [form, setForm] = useState({ businessName: '' })
  const [support, setSupport] = useState({ supportPhone: '', supportWhatsapp: '', supportEmail: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!appSettings) return
    setForm({ businessName: appSettings.businessName || '' })
    setSupport({
      supportPhone: appSettings.supportPhone || '',
      supportWhatsapp: appSettings.supportWhatsapp || '',
      supportEmail: appSettings.supportEmail || '',
    })
  }, [appSettings])

  const update = useMutation({
    mutationFn: async (payload: Partial<AppSettings>) => (await api.patch('/app-settings', payload)).data.data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['app-settings'] }),
    onError: (err: any) => toast({ title: t('common.error'), description: err.response?.data?.message || err.response?.data?.error, variant: 'destructive' }),
  })

  const uploadLogo = async (file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    const { data } = await api.post('/uploads/business-logos', fd)
    return (data.data || data)?.url as string | undefined
  }

  return (
    <div className="space-y-6 no-print max-w-5xl mx-auto">
      <PageHeader title={t('nav.settings')} subtitle="Nom, logo et coordonnées affichés aux cabinets" />

      <Card>
        <CardHeader>
          <CardTitle>Nom du projet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <Label className="text-xs font-semibold uppercase tracking-wide text-[#5A6B65]">{t('common.name')}</Label>
            <Input
              value={form.businessName}
              onChange={(e) => setForm({ businessName: e.target.value })}
              className="mt-2"
              placeholder={t('dashboard.global')}
            />
          </div>
          <div className="flex justify-end">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={saving || isLoading}
              onClick={async () => {
                setSaving(true)
                try {
                  await update.mutateAsync({ businessName: form.businessName || null })
                  toast({ title: 'Enregistré', variant: 'success' })
                } finally {
                  setSaving(false)
                }
              }}
            >
              {t('common.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2.5">
            <span className="icon-chip h-9 w-9 rounded-xl bg-[#E1FAEC] text-[#087A4B]"><Headset size={17} /></span>
            {t('support.title')}
          </CardTitle>
          <p className="text-sm text-[#5A6B65]">{t('support.description')}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label>{t('support.phone')}</Label>
              <Input type="tel" value={support.supportPhone} onChange={e => setSupport({ ...support, supportPhone: e.target.value })} placeholder="06 12 34 56 78" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('support.whatsapp')}</Label>
              <Input type="tel" value={support.supportWhatsapp} onChange={e => setSupport({ ...support, supportWhatsapp: e.target.value })} placeholder="06 12 34 56 78" />
            </div>
            <div className="space-y-1.5">
              <Label>{t('support.email')}</Label>
              <Input type="email" value={support.supportEmail} onChange={e => setSupport({ ...support, supportEmail: e.target.value })} placeholder="contact@exemple.ma" />
            </div>
          </div>
          <div className="flex justify-end">
            <Button
              size="lg"
              className="w-full sm:w-auto"
              disabled={update.isPending}
              onClick={async () => {
                await update.mutateAsync({
                  supportPhone: support.supportPhone || null,
                  supportWhatsapp: support.supportWhatsapp || null,
                  supportEmail: support.supportEmail || null,
                })
                toast({ title: 'Enregistré', variant: 'success' })
              }}
            >
              {t('common.save')}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Logo du projet</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 rounded-2xl bg-[#F2F5F3] p-3">
            {appSettings?.businessLogo ? (
              <img src={appSettings.businessLogo} alt="" className="h-14 w-14 shrink-0 rounded-full border-[3px] border-white object-cover shadow-[0_10px_20px_-14px_rgba(18,112,90,0.7)]" />
            ) : (
              <div className="h-14 w-14 shrink-0 rounded-full border-2 border-dashed border-[#DCEEE7] bg-white" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[#14231E]">{appSettings?.businessName || t('dashboard.global')}</p>
              <p className="text-xs text-[#5A6B65]">Affiché dans l’en-tête Super Admin</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <Input
              type="file"
              accept="image/*"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                if (!file) return
                try {
                  const url = await uploadLogo(file)
                  if (url) await update.mutateAsync({ businessLogo: url })
                  toast({ title: 'Logo mis à jour', variant: 'success' })
                } catch (err: any) {
                  toast({ title: t('common.error'), description: err.response?.data?.message || err.response?.data?.error, variant: 'destructive' })
                }
              }}
              className="flex-1 cursor-pointer pt-2.5"
            />
            {appSettings?.businessLogo && (
              <Button
                type="button"
                variant="outline"
                onClick={async () => {
                  await update.mutateAsync({ businessLogo: null })
                  toast({ title: 'Logo supprimé', variant: 'success' })
                }}
              >
                {t('common.delete')}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
