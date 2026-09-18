import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { download } from '../api/client'
import { useInStockForLabels, useInvalidateStock } from '../api/hooks'
import { ErrorNotice, Loading, SizeChip, useToast } from '../components/ui'
import { useI18n } from '../i18n'
import { date } from '../lib/format'

export default function Labels() {
  const { t } = useI18n()
  const toast = useToast()
  const invalidate = useInvalidateStock()
  const [onlyUnprinted, setOnlyUnprinted] = useState(true)
  const entries = useInStockForLabels(onlyUnprinted)
  const [unchecked, setUnchecked] = useState<Set<string>>(new Set())
  const [copies, setCopies] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const rows = useMemo(() => entries.data ?? [], [entries.data])
  const copiesFor = (code: string, quantity: number) => copies[code] ?? String(quantity)
  const selected = rows.filter((entry) => !unchecked.has(entry.code))
  const total = selected.reduce((sum, entry) => sum + Math.max(0, Number(copiesFor(entry.code, entry.quantity)) || 0), 0)

  function toggle(code: string) {
    setUnchecked((current) => {
      const next = new Set(current)
      if (next.has(code)) next.delete(code)
      else next.add(code)
      return next
    })
  }

  async function print() {
    setBusy(true)
    try {
      const items = selected
        .map((entry) => ({ code: entry.code, copies: Math.min(500, Number(copiesFor(entry.code, entry.quantity)) || 0) }))
        .filter((item) => item.copies > 0)
      await download('/labels/pdf/', { method: 'POST', body: { items } })
      invalidate()
    } catch {
      toast({ message: t('networkError') })
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('navLabels')}</h1>
          <p className="page-sub">{t('labelsIntro')}</p>
        </div>
      </div>

      <div className="segmented" role="group" aria-label={t('navLabels')}>
        <button type="button" aria-pressed={onlyUnprinted} onClick={() => setOnlyUnprinted(true)}>{t('notPrinted')}</button>
        <button type="button" aria-pressed={!onlyUnprinted} onClick={() => setOnlyUnprinted(false)}>{t('allInStock')}</button>
      </div>

      {entries.isPending ? (
        <Loading />
      ) : entries.isError ? (
        <ErrorNotice error={entries.error} onRetry={() => entries.refetch()} />
      ) : rows.length === 0 ? (
        <div className="empty">
          <h2>{t('allPrinted')}</h2>
          <p>{t('allPrintedHint')}</p>
          <Link className="button" to="/add">{t('addStock')}</Link>
        </div>
      ) : (
        <>
          <label className="select-all">
            <input type="checkbox" checked={selected.length === rows.length}
              ref={(input) => { if (input) input.indeterminate = selected.length > 0 && selected.length < rows.length }}
              onChange={(e) => setUnchecked(e.target.checked ? new Set() : new Set(rows.map((entry) => entry.code)))} />
            {t('selectAll')}
          </label>
          <ul className="label-list">
            {rows.map((entry) => (
              <li className="label-row" key={entry.code}>
                <input type="checkbox" aria-label={`${entry.batch.brand} ${entry.size}`}
                  checked={!unchecked.has(entry.code)} onChange={() => toggle(entry.code)} />
                <SizeChip size={entry.size} />
                <span>
                  <span className="stock-brand">{entry.batch.brand}</span>
                  <span className="stock-meta">{entry.code}, {date(entry.batch.date_added)}</span>
                </span>
                <label>
                  <input className="input" type="number" inputMode="numeric" min={0} max={500}
                    value={copiesFor(entry.code, entry.quantity)} disabled={unchecked.has(entry.code)}
                    onChange={(e) => setCopies((current) => ({ ...current, [entry.code]: e.target.value }))} />
                  <span className="copies-label">{t('copies')}</span>
                </label>
              </li>
            ))}
          </ul>
          <div className="form-footer">
            <button type="button" className="button block" disabled={busy || total === 0} onClick={print}>
              {busy ? t('preparing') : t('makeLabels', { n: total })}
            </button>
          </div>
        </>
      )}
    </>
  )
}
