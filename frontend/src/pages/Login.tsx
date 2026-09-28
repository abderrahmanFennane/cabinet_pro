import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { Stethoscope, Eye, EyeOff, Loader2, Gift } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import api from '../lib/api'
import { useAuth } from '../lib/hooks'
import { NativeSelect } from '../components/ui/native-select'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card'
import { toast } from '../components/ui/toast'
import { useTranslation } from 'react-i18next'
import LanguageSwitcher from '../components/layout/LanguageSwitcher'

type LoginForm = { email: string; password: string }
type RegisterForm = { cabinetName: string; specialty: string; firstName: string; lastName: string; email: string; phone: string; password: string }
const TRIAL_DAYS = 3

export default function Login() {
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [authMessage, setAuthMessage] = useState('')
  const [registerMode, setRegisterMode] = useState(false)
  const { login, isAuthenticated, fetchMe } = useAuth()
  const { t } = useTranslation()
  const navigate = useNavigate()
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>()
  const registerForm = useForm<RegisterForm>({ defaultValues: { specialty: 'DENTISTRY' } })
  const { data: specialties = [] } = useQuery({
    queryKey: ['specialties'],
    queryFn: async () => (await api.get('/specialties')).data.data as { code: string; name: string; isActive: boolean }[],
    enabled: registerMode,
    refetchInterval: false,
  })

  useEffect(() => {
    if (isAuthenticated) navigate('/')
  }, [isAuthenticated, navigate])

  useEffect(() => {
    const message = sessionStorage.getItem('authError')
    if (message) {
      sessionStorage.removeItem('authError')
      setAuthMessage(message)
      toast({ title: t('auth.accessDenied'), description: message, variant: 'destructive' })
    }
  }, [])

  const onSubmit = async (data: LoginForm) => {
    setLoading(true)
    try {
      await login(data.email, data.password)
      toast({ title: t('auth.loginSuccess'), description: t('auth.welcome'), variant: 'success' })
      navigate('/')
    } catch (err: any) {
      const msg = err.response?.data?.message || err.response?.data?.error || t('auth.invalidCredentials')
      setAuthMessage(msg)
      toast({ title: t('auth.loginFailed'), description: msg, variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  const onRegister = async (data: RegisterForm) => {
    setLoading(true)
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL || '/api'}/auth/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
      const payload = await response.json()
      if (!response.ok) throw new Error(payload.message || payload.error || t('auth.registrationFailed'))
      localStorage.setItem('token', payload.data.token)
      await fetchMe()
      toast({ title: t('trial.created'), variant: 'success' })
      navigate('/', { replace: true })
    } catch (err: any) {
      toast({ title: t('auth.registrationFailed'), description: err.message, variant: 'destructive' })
    } finally { setLoading(false) }
  }

  return (
    <div className="relative isolate grid min-h-[100dvh] w-full overflow-hidden bg-background lg:grid-cols-2">
      <span aria-hidden="true" className="pointer-events-none absolute -right-28 -top-28 -z-10 h-64 w-64 rounded-full bg-[#DCEEE7]" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-40 -left-36 -z-10 h-72 w-72 rounded-full bg-[#DCEEE7] opacity-80" />
      <span aria-hidden="true" className="pointer-events-none absolute -bottom-36 -right-32 -z-10 h-64 w-64 rounded-full bg-[#F5EEFF] opacity-70" />
      <div className="absolute end-4 top-4 z-10 w-24 sm:end-8 sm:top-8">
        <LanguageSwitcher compact />
      </div>
      <div className="hidden flex-col justify-between border-e border-[#E3EAE7] bg-[#F2F5F3] p-12 lg:flex">
        <div className="flex items-center gap-3">
          <span className="relative flex h-12 w-12 items-center justify-center rounded-full border-[3px] border-white bg-[#DCEEE7] text-[#12705A] shadow-[0_12px_24px_-18px_rgba(18,112,90,0.7)]">
            <Stethoscope size={22} strokeWidth={2.4} />
            <i aria-hidden="true" className="absolute -right-1.5 top-0 h-2.5 w-2.5 rounded-full bg-[#46C49F]" />
          </span>
          <span className="text-2xl font-bold tracking-[-0.04em] text-[#14231E]">Cabinet Pro</span>
        </div>

        <div className="flex max-w-md items-start gap-5">
          <span aria-hidden="true" className="mt-2 h-16 w-2 shrink-0 rounded-full bg-primary" />
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-wide text-[#12705A]">{t('login.eyebrow')}</p>
            <h1 className="text-5xl font-bold leading-[1.05] tracking-[-0.05em] text-[#14231E]">
              {t('auth.headline')}
            </h1>
            <p className="text-lg text-[#5A6B65]">
              {t('auth.description')}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4 text-center">
          {[
            { n: 'FDI', l: t('login.chart'), c: 'bg-[#DCEEE7] text-[#12705A]' },
            { n: 'J-1', l: t('login.reminders'), c: 'bg-[#FBEED6] text-[#99600B]' },
            { n: 'FR·AR', l: t('login.languages'), c: 'bg-[#E1E9F7] text-[#2D5DAA]' },
          ].map(s => (
            <div key={s.l} className="rounded-3xl border border-[#D8E1DD] bg-white p-4">
              <div className={`mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full text-sm font-bold ${s.c}`}>{s.n}</div>
              <div className="text-xs font-medium text-[#5A6B65]">{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center justify-center px-4 py-16 sm:p-6 lg:p-12">
        <Card className="w-full max-w-md border-transparent bg-white/90 shadow-none backdrop-blur-sm sm:border-[#D8E1DD] sm:shadow-[0_24px_60px_-40px_rgba(18,112,90,0.6)]">
          <CardHeader className="items-center space-y-1 text-center">
            <span className="relative mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-[#DCEEE7] text-[#12705A] shadow-[0_12px_24px_-18px_rgba(18,112,90,0.7)] lg:hidden">
              <Stethoscope size={28} strokeWidth={2.3} />
              <i aria-hidden="true" className="absolute -right-2 top-0 h-2.5 w-2.5 rounded-full bg-[#46C49F]" />
            </span>
            <CardTitle className="text-3xl tracking-[-0.04em]">{registerMode ? t('auth.register') : t('auth.login')}</CardTitle>
            <CardDescription className="text-base">{t('auth.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {authMessage && (
              <div role="alert" className="mb-5 rounded-2xl border border-[#FFC2CA] bg-[#FFE8EB] px-4 py-3 text-sm text-[#A51F3A]">
                {authMessage}
              </div>
            )}
            {registerMode ? <form onSubmit={registerForm.handleSubmit(onRegister)} className="space-y-4">
              <div className="flex items-center gap-3 rounded-2xl bg-[#FFF3D4] p-3 text-sm">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#FFD36A] text-[#0D4A3B]"><Gift size={18} /></span>
                <div><p className="font-bold text-[#14231E]">{t('trial.cta', { days: TRIAL_DAYS })}</p><p className="text-xs text-[#8A5A00]">{t('trial.ctaHint')}</p></div>
              </div>
              <div className="space-y-2"><Label>{t('auth.cabinetName')}</Label><Input {...registerForm.register('cabinetName', { required: true })} placeholder="Cabinet dentaire Anfa" /></div>
              <div className="space-y-2"><Label htmlFor="specialty">Spécialité</Label><NativeSelect id="specialty" {...registerForm.register('specialty', { required: true })}>{(specialties.length ? specialties.filter(s => s.isActive) : [{ code: 'DENTISTRY', name: 'Médecine dentaire' }]).map(s => <option key={s.code} value={s.code}>{t(`specialty.${s.code}`, s.name)}</option>)}</NativeSelect></div>
              <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>{t('auth.firstName')}</Label><Input {...registerForm.register('firstName', { required: true })} /></div><div className="space-y-2"><Label>{t('auth.lastName')}</Label><Input {...registerForm.register('lastName', { required: true })} /></div></div>
              <div className="space-y-2"><Label>{t('common.email')}</Label><Input type="email" autoComplete="email" {...registerForm.register('email', { required: true })} /></div>
              <div className="space-y-2"><Label>{t('trial.phone')}</Label><Input type="tel" autoComplete="tel" placeholder="06 12 34 56 78" {...registerForm.register('phone', { required: true, minLength: 6 })} /><p className="text-xs text-[#5A6B65]">{t('trial.phoneHint')}</p></div>
              <div className="space-y-2"><Label>{t('auth.password')}</Label><Input type="password" autoComplete="new-password" {...registerForm.register('password', { required: true, minLength: 8 })} /><p className="text-xs text-[#5A6B65]">{t('trial.passwordHint')}</p></div>
              <Button type="submit" size="lg" className="w-full" disabled={loading}>{loading ? t('auth.creating') : t('auth.startTrial')}</Button>
              <button type="button" className="w-full py-2 text-sm font-semibold text-primary" onClick={() => setRegisterMode(false)}>{t('auth.haveAccount')}</button>
            </form> : <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="email">{t('auth.emailAddress')}</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="vous@exemple.ma"
                  {...register('email', {
                    required: t('auth.emailRequired'),
                    pattern: {
                      value: /^\S+@\S+\.\S+$/,
                      message: t('auth.invalidEmail'),
                    },
                  })}
                  className={errors.email ? 'border-destructive' : ''}
                />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password">{t('auth.password')}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="••••••••"
                    {...register('password', {
                      required: t('auth.passwordRequired'),
                      minLength: { value: 4, message: t('auth.minChars') },
                    })}
                    className={`pe-11 ${errors.password ? 'border-destructive' : ''}`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(s => !s)}
                    className="absolute end-1 top-1/2 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full text-[#5A6B65] hover:bg-[#DCEEE7] hover:text-primary"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <Button
                type="submit"
                size="lg"
                className="w-full font-semibold text-base"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="me-2 h-5 w-5 animate-spin" />
                    {t('auth.signingIn')}
                  </>
                ) : (
                  t('auth.signIn')
                )}
              </Button>

              <div className="relative py-1 text-center text-xs text-[#8A9A94] before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-[#D8E1DD]"><span className="relative bg-white px-3">ou</span></div>
              <Button type="button" variant="outline" size="lg" className="w-full gap-2" onClick={() => setRegisterMode(true)}>
                <Gift size={17} className="text-[#E59A00]" /> {t('trial.cta', { days: TRIAL_DAYS })}
              </Button>
              </form>}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
