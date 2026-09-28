import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { ArrowLeft, Check, Eye, EyeOff, Gift, Loader2 } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import api from '../lib/api'
import { apiError, useAuth } from '../lib/hooks'
import { NativeSelect } from '../components/ui/native-select'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { toast } from '../components/ui/toast'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'
import { ToothMark } from '../components/layout/Sidebar'
import ToothGlyph from '../components/dental/ToothGlyph'
import { ToothStateCode } from '../types'

type LoginForm = { email: string; password: string }
type RegisterForm = { cabinetName: string; specialty: string; firstName: string; lastName: string; email: string; phone: string; password: string }
type Mode = 'login' | 'register' | 'forgot' | 'reset'
const TRIAL_DAYS = 3
// A few teeth from a real-looking chart: what the product is about, at a glance.
const SAMPLE: [number, ToothStateCode][] = [[34, 'HEALTHY'], [35, 'CARIES'], [36, 'FILLED'], [37, 'CROWN'], [38, 'HEALTHY']]

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [notice, setNotice] = useState('')
  const [mode, setMode] = useState<Mode>('login')
  const [resetEmail, setResetEmail] = useState('')
  const [code, setCode] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const { login, isAuthenticated, fetchMe } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { register, handleSubmit, setValue, formState: { errors } } = useForm<LoginForm>()
  const registerForm = useForm<RegisterForm>({ defaultValues: { specialty: 'DENTISTRY' } })
  const { data: specialties = [] } = useQuery({
    queryKey: ['specialties'],
    queryFn: async () => (await api.get('/specialties')).data.data as { code: string; name: string; isActive: boolean }[],
    enabled: mode === 'register',
  })

  useEffect(() => {
    if (isAuthenticated) navigate('/')
  }, [isAuthenticated, navigate])

  useEffect(() => {
    const message = sessionStorage.getItem('authError')
    if (message) {
      sessionStorage.removeItem('authError')
      setAuthMessage(message)
    }
  }, [])

  const go = (next: Mode) => { setMode(next); setAuthMessage(''); setNotice('') }

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      await login(data.email, data.password)
      navigate('/')
    } catch (err: any) {
      setAuthMessage(err.response?.data?.message || err.response?.data?.error || t('auth.invalidCredentials'))
    } finally {
      setLoading(false)
    }
  }

  const onRegister = async (data: RegisterForm) => {
    setLoading(true)
    try {
      const { data: payload } = await api.post('/auth/register', data)
      localStorage.setItem('token', payload.data.token)
      await fetchMe()
      toast({ title: t('trial.created'), variant: 'success' })
      navigate('/', { replace: true })
    } catch (err) {
      setAuthMessage(apiError(err, t('auth.registrationFailed')))
    } finally { setLoading(false) }
  }

  const sendCode = async (e?: React.FormEvent) => {
    e?.preventDefault()
    setLoading(true)
    try {
      const { data } = await api.post('/auth/forgot-password', { email: resetEmail })
      setAuthMessage('')
      setNotice(data.message)
      setMode('reset')
    } catch (err) {
      setAuthMessage(apiError(err))
    } finally { setLoading(false) }
  }

  const resetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      await api.post('/auth/reset-password', { email: resetEmail, code, password: newPassword })
      setValue('email', resetEmail)
      setCode(''); setNewPassword('')
      go('login')
      setNotice(t('login.changed'))
    } catch (err) {
      setAuthMessage(apiError(err))
    } finally { setLoading(false) }
  }

  const titles: Record<Mode, string> = { login: t('auth.login'), register: t('auth.register'), forgot: t('login.forgotTitle'), reset: t('login.codeTitle') }
  const back = <button type="button" className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary" onClick={() => go('login')}><ArrowLeft size={15} className="rtl:rotate-180" />{t('login.back')}</button>

  return (
    <div className="grid min-h-[100dvh] w-full bg-[#F2F5F3] lg:grid-cols-[1.05fr_1fr]">
      <aside className="hidden flex-col justify-between border-e border-[#D8E1DD] bg-white p-12 lg:flex">
        <div className="flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-white"><ToothMark size={22} /></span>
          <span className="text-xl font-extrabold">Cabinet Pro</span>
        </div>

        <div className="max-w-md space-y-5">
          <p className="text-[0.78rem] font-bold uppercase tracking-[0.08em] text-primary">{t('login.eyebrow')}</p>
          <h1 className="text-[2.6rem] font-extrabold leading-[1.08] text-[#14231E]">{t('auth.headline')}</h1>
          <p className="text-lg text-[#5A6B65]">{t('auth.description')}</p>
          <div className="flex max-w-xs items-start gap-1 pt-3" dir="ltr" aria-hidden="true">
            {SAMPLE.map(([tooth, state]) => (
              <div key={tooth} className="relative flex-1">
                <ToothGlyph tooth={tooth} state={state} className="h-auto w-full" />
                {tooth === 35 && <span className="absolute end-0 top-0 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-white" />}
              </div>
            ))}
          </div>
        </div>

        <ul className="grid gap-2.5 text-[0.95rem] text-[#14231E]">
          {[t('login.chart'), t('login.reminders'), t('login.languages')].map(line => (
            <li key={line} className="flex items-center gap-2.5"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-[#DCEEE7] text-primary"><Check size={14} strokeWidth={3} /></span>{line}</li>
          ))}
        </ul>
      </aside>

      <main className="relative flex items-center justify-center px-4 py-16 sm:px-8">
        <div className="absolute end-4 top-4 w-24 sm:end-8 sm:top-6"><LanguageSwitcher compact /></div>
        <div className="w-full max-w-[400px] space-y-6">
          <div className="space-y-1.5">
            <span className="mb-5 flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-white lg:hidden"><ToothMark size={24} /></span>
            <h2 className="text-[1.75rem] font-extrabold leading-tight">{titles[mode]}</h2>
            {mode === 'login' && <p className="text-[#5A6B65]">{t('auth.subtitle')}</p>}
            {mode === 'forgot' && <p className="text-[#5A6B65]">{t('login.forgotHint')}</p>}
          </div>

          {authMessage && <div role="alert" className="rounded-xl bg-[#FBE3E0] px-4 py-3 text-sm font-semibold text-[#B8372C]">{authMessage}</div>}
          {notice && <div role="status" className="rounded-xl bg-[#DCEEE7] px-4 py-3 text-sm font-semibold text-primary">{notice}</div>}

          {mode === 'login' && (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <Label htmlFor="email">{t('auth.emailAddress')}</Label>
                <Input id="email" type="email" autoComplete="email" placeholder="vous@exemple.ma" className={errors.email ? 'border-destructive' : ''}
                  {...register('email', { required: t('auth.emailRequired'), pattern: { value: /^\S+@\S+\.\S+$/, message: t('auth.invalidEmail') } })} />
                {errors.email && <p className="text-sm text-destructive">{errors.email.message}</p>}
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <Label htmlFor="password">{t('auth.password')}</Label>
                  <button type="button" className="text-sm font-semibold text-primary hover:underline" onClick={() => { setResetEmail((document.getElementById('email') as HTMLInputElement)?.value || ''); go('forgot') }}>{t('login.forgot')}</button>
                </div>
                <div className="relative">
                  <Input id="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password" className={`pe-11 ${errors.password ? 'border-destructive' : ''}`}
                    {...register('password', { required: t('auth.passwordRequired') })} />
                  <button type="button" onClick={() => setShowPassword(s => !s)} aria-label={showPassword ? 'Masquer' : 'Afficher'}
                    className="absolute end-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-lg text-[#5A6B65] hover:bg-[#E9EFEC]">
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && <p className="text-sm text-destructive">{errors.password.message}</p>}
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>
                {loading ? <><Loader2 className="me-2 h-5 w-5 animate-spin" />{t('auth.signingIn')}</> : t('auth.signIn')}
              </Button>
              <div className="border-t border-[#D8E1DD] pt-4">
                <Button type="button" variant="outline" size="lg" className="w-full gap-2" onClick={() => go('register')}>
                  <Gift size={17} className="text-[#99600B]" /> {t('trial.cta', { days: TRIAL_DAYS })}
                </Button>
              </div>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={sendCode} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-email">{t('auth.emailAddress')}</Label>
                <Input id="reset-email" type="email" autoComplete="email" required value={resetEmail} onChange={e => setResetEmail(e.target.value)} />
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading || !resetEmail}>{t('login.sendCode')}</Button>
              <p className="text-sm text-[#5A6B65]">{t('login.noPhone')}</p>
              {back}
            </form>
          )}

          {mode === 'reset' && (
            <form onSubmit={resetPassword} className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="reset-code">{t('login.code')}</Label>
                <Input id="reset-code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} required value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))} className="text-center font-mono text-xl tracking-[0.4em]" />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="reset-password">{t('login.newPassword')}</Label>
                <Input id="reset-password" type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={e => setNewPassword(e.target.value)} />
                <p className="text-xs text-[#5A6B65]">{t('trial.passwordHint')}</p>
              </div>
              <Button type="submit" size="lg" className="w-full" disabled={loading || code.length !== 6 || newPassword.length < 8}>{t('login.changePassword')}</Button>
              <div className="flex flex-wrap items-center justify-between gap-2">
                {back}
                <button type="button" className="text-sm font-semibold text-[#5A6B65] hover:text-primary" onClick={() => sendCode()} disabled={loading}>{t('login.newCode')}</button>
              </div>
            </form>
          )}

          {mode === 'register' && (
            <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
              <div className="flex items-center gap-3 rounded-xl bg-[#FBEED6] p-3 text-sm">
                <Gift size={20} className="shrink-0 text-[#99600B]" />
                <div><p className="font-bold">{t('trial.cta', { days: TRIAL_DAYS })}</p><p className="text-xs text-[#99600B]">{t('trial.ctaHint')}</p></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="r-cabinet">{t('auth.cabinetName')}</Label><Input id="r-cabinet" {...registerForm.register('cabinetName', { required: true })} placeholder="Cabinet dentaire Anfa" /></div>
              <div className="space-y-1.5"><Label htmlFor="specialty">Spécialité</Label><NativeSelect id="specialty" {...registerForm.register('specialty', { required: true })}>{(specialties.length ? specialties.filter(s => s.isActive) : [{ code: 'DENTISTRY', name: 'Médecine dentaire' }]).map(s => <option key={s.code} value={s.code}>{t(`specialty.${s.code}`, s.name)}</option>)}</NativeSelect></div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5"><Label htmlFor="r-first">{t('auth.firstName')}</Label><Input id="r-first" {...registerForm.register('firstName', { required: true })} /></div>
                <div className="space-y-1.5"><Label htmlFor="r-last">{t('auth.lastName')}</Label><Input id="r-last" {...registerForm.register('lastName', { required: true })} /></div>
              </div>
              <div className="space-y-1.5"><Label htmlFor="r-email">{t('common.email')}</Label><Input id="r-email" type="email" autoComplete="email" {...registerForm.register('email', { required: true })} /></div>
              <div className="space-y-1.5"><Label htmlFor="r-phone">{t('trial.phone')}</Label><Input id="r-phone" type="tel" autoComplete="tel" placeholder="06 12 34 56 78" {...registerForm.register('phone', { required: true, minLength: 6 })} /><p className="text-xs text-[#5A6B65]">{t('trial.phoneHint')}</p></div>
              <div className="space-y-1.5"><Label htmlFor="r-password">{t('auth.password')}</Label><Input id="r-password" type="password" autoComplete="new-password" {...registerForm.register('password', { required: true, minLength: 8 })} /><p className="text-xs text-[#5A6B65]">{t('trial.passwordHint')}</p></div>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? t('auth.creating') : t('auth.startTrial')}</Button>
              <button type="button" className="w-full py-1 text-sm font-semibold text-primary" onClick={() => go('login')}>{t('auth.haveAccount')}</button>
            </form>
          )}
        </div>
      </main>
    </div>
  )
}
