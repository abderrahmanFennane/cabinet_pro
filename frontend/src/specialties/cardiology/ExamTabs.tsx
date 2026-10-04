import { useL } from '../../lib/labels'
import { Patient } from '../../types'
import { Label } from '../../components/ui/label'
import { Input } from '../../components/ui/input'
import { NativeSelect } from '../../components/ui/native-select'
import { ClinicalRecord } from '../records'
import { COLORS, Section, Trend } from '../ui'
import { byDate } from '../ophthalmology/shared'
import { abpmHypertension, dipping, predictedMaxHr } from './calc'
import { Abpm, ageYears, Badge, Echo, Ecg, ExamForm, Holter, Stress } from './shared'

type Save = (kind: string, date: string, data: object, done: () => void) => void
type Props<T> = { patientId: string; records: ClinicalRecord<T>[]; saving: boolean; onSave: (date: string, data: object, done: () => void) => void; onDelete: (id: string) => void }
const line = (parts: (string | false | null | undefined | 0)[]) => parts.filter(Boolean).join(' · ')

const RHYTHMS = ['Sinusal', 'Fibrillation atriale', 'Flutter atrial', 'Tachycardie sinusale', 'Bradycardie sinusale', 'Rythme électro-entraîné', 'BAV 1', 'BAV 2', 'BAV 3']

function TextExtra({ id, label, list, value, onChange, placeholder }: { id: string; label: string; list?: string[]; value: string; onChange: (v: string) => void; placeholder?: string }) {
  const L = useL()
  return (
    <div className="space-y-1.5"><Label htmlFor={id}>{L(label)}</Label>
      <Input id={id} list={list ? `${id}-list` : undefined} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)} />
      {list && <datalist id={`${id}-list`}>{list.map(x => <option key={x} value={L(x)} />)}</datalist>}
    </div>
  )
}

/** QTc above 450 ms (men) / 460 ms (women) is long, above 500 ms is at risk. */
const qtcTone = (qtc: number, female: boolean) => (qtc > 500 ? 'bad' : qtc > (female ? 460 : 450) ? 'warn' : 'ok')

export function EcgTab({ patient, ...p }: Props<Ecg> & { patient: Patient }) {
  const L = useL()
  const female = patient.sex === 'F'
  return (
    <ExamForm<Ecg> {...p} kindLabel="ECG" title="ECG" hint="Mesures, interprétation et tracé scanné ou photographié."
      numbers={[['rate', 'Fréquence', 'bpm'], ['pr', 'PR', 'ms'], ['qrs', 'QRS', 'ms'], ['qtc', 'QTc', 'ms'], ['axis', 'Axe', '°']]}
      texts={[['interpretation', 'Interprétation', 'ex. Rythme sinusal, BBD complet, pas de trouble de la repolarisation']]}
      extra={(v, set) => <TextExtra id="ecg-rhythm" label="Rythme" list={RHYTHMS} value={v.rhythm ?? ''} onChange={x => set('rhythm', x)} />}
      summary={d => (<>
        <p><b>{d.rhythm || L('Rythme non précisé')}</b>{d.rate ? ` · ${d.rate} bpm` : ''}</p>
        <p className="flex flex-wrap gap-1.5 text-[#5A6B65]">{line([d.pr != null && `PR ${d.pr} ms`, d.qrs != null && `QRS ${d.qrs} ms`, d.axis != null && `${L('axe')} ${d.axis}°`])}
          {d.qtc != null && <Badge tone={qtcTone(d.qtc, female)}>QTc {d.qtc} ms</Badge>}</p>
        {d.interpretation && <p className="text-[#5A6B65]">{d.interpretation}</p>}
      </>)} />
  )
}

/** LVEF classes (ESC 2021): preserved ≥ 50 %, mildly reduced 41-49 %, reduced ≤ 40 %. */
const lvefClass = (v: number) => (v >= 50 ? ['ok', 'FEVG préservée'] : v > 40 ? ['warn', 'FEVG modérément réduite'] : ['bad', 'FEVG réduite']) as ['ok' | 'warn' | 'bad', string]

