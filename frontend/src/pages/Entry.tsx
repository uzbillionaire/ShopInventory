import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ApiError, download } from '../api/client'
import { useEntry } from '../api/hooks'
import { BackIcon } from '../components/Icons'
import { ErrorNotice, Loading, useToast } from '../components/ui'
import { useI18n } from '../i18n'
import { date, dateTime, som, spaced } from '../lib/format'

export default function Entry() {
  const { code = '' } = useParams()
  const { t } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const entry = useEntry(code)
  const [downloading, setDownloading] = useState(false)

  if (entry.isPending) return <Loading />

  if (entry.isError) {
    if (entry.error instanceof ApiError && entry.error.status === 404) {
      return (
        <div className="empty">
          <h1 className="page-title" style={{ marginBottom: 10 }}>{t('codeNotFound')}</h1>
          <p>{t('codeNotFoundHint', { code: code.toUpperCase() })}</p>
          <div className="export-actions">
            <Link className="button" to="/scan">{t('scanAgain')}</Link>
            <Link className="button ghost" to="/stock">{t('searchStock')}</Link>
          </div>
        </div>
      )
    }
    return <ErrorNotice error={entry.error} onRetry={() => entry.refetch()} />
  }

  const e = entry.data
  const unit = t('som')

  async function downloadLabel() {
    setDownloading(true)
    try {
      await download(`/entries/${e.code}/label/`)
    } catch {
      toast({ message: t('networkError') })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <>
      <button type="button" className="back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/stock'))}>
        <BackIcon size={20} />{t('back')}
      </button>

      <article className={`tag${e.in_stock ? '' : ' sold-out'}`}>
        <div className="tag-top">
          <div>
            <h1 className="tag-brand">{e.batch.brand}</h1>
            <p className="tag-price">{t('boughtFor', { price: som(e.batch.bought_price, unit) })}</p>
          </div>
          <div className="tag-size">
            <small>{t('size')}</small>
            <b>{e.size}</b>
          </div>
        </div>

        <p className="tag-count">
          {e.in_stock ? <><b>{e.quantity}</b><span>{t('left')}</span></> : <b>{t('soldOut')}</b>}
        </p>

        {e.batch.picture && (
          <div className="tag-photo"><img src={e.batch.picture} alt={e.batch.brand} loading="lazy" /></div>
        )}

        <div className="tag-stub">
          {/* SVG is generated server-side by python-barcode from the entry's own code */}
          <div className="barcode" dangerouslySetInnerHTML={{ __html: e.barcode_svg }} />
          <span className="tag-code">{e.code}</span>
        </div>
      </article>

      <div className="tag-actions">
        {e.in_stock && <Link className="button sell block" to={`/e/${e.code}/sell`}>{t('sellOne')}</Link>}
        <div className="secondary">
          <button type="button" className="button ghost" onClick={downloadLabel} disabled={downloading}>
            {downloading ? t('preparing') : t('downloadLabel')}
          </button>
          <Link className="button ghost" to={`/stock?q=${encodeURIComponent(e.batch.brand)}&stock=all`}>{t('findSimilar')}</Link>
        </div>
      </div>

      <dl className="facts">
        <div><dt>{t('addedOn')}</dt><dd>{date(e.batch.date_added)}</dd></div>
        <div><dt>{t('receivedCount')}</dt><dd>{spaced(e.initial_quantity)}</dd></div>
        <div><dt>{t('soldCount')}</dt><dd>{spaced(e.sold)}</dd></div>
      </dl>

      <section className="section">
        <h2 className="section-title">{t('sales')}</h2>
        {e.recent_sales.length === 0 ? (
          <p className="muted">{t('noSalesYet')}</p>
        ) : (
          <ul className="sales-list">
            {e.recent_sales.map((sale) => (
              <li key={sale.id}>
                <time dateTime={sale.sold_at}>{dateTime(sale.sold_at)}</time>
                <span className="amount">
                  {som(sale.sold_price, unit)}
                  <span className={`profit${sale.profit < 0 ? ' loss' : ''}`}>
                    {t(sale.profit < 0 ? 'loss' : 'profit', { amount: spaced(Math.abs(sale.profit)) })}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  )
}
