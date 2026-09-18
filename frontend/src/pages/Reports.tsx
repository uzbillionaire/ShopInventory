import { useState } from 'react'
import { Link } from 'react-router'
import { useReportDays } from '../api/hooks'
import { BackIcon } from '../components/Icons'
import { ErrorNotice, Loading } from '../components/ui'
import { useI18n } from '../i18n'
import { dayLabel, daysAgo, isoDay, som, spaced } from '../lib/format'

export default function Reports() {
  const { t, lang, pairs } = useI18n()
  const [span, setSpan] = useState(30)
  const today = isoDay(new Date())
  const report = useReportDays(daysAgo(span - 1), today)
  const unit = t('som')

  return (
    <>
      <Link className="back" to="/stats"><BackIcon size={20} />{t('statsTitle')}</Link>
      <div className="page-head">
        <h1 className="page-title">{t('dailyReports')}</h1>
      </div>

      {report.isPending ? (
        <Loading />
      ) : report.isError ? (
        <ErrorNotice error={report.error} onRetry={() => report.refetch()} />
      ) : (
        <>
          <ul className="report-days">
            {report.data.days.map((day) => {
              const quiet = day.units === 0 && day.received_pairs === 0
              return (
                <li key={day.date} className={quiet ? 'quiet' : undefined}>
                  <Link to={`/reports/${day.date}`}>
                    <span>
                      <span className="report-day-name">{dayLabel(day.date, lang, t('today'), t('yesterday'))}</span>
                      <span className="stock-meta">
                        {day.units > 0 ? `${pairs(day.units)} ${t('soldPairsShort')}` : t('quietDay')}
                        {day.received_pairs > 0 && `, ${pairs(day.received_pairs)} ${t('receivedShort')}`}
                      </span>
                    </span>
                    {day.units > 0 && (
                      <span className="report-day-money">
                        <strong>{som(day.revenue, unit)}</strong>
                        <span className={`profit${day.profit < 0 ? ' loss' : ''}`}>
                          {t(day.profit < 0 ? 'loss' : 'profit', { amount: spaced(Math.abs(day.profit)) })}
                        </span>
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
          {span < 366 && (
            <div className="more">
              <button type="button" className="button ghost" disabled={report.isFetching} onClick={() => setSpan((n) => Math.min(366, n + 30))}>
                {report.isFetching ? t('loading') : t('earlierDays')}
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}
