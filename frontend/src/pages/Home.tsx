import { Link } from 'react-router'
import { useLowStock, useStats } from '../api/hooks'
import { PlusIcon, ScanIcon } from '../components/Icons'
import { ErrorNotice, Loading, SizeChip } from '../components/ui'
import { useI18n } from '../i18n'
import { date, isoDay, som, spaced } from '../lib/format'

// Enough to act on at a glance; the full list is one tap away.
const LOW_STOCK_SHOWN = 6

export default function Home() {
  const { t } = useI18n()
  const today = isoDay(new Date())
  const stats = useStats({ start: today, end: today })
  const low = useLowStock()
  const unit = t('som')

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('today')}</h1>
          <p className="page-sub">{date(today)}</p>
        </div>
      </div>

      <div className="home-actions">
        <Link className="button block sell-big" to="/scan">
          <ScanIcon size={26} />
          {t('sellTitle')}
        </Link>
        <Link className="button block ghost" to="/add">
          <PlusIcon size={20} />
          {t('addStock')}
        </Link>
      </div>

      <section className="section">
        {stats.isPending ? (
          <Loading />
        ) : stats.isError ? (
          <ErrorNotice error={stats.error} onRetry={() => stats.refetch()} />
        ) : (
          <>
            <dl className="headline">
              <dt>{t('todayProfit')}</dt>
              <dd className={stats.data.sales.profit < 0 ? 'loss' : undefined}>{som(stats.data.sales.profit, unit)}</dd>
            </dl>
            <dl className="figures">
              <div><dt>{t('revenue')}</dt><dd>{som(stats.data.sales.revenue, unit)}</dd></div>
              <div><dt>{t('pairsSold')}</dt><dd>{spaced(stats.data.sales.units)}</dd></div>
            </dl>
            <Link className="home-more" to={`/reports/${today}`}>{t('todayReport')} →</Link>
          </>
        )}
      </section>

      <section className="section">
        <div className="section-head">
          <h2 className="section-title">{t('runningLow')}{low.data && low.data.count > 0 && ` (${low.data.count})`}</h2>
          {low.data && low.data.count > LOW_STOCK_SHOWN && (
            <Link className="home-more" to="/stock?stock=low">{t('all')} →</Link>
          )}
        </div>
        {low.isPending ? (
          <Loading />
        ) : low.isError ? (
          <ErrorNotice error={low.error} onRetry={() => low.refetch()} />
        ) : low.data.count === 0 ? (
          <p className="page-sub">{t('nothingRunningLow')}</p>
        ) : (
          <ul className="stock-list">
            {low.data.results.slice(0, LOW_STOCK_SHOWN).map((entry) => (
              <li key={entry.code} className="stock-row low">
                <Link to={`/e/${entry.code}`}>
                  <SizeChip size={entry.size} />
                  <span>
                    <span className="stock-brand">{entry.batch.brand}</span>
                    <span className="stock-meta">{som(entry.batch.bought_price, unit)}</span>
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
}
