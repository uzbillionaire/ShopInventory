import { useState } from 'react'
import { Link, Navigate, useParams } from 'react-router'
import { download } from '../api/client'
import { useDailyReport } from '../api/hooks'
import { BackIcon } from '../components/Icons'
import { PaymentSplit, SummaryGroup } from '../components/Summary'
import { ErrorNotice, Loading, SizeChip, useToast } from '../components/ui'
import { useI18n } from '../i18n'
import { dayLabel, isoDay, shiftDay, som, spaced } from '../lib/format'

export default function DailyReport() {
  const { date = '' } = useParams()
  const { t, lang, pairs } = useI18n()
  const toast = useToast()
  const today = isoDay(new Date())
  const valid = /^\d{4}-\d{2}-\d{2}$/.test(date) && date <= today
  const report = useDailyReport(valid ? date : today)
  const [downloading, setDownloading] = useState(false)
  const unit = t('som')

  if (!valid) return <Navigate to={`/reports/${today}`} replace />

  async function downloadExcel() {
    setDownloading(true)
    try {
      await download(`/reports/daily.xlsx?date=${date}`)
    } catch {
      toast({ message: t('networkError') })
    } finally {
      setDownloading(false)
    }
  }

  const previous = shiftDay(date, -1)
  const next = shiftDay(date, 1)

  return (
    <>
      <Link className="back" to="/reports"><BackIcon size={20} />{t('dailyReports')}</Link>

      <div className="day-nav">
        <Link className="icon-button" to={`/reports/${previous}`} title={t('previousDay')}>
          <BackIcon size={22} /><span className="visually-hidden">{t('previousDay')}</span>
        </Link>
        <h1 className="page-title">{dayLabel(date, lang, t('today'), t('yesterday'))}</h1>
        {next <= today ? (
          <Link className="icon-button" to={`/reports/${next}`} title={t('nextDay')}>
            <BackIcon size={22} style={{ transform: 'scaleX(-1)' }} /><span className="visually-hidden">{t('nextDay')}</span>
          </Link>
        ) : <span className="icon-button" aria-hidden="true" />}
      </div>

      {report.isPending ? (
        <Loading />
      ) : report.isError ? (
        <ErrorNotice error={report.error} onRetry={() => report.refetch()} />
      ) : (
        (() => {
          const r = report.data
          return (
            <>
              <dl className="headline">
                <dt>{t('profitForDay')}</dt>
                <dd className={r.sales.profit < 0 ? 'loss' : undefined}>{som(r.sales.profit, unit)}</dd>
              </dl>
              <div className="summary">
                <SummaryGroup title={t('groupSales')}>
                  <dl className="figures plain">
                    <div><dt>{t('revenue')}</dt><dd>{som(r.sales.revenue, unit)}</dd></div>
                    <div><dt>{t('pairsSold')}</dt><dd>{spaced(r.sales.units)}</dd></div>
                  </dl>
                </SummaryGroup>
                <SummaryGroup title={t('groupPayment')}>
                  <PaymentSplit {...r.by_payment} />
                </SummaryGroup>
                <SummaryGroup title={t('received')}>
                  <dl className="figures plain">
                    <div><dt>{t('receivedPairs')}</dt><dd>{spaced(r.received_summary.pairs)}</dd></div>
                    <div><dt>{t('receivedValue')}</dt><dd>{som(r.received_summary.value, unit)}</dd></div>
                  </dl>
                </SummaryGroup>
              </div>

              <div className="tag-actions">
                <button type="button" className="button ghost block" onClick={downloadExcel} disabled={downloading}>
                  {downloading ? t('preparing') : t('downloadExcel')}
                </button>
              </div>

              <section className="section">
                <h2 className="section-title">{t('sales')}</h2>
                {r.sales_list.length === 0 ? (
                  <p className="muted">{t('noSalesToday')}</p>
                ) : (
                  <ul className="stock-list">
                    {r.sales_list.map((sale) => (
                      <li className="stock-row" key={sale.id}>
                        <Link to={`/e/${sale.code}`}>
                          <SizeChip size={sale.size} />
                          <span>
                            <span className="stock-brand">{sale.brand}</span>
                            <span className="stock-meta">{new Date(sale.sold_at).toTimeString().slice(0, 5)} · {t(sale.payment)}</span>
                          </span>
                          <span className="report-day-money">
                            <strong>{som(sale.sold_price, unit)}</strong>
                            <span className={`profit${sale.profit < 0 ? ' loss' : ''}`}>
                              {t(sale.profit < 0 ? 'loss' : 'profit', { amount: spaced(Math.abs(sale.profit)) })}
                            </span>
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              {r.by_brand.length > 1 && (
                <section className="section">
                  <h2 className="section-title">{t('soldByBrand')}</h2>
                  <ol className="ranking">
                    {r.by_brand.map((row) => (
                      <li key={row.label}>
                        <b>{row.label}</b>
                        <span>{pairs(row.units)}, {som(row.revenue, unit)}</span>
                        <span className="bar" aria-hidden="true"><i style={{ width: `${row.share}%` }} /></span>
                      </li>
                    ))}
                  </ol>
                </section>
              )}

              <section className="section">
                <h2 className="section-title">{t('received')}</h2>
                {r.received.length === 0 ? (
                  <p className="muted">{t('nothingReceived')}</p>
                ) : (
                  <ul className="stock-list">
                    {r.received.map((row, index) => (
                      <li className="stock-row" key={`${row.code}-${index}`}>
                        <Link to={`/e/${row.code}`}>
                          <SizeChip size={row.size} />
                          <span>
                            <span className="stock-brand">{row.brand}</span>
                            <span className="stock-meta">{som(row.bought_price, unit)}</span>
                          </span>
                          <span className="stock-qty"><strong>+{row.quantity}</strong></span>
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
