import { useState, type FormEvent } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useStats } from '../api/hooks'
import type { Ranking } from '../api/types'
import { ErrorNotice, Loading, SizeChip } from '../components/ui'
import { useI18n, type MessageKey } from '../i18n'
import { date, daysAgo, isoDay, som, spaced } from '../lib/format'

const PRESETS: [MessageKey, number][] = [['days7', 7], ['days30', 30], ['days90', 90], ['year', 365]]

export default function Stats() {
  const { t, lang } = useI18n()
  const [params, setParams] = useSearchParams()
  const today = isoDay(new Date())
  const start = params.get('start') ?? daysAgo(29)
  const end = params.get('end') ?? today
  const slowDays = Number(params.get('slow_days') ?? 30)
  const [draft, setDraft] = useState({ start, end })
  const [slowDraft, setSlowDraft] = useState(String(slowDays))
  const [picked, setPicked] = useState<number | null>(null)

  const stats = useStats({ start, end, slow_days: slowDays })
  const unit = t('som')

  function setRange(nextStart: string, nextEnd: string) {
    setDraft({ start: nextStart, end: nextEnd })
    setPicked(null)
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('start', nextStart)
      next.set('end', nextEnd)
      return next
    }, { replace: true })
  }

  function applyRange(event: FormEvent) {
    event.preventDefault()
    if (draft.start && draft.end) setRange(draft.start <= draft.end ? draft.start : draft.end, draft.start <= draft.end ? draft.end : draft.start)
  }

  function applySlow(event: FormEvent) {
    event.preventDefault()
    const days = Math.min(365, Math.max(1, Number(slowDraft) || 30))
    setSlowDraft(String(days))
    setParams((current) => {
      const next = new URLSearchParams(current)
      next.set('slow_days', String(days))
      return next
    }, { replace: true })
  }

  const bucketLabel = (iso: string, step: string) => {
    const d = new Date(`${iso}T00:00:00`)
    if (step === 'month') return d.toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'uz-Latn-UZ', { month: 'short', year: 'numeric' })
    return date(`${iso}T00:00:00`)
  }

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t('statsTitle')}</h1>
        <div className="export-actions">
          <Link className="button small" to="/reports">{t('dailyReports')}</Link>
          <Link className="button small ghost" to="/export">{t('downloadData')}</Link>
        </div>
      </div>

      <div className="presets segmented" role="group">
        {PRESETS.map(([key, days]) => (
          <button key={key} type="button" aria-pressed={end === today && start === daysAgo(days - 1)}
            onClick={() => setRange(daysAgo(days - 1), today)}>
            {t(key)}
          </button>
        ))}
      </div>
      <form className="range-form" onSubmit={applyRange}>
        <div className="field">
          <label className="field-label" htmlFor="start">{t('from')}</label>
          <input id="start" type="date" className="input" value={draft.start} max={today} onChange={(e) => setDraft({ ...draft, start: e.target.value })} />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="end">{t('to')}</label>
          <input id="end" type="date" className="input" value={draft.end} max={today} onChange={(e) => setDraft({ ...draft, end: e.target.value })} />
        </div>
        <button type="submit" className="button ghost">{t('show')}</button>
      </form>

      {stats.isPending ? (
        <Loading />
      ) : stats.isError ? (
        <ErrorNotice error={stats.error} onRetry={() => stats.refetch()} />
      ) : (
        (() => {
          const s = stats.data
          const peak = Math.max(1, ...s.timeline.points.map((p) => p.revenue))
          const point = picked === null ? null : s.timeline.points[picked]
          return (
            <>
              <dl className="headline">
                <dt>{t('profitForPeriod')}</dt>
                <dd className={s.sales.profit < 0 ? 'loss' : undefined}>{som(s.sales.profit, unit)}</dd>
              </dl>
              <dl className="figures">
                <div><dt>{t('revenue')}</dt><dd>{som(s.sales.revenue, unit)}</dd></div>
                <div><dt>{t('pairsSold')}</dt><dd>{spaced(s.sales.units)}</dd></div>
                <div><dt>{t('stockAtCost')}</dt><dd>{som(s.inventory.value, unit)}</dd></div>
                <div><dt>{t('avgDaysToSell')}</dt><dd>{s.average_days_to_sell === null ? '—' : t('nDays', { n: s.average_days_to_sell })}</dd></div>
              </dl>

              <section className="section">
                <h2 className="section-title">{t('salesOverTime')}</h2>
                <div className="chart-bars">
                  {s.timeline.points.map((p, index) => {
                    const label = `${bucketLabel(p.date, s.timeline.step)}: ${t('revenue')} ${som(p.revenue, unit)}, ${t('profitKey')} ${som(p.profit, unit)}, ${p.units}`
                    return (
                      <button key={p.date} type="button" className="chart-bar" aria-label={label} aria-pressed={picked === index}
                        onClick={() => setPicked(index)} onMouseEnter={() => setPicked(index)} onFocus={() => setPicked(index)}>
                        <span className="rev" style={{ height: `${(p.revenue / peak) * 100}%` }}>
                          <span className="prof" style={{ height: p.revenue ? `${(Math.max(p.profit, 0) / p.revenue) * 100}%` : 0 }} />
                        </span>
                      </button>
                    )
                  })}
                </div>
                <div className="chart-axis">
                  <span>{bucketLabel(s.timeline.points[0]?.date ?? start, s.timeline.step)}</span>
                  <span>{bucketLabel(s.timeline.points.at(-1)?.date ?? end, s.timeline.step)}</span>
                </div>
                <div className="chart-key"><span className="rev">{t('revenue')}</span><span>{t('profitKey')}</span></div>
                <p className="chart-tip" aria-live="polite">
                  {point
                    ? `${bucketLabel(point.date, s.timeline.step)}: ${som(point.revenue, unit)}, ${t('profitKey').toLowerCase()} ${som(point.profit, unit)}`
                    : <span className="muted">{t('tapBar')}</span>}
                </p>
              </section>

              <div className="two-col section">
                <RankingList title={t('bestBrands')} rows={s.best_brands} />
                <RankingList title={t('bestSizes')} rows={s.best_sizes} />
              </div>

              <section className="section">
                <h2 className="section-title">{t('slowTitle')}</h2>
                <form className="slow-controls" onSubmit={applySlow}>
                  <label htmlFor="slow_days">{t('unsoldForDays')}</label>
                  <input id="slow_days" className="input" type="number" inputMode="numeric" min={1} max={365}
                    value={slowDraft} onChange={(e) => setSlowDraft(e.target.value)} onBlur={applySlow} />
                </form>
                {s.slow_moving.entries.length === 0 ? (
                  <p className="muted">{t('slowNone', { n: s.slow_moving.days })}</p>
                ) : (
                  <ul className="slow-list">
                    {s.slow_moving.entries.map((entry) => (
                      <li key={entry.code}>
                        <Link to={`/e/${entry.code}`}>
                          <SizeChip size={entry.size} />
                          <span>
                            <span className="stock-brand">{entry.batch.brand}</span>
                            <span className="stock-meta">{t('addedOn')} {date(entry.batch.date_added)}</span>
                          </span>
                          <span className="stock-qty"><strong>{entry.quantity}</strong><span>{t('left')}</span></span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )
        })()
      )}
    </>
  )
}

function RankingList({ title, rows }: { title: string; rows: Ranking[] }) {
  const { t, pairs } = useI18n()
  return (
    <section>
      <h2 className="section-title">{title}</h2>
      {rows.length === 0 ? (
        <p className="muted">{t('noSalesInPeriod')}</p>
      ) : (
        <ol className="ranking">
          {rows.map((row) => (
            <li key={row.label}>
              <b>{row.label}</b>
              <span>{pairs(row.units)}</span>
              <span className="bar" aria-hidden="true"><i style={{ width: `${row.share}%` }} /></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  )
}
