import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Globe, KeyRound, LogOut, ShieldCheck, ShieldAlert } from 'lucide-react'
import api from '../lib/api'
import { apiError, useAuth } from '../lib/hooks'
import { PageHeader } from '../components/layout/PageHeader'
import { Card, CardContent } from '../components/ui/card'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { toast } from '../components/ui/toast'
import { DoctorProfileForm } from '../components/settings/DoctorProfileForm'
import { useL } from '../lib/labels'
import { Role } from '../types'

/** The signed-in user's own account: password, two-step login status, sign out everywhere. */
export default function Account() {
  const { t } = useTranslation()
  const L = useL()
  const { user, startSession, logout } = useAuth()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmAll, setConfirmAll] = useState(false)
  if (!user) return null
  const mfa = user.mfa

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    try {
      const { data } = await api.post('/auth/change-password', { currentPassword: current, password })
      await startSession(data.data.token)
      setCurrent(''); setPassword('')
      toast({ title: data.message, variant: 'success' })
    } catch (err) {
      toast({ title: apiError(err), variant: 'destructive' })
    } finally { setSaving(false) }
  }

  const logoutAll = async () => {
    try {
      await api.post('/auth/logout-all')
      logout()
    } catch (err) {
      toast({ title: apiError(err), variant: 'destructive' })
    }
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader title={t('account.title')} subtitle={`${user.firstName} ${user.lastName} · ${user.email}`} />

      {(user.role === Role.OWNER || user.role === Role.PRACTITIONER) && (
        <Card>
          <CardContent className="space-y-3 p-5 sm:p-6">
            <h2 className="flex items-center gap-2 text-base font-bold"><Globe size={18} className="text-primary" />{L('Ma page publique')}</h2>
            <p className="text-sm text-muted-foreground">{L('Ce que les patients voient avant de prendre rendez-vous en ligne avec vous.')}</p>
            <DoctorProfileForm userId={user.id} />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent className="space-y-3 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-bold">
            {mfa?.enabled ? <ShieldCheck size={18} className="text-primary" /> : <ShieldAlert size={18} className="text-[#99600B]" />}
            {t('account.mfaTitle')}
          </h2>
          {mfa?.enabled ? (
            <>
              <p className="text-sm">{t('account.mfaOn')}</p>
              <p className={mfa.recoveryCodesLeft <= 2 ? 'text-sm font-semibold text-[#B8372C]' : 'text-sm text-muted-foreground'}>
                {t('account.codesLeft', { count: mfa.recoveryCodesLeft })}
              </p>
              <p className="text-sm text-muted-foreground">{t('account.mfaLost')}</p>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">{mfa?.required ? t('account.mfaNext') : t('account.mfaNotNeeded')}</p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-5 sm:p-6">
          <form onSubmit={changePassword} className="space-y-3">
            <h2 className="flex items-center gap-2 text-base font-bold"><KeyRound size={18} className="text-primary" />{t('account.passwordTitle')}</h2>
            <div className="space-y-1.5">
              <Label htmlFor="acc-current">{t('account.currentPassword')}</Label>
              <Input id="acc-current" type="password" autoComplete="current-password" required value={current} onChange={e => setCurrent(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="acc-new">{t('login.newPassword')}</Label>
              <Input id="acc-new" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={e => setPassword(e.target.value)} />
              <p className="text-xs text-muted-foreground">{t('account.passwordHint')}</p>
            </div>
            <Button type="submit" disabled={saving || !current || password.length < 8}>{t('login.changePassword')}</Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="space-y-3 p-5 sm:p-6">
          <h2 className="flex items-center gap-2 text-base font-bold"><LogOut size={18} className="text-[#B8372C] rtl:rotate-180" />{t('account.devicesTitle')}</h2>
          <p className="text-sm text-muted-foreground">{t('account.devicesHint')}</p>
          {confirmAll ? (
            <div className="flex flex-wrap gap-2">
              <Button variant="destructive" onClick={logoutAll}>{t('account.logoutAllConfirm')}</Button>
              <Button variant="outline" onClick={() => setConfirmAll(false)}>{t('common.cancel')}</Button>
            </div>
          ) : (
            <Button variant="outline" onClick={() => setConfirmAll(true)}>{t('account.logoutAll')}</Button>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
