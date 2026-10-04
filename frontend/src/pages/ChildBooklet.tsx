import { useQuery } from '@tanstack/react-query'
import { useParams } from 'react-router-dom'
import api from '../lib/api'
import { useCabinetApi } from '../lib/hooks'
import { formatDateFR } from '../lib/utils'
import { Patient } from '../types'
import { ClinicalRecord } from '../specialties/records'
import { ageInMonths, Indicator, percentileLabel, Sex } from '../specialties/growth'
import { Measure, PercentileChart, PNI_CALENDAR, Point } from '../specialties/Pediatrics'
import { PrintPage, patientLine } from './Print'

type Growth = { weight?: number | null; height?: number | null; headCircumference?: number | null }
type Vaccine = { code: string; lot?: string | null }

const ageLabel = (m: number) => (m < 1 ? 'Naissance' : m < 24 ? `${Math.floor(m)} mois` : `${Math.floor(m / 12)} ans${Math.floor(m % 12) ? ` ${Math.floor(m % 12)} mois` : ''}`)
/** Whole calendar months (birthday to birthday), for labels. */
const monthsBetween = (from: Date, to: Date) => (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth()) - (to.getDate() < from.getDate() ? 1 : 0)
const bmiOf = (w?: number | null, h?: number | null) => (w && h ? Math.round((w / (h / 100) ** 2) * 10) / 10 : null)

/** Child health booklet summary: growth with WHO percentiles and the vaccination calendar, for the parents. */
export default function ChildBooklet() {
  const { patientId = '' } = useParams()
  const cabinetApi = useCabinetApi()
  const base = `${cabinetApi}/patients/${patientId}`
  const { data: patient } = useQuery({ queryKey: ['patient', patientId], queryFn: async () => (await api.get(base)).data.data as Patient, refetchInterval: false })
  const { data: records } = useQuery({
    queryKey: ['records', patientId, 'PEDIATRICS', 'booklet'],
    queryFn: async () => (await api.get(`${base}/records`, { params: { specialty: 'PEDIATRICS' } })).data.data as ClinicalRecord[],
    refetchInterval: false,
  })
  const ready = !!patient && !!records
  const birth = patient?.birthDate ? new Date(patient.birthDate) : null
  const sex: Sex | null = patient?.sex === 'M' || patient?.sex === 'F' ? patient.sex : null
  const growth = (records || []).filter(r => r.kind === 'GROWTH') as ClinicalRecord<Growth>[]
  const vaccines = (records || []).filter(r => r.kind === 'VACCINE') as ClinicalRecord<Vaccine>[]
  const done = new Map(vaccines.map(v => [v.data.code, v]))
  const points: Point[] = birth ? [...growth].reverse().map(r => ({
    age: ageInMonths(birth, new Date(r.date)), weight: r.data.weight ?? null, height: r.data.height ?? null, head: r.data.headCircumference ?? null, bmi: bmiOf(r.data.weight, r.data.height),
  })) : []
  const ageNow = birth ? ageInMonths(birth, new Date()) : null
  const calendar = PNI_CALENDAR.filter(v => !v.girlsOnly || patient?.sex !== 'M')

  return (
    <PrintPage ready={ready}>
      {patient && (
        <div className="space-y-5">
          <div className="flex justify-between gap-4">
            <div>
              <h1 className="text-xl font-bold tracking-[0.1em]">CARNET DE SANTÉ</h1>
              <p className="text-[12px]">Résumé de croissance et de vaccination · édité le {formatDateFR(new Date().toISOString())}</p>
            </div>
            <div className="text-end">
              <p className="font-bold">{patientLine(patient)}</p>
              {birth && <p>Né(e) le {formatDateFR(patient.birthDate!)} · {ageLabel(monthsBetween(birth, new Date()))}</p>}
            </div>
          </div>

          {sex && points.length > 0 && (
            <section className="grid grid-cols-2 gap-4 break-inside-avoid">
              {([['weight', 'Poids (kg)', 'kg', '#12705A'], ['height', 'Taille (cm)', 'cm', '#2D5DA8']] as [Indicator, string, string, string][]).map(([ind, title, unit, color]) => (
                <div key={ind}><p className="mb-1 text-[12px] font-bold">{title}</p><PercentileChart indicator={ind} sex={sex} points={points} unit={unit} color={color} /></div>
              ))}
              <p className="col-span-2 text-[11px]">Courbes de l’OMS : P3, P15, P50, P85, P97. Les valeurs suivies d’un percentile en gras sont en dehors de P3 à P97.</p>
            </section>
          )}

          <section className="break-inside-avoid">
            <h2 className="mb-2 border-b border-black/30 pb-1 text-[14px] font-bold uppercase tracking-[0.08em]">Mesures</h2>
            {growth.length === 0 ? <p>Aucune mesure.</p> : (
              <table className="w-full text-[12px]">
                <thead><tr className="text-start"><th className="py-1 text-start">Date</th><th className="text-start">Âge</th><th className="text-end">Poids</th><th className="text-end">Taille</th><th className="text-end">PC</th><th className="text-end">IMC</th></tr></thead>
                <tbody>
                  {growth.map(r => {
                    const age = birth ? ageInMonths(birth, new Date(r.date)) : 0
                    const bmi = bmiOf(r.data.weight, r.data.height)
                    const info = (ind: Indicator, v?: number | null) => (birth ? percentileLabel(ind, sex, age, v) : null)
                    return (
                      <tr key={r.id} className="border-t border-black/15">
                        <td className="py-1">{formatDateFR(r.date)}</td>
                        <td>{birth ? ageLabel(monthsBetween(birth, new Date(r.date))) : '—'}</td>
                        <td className="text-end"><Measure value={r.data.weight} info={info('weight', r.data.weight)} /></td>
                        <td className="text-end"><Measure value={r.data.height} info={info('height', r.data.height)} /></td>
                        <td className="text-end"><Measure value={r.data.headCircumference} info={info('head', r.data.headCircumference)} /></td>
                        <td className="text-end"><Measure value={bmi} info={info('bmi', bmi)} /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            )}
          </section>

          <section className="break-inside-avoid">
            <h2 className="mb-2 border-b border-black/30 pb-1 text-[14px] font-bold uppercase tracking-[0.08em]">Vaccinations (Programme national d’immunisation)</h2>
            <table className="w-full text-[12px]">
              <thead><tr><th className="py-1 text-start">Vaccin</th><th className="text-start">Âge prévu</th><th className="text-start">Fait le</th><th className="text-start">N° de lot</th></tr></thead>
              <tbody>
                {calendar.map(v => {
                  const rec = done.get(v.code)
                  const late = !rec && ageNow !== null && ageNow > v.months + 1
                  return (
                    <tr key={v.code} className="border-t border-black/15">
                      <td className="py-1">{v.label}</td>
                      <td>{ageLabel(v.months)}</td>
                      <td className={late ? 'font-bold' : ''}>{rec ? formatDateFR(rec.date) : late ? 'À faire (en retard)' : 'À venir'}</td>
                      <td>{rec?.data.lot || ''}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            <p className="mt-2 text-[11px]">Calendrier indicatif ; vérifiez-le avec le calendrier national en vigueur.</p>
          </section>
        </div>
      )}
    </PrintPage>
  )
}