export function EchoTab(p: Props<Echo>) {
  const L = useL()
  const curve = byDate(p.records.filter(r => r.data.lvef != null), d => ({ lvef: d.lvef }))
  return (
    <div className="grid gap-5">
      {curve.length > 1 && (
        <Section title={L('Évolution de la FEVG')}>
          <Trend data={curve} unit="%" series={[{ key: 'lvef', label: 'FEVG', color: COLORS.primary }]} references={[{ y: 50, label: '50 %' }, { y: 40, label: '40 %' }]} />
        </Section>
      )}
      <ExamForm<Echo> {...p} kindLabel="Echo" title="Échocardiographie transthoracique" hint="Ventricule gauche, oreillettes, cœur droit et valves."
        numbers={[['lvef', 'FEVG', '%'], ['lvedd', 'DTDVG', 'mm'], ['lvesd', 'DTSVG', 'mm'], ['ivs', 'SIV', 'mm'], ['pw', 'Paroi postérieure', 'mm'], ['lavi', 'Volume OG indexé', 'mL/m²'], ['ee', 'E/e′', ''], ['tapse', 'TAPSE', 'mm'], ['paps', 'PAPs', 'mmHg']]}
        texts={[['valves', 'Valves', 'ex. IM grade 2, RAo serré (SVA 0,8 cm²)…'], ['pericardium', 'Péricarde'], ['conclusion', 'Conclusion']]}
        extra={(v, set) => (
          <div className="space-y-1.5 sm:max-w-xs"><Label htmlFor="echo-method">{L('Méthode de la FEVG')}</Label>
            <NativeSelect id="echo-method" value={v.method ?? ''} onChange={e => set('method', e.target.value)}>
              <option value="">—</option>{['Simpson biplan', 'Teichholz', 'Visuelle', '3D'].map(m => <option key={m} value={m}>{L(m)}</option>)}
            </NativeSelect>
          </div>
        )}
        summary={d => (<>
          <p className="flex flex-wrap items-center gap-1.5">{d.lvef != null && <><b>FEVG {d.lvef} %</b><Badge tone={lvefClass(d.lvef)[0]}>{L(lvefClass(d.lvef)[1])}</Badge></>}{d.method && <span className="text-[#5A6B65]">({d.method})</span>}</p>
          <p className="text-[#5A6B65]">{line([d.lvedd != null && `DTDVG ${d.lvedd} mm`, d.ivs != null && `SIV ${d.ivs} mm`, d.lavi != null && `OG ${d.lavi} mL/m²`, d.ee != null && `E/e′ ${d.ee}`, d.tapse != null && `TAPSE ${d.tapse} mm`, d.paps != null && `PAPs ${d.paps} mmHg`])}</p>
          {d.valves && <p>{d.valves}</p>}
          {d.conclusion && <p className="text-[#5A6B65]">{d.conclusion}</p>}
        </>)} />
    </div>
  )
}

const DIP: Record<ReturnType<typeof dipping>['kind'], [string, 'ok' | 'warn' | 'bad']> = {
  DIPPER: ['Dipper (baisse nocturne normale)', 'ok'], NON_DIPPER: ['Non-dipper', 'warn'], REVERSE: ['Reverse dipper', 'bad'], EXTREME: ['Dipper extrême', 'warn'],
}

export function HolterTab({ holters, abpms, ...p }: Omit<Props<never>, 'records' | 'onSave'> & { onSave: Save; holters: ClinicalRecord<Holter>[]; abpms: ClinicalRecord<Abpm>[] }) {
  const L = useL()
  return (
    <div className="grid gap-8">
      <ExamForm<Holter> {...p} records={holters} kindLabel="Holter" title="Holter ECG" hint="Enregistrement de 24 h à plusieurs jours."
        onSave={(date, data, done) => p.onSave('HOLTER', date, data, done)}
        numbers={[['hours', 'Durée', 'h'], ['hrMin', 'FC min', 'bpm'], ['hrMean', 'FC moyenne', 'bpm'], ['hrMax', 'FC max', 'bpm'], ['pvc', 'ESV', '/24 h'], ['pac', 'ESA', '/24 h'], ['longestPause', 'Plus longue pause', 's'], ['afBurden', 'Charge en FA', '%'], ['nsvt', 'Salves de TV non soutenue', '']]}
        texts={[['symptoms', 'Symptômes notés et corrélation'], ['conclusion', 'Conclusion']]}
        extra={(v, set) => <TextExtra id="holter-rhythm" label="Rythme de base" list={RHYTHMS} value={v.rhythm ?? ''} onChange={x => set('rhythm', x)} />}
        summary={d => (<>
          <p><b>{d.rhythm || L('Holter')}</b>{d.hours ? ` · ${d.hours} h` : ''}</p>
          <p className="flex flex-wrap gap-1.5 text-[#5A6B65]">{line([d.hrMin != null && `FC ${d.hrMin}/${d.hrMean ?? '?'}/${d.hrMax ?? '?'} bpm`, d.pvc != null && `ESV ${d.pvc}`, d.pac != null && `ESA ${d.pac}`, d.nsvt ? `${d.nsvt} ${L('salve(s) de TVNS')}` : null])}
            {d.longestPause != null && d.longestPause >= 3 && <Badge tone="bad">{L('Pause')} {d.longestPause} s</Badge>}
            {d.afBurden ? <Badge tone="warn">FA {d.afBurden} %</Badge> : null}</p>
          {d.conclusion && <p className="text-[#5A6B65]">{d.conclusion}</p>}
        </>)} />
      <ExamForm<Abpm> {...p} records={abpms} kindLabel="MAPA" title="MAPA (mesure ambulatoire de la tension sur 24 h)" hint="Seuils d’HTA : 24 h ≥ 130/80, jour ≥ 135/85, nuit ≥ 120/70 mmHg (ESC)."
        onSave={(date, data, done) => p.onSave('ABPM', date, data, done)}
        numbers={[['sys24', 'Systolique 24 h', 'mmHg'], ['dia24', 'Diastolique 24 h', 'mmHg'], ['sysDay', 'Systolique jour', 'mmHg'], ['diaDay', 'Diastolique jour', 'mmHg'], ['sysNight', 'Systolique nuit', 'mmHg'], ['diaNight', 'Diastolique nuit', 'mmHg'], ['hr24', 'FC moyenne', 'bpm'], ['validReadings', 'Mesures valides', '%']]}
        texts={[['conclusion', 'Conclusion']]}
        summary={d => {
          const h = abpmHypertension(d)
          const dip = d.sysDay && d.sysNight ? dipping(d.sysDay, d.sysNight) : null
          return (<>
            <p><b>24 h {d.sys24 ?? '?'}/{d.dia24 ?? '?'}</b> · {L('jour')} {d.sysDay ?? '?'}/{d.diaDay ?? '?'} · {L('nuit')} {d.sysNight ?? '?'}/{d.diaNight ?? '?'} mmHg</p>
            <p className="flex flex-wrap gap-1.5">
              {h.h24 || h.day || h.night ? <Badge tone="bad">{L('HTA')} {[h.h24 && '24 h', h.day && L('diurne'), h.night && L('nocturne')].filter(Boolean).join(', ')}</Badge> : <Badge tone="ok">{L('Pas d’HTA à la MAPA')}</Badge>}
              {dip && <Badge tone={DIP[dip.kind][1]}>{L(DIP[dip.kind][0])} · {dip.pct} %</Badge>}
              {d.validReadings != null && d.validReadings < 70 && <Badge tone="warn">{L('Peu de mesures valides')}</Badge>}
            </p>
            {d.conclusion && <p className="text-[#5A6B65]">{d.conclusion}</p>}
          </>)
        }} />
    </div>
  )
}

const RESULT: Record<NonNullable<Stress['result']>, [string, 'ok' | 'bad' | 'warn' | 'info']> = {
  NEGATIVE: ['Négative', 'ok'], POSITIVE: ['Positive', 'bad'], INCONCLUSIVE: ['Douteuse', 'warn'], NOT_DIAGNOSTIC: ['Non contributive', 'info'],
}

export function StressTab({ patient, ...p }: Props<Stress> & { patient: Patient }) {
  const L = useL()
  const at = (date: string) => { const a = ageYears(patient.birthDate, new Date(date)); return a === null ? null : predictedMaxHr(a) }
  return (
    <ExamForm<Stress> {...p} kindLabel="Effort" title="Épreuve d’effort" hint="La FMT (fréquence maximale théorique) est calculée avec 220 − âge ; 85 % est le seuil de validité."
      numbers={[['durationMin', 'Durée', 'min'], ['mets', 'Charge atteinte', 'METs'], ['hrMax', 'FC max atteinte', 'bpm'], ['sbpMax', 'PAS max', 'mmHg']]}
      texts={[['stopReason', 'Motif d’arrêt'], ['symptoms', 'Symptômes'], ['stChanges', 'Modifications du ST'], ['arrhythmia', 'Troubles du rythme'], ['conclusion', 'Conclusion']]}
      extra={(v, set) => {
        const max = at(v.date)
        const pct = max && v.hrMax ? Math.round((Number(v.hrMax) / max) * 100) : null
        return (
          <div className="grid gap-3 sm:grid-cols-3 sm:items-end">
            <TextExtra id="st-protocol" label="Protocole" list={['Bruce', 'Bruce modifié', 'Cycloergomètre']} value={v.protocol ?? ''} onChange={x => set('protocol', x)} />
            <div className="space-y-1.5"><Label htmlFor="st-result">{L('Résultat')}</Label>
              <NativeSelect id="st-result" value={v.result ?? ''} onChange={e => set('result', e.target.value)}>
                <option value="">—</option>{Object.entries(RESULT).map(([k, [x]]) => <option key={k} value={k}>{L(x)}</option>)}
              </NativeSelect>
            </div>
            <p className="rounded-xl bg-[#F4F7F6] px-3 py-2.5 text-[0.9rem]">{max ? <>{L('FMT')} <b>{max} bpm</b>{pct !== null && <> · <b className={pct >= 85 ? 'text-[#1E7A45]' : 'text-[#99600B]'}>{pct} %</b> {pct >= 85 ? L('(épreuve maximale)') : L('(sous-maximale)')}</>}</> : L('Âge inconnu : FMT non calculée.')}</p>
          </div>
        )
      }}
      summary={d => (<>
        <p className="flex flex-wrap items-center gap-1.5"><b>{d.protocol || L('Épreuve d’effort')}</b>{d.result && <Badge tone={RESULT[d.result][1]}>{L(RESULT[d.result][0])}</Badge>}</p>
        <p className="text-[#5A6B65]">{line([d.durationMin != null && `${d.durationMin} min`, d.mets != null && `${d.mets} METs`, d.hrMax != null && `FC ${d.hrMax} bpm`, d.sbpMax != null && `PAS ${d.sbpMax} mmHg`, d.stopReason])}</p>
        {d.stChanges && <p>{L('ST')} : {d.stChanges}</p>}
        {d.conclusion && <p className="text-[#5A6B65]">{d.conclusion}</p>}
      </>)} />
  )
}
