import type { ReactNode } from 'react'
import type { Payment } from '../api/types'
import { useI18n } from '../i18n'
import { som } from '../lib/format'

/** A titled block of figures, so sales, payments and stock read as separate topics. */
export function SummaryGroup({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="summary-group">
      <h2 className="summary-label">{title}</h2>
      {children}
    </section>
  )
}

/** Cash and card as one bar (they add up to the revenue), then the cash to count at closing. */
export function PaymentSplit({ cash, card }: Record<Payment, number>) {
  const { t } = useI18n()
  const unit = t('som')
  const total = cash + card
  // Card takes the remainder so the two percentages always add up to exactly 100.
  const cashShare = total ? Math.round((cash / total) * 100) : 0
  const rows: [Payment, number, number][] = [['cash', cash, cashShare], ['card', card, total ? 100 - cashShare : 0]]

  return (
    <>
      <div className="pay-bar" role="img" aria-label={rows.map(([key, , share]) => `${t(key)} ${share}%`).join(', ')}>
        {rows.map(([key, amount]) => amount > 0 && <i key={key} className={key} style={{ width: `${(amount / total) * 100}%` }} />)}
      </div>
      <ul className="pay-legend">
        {rows.map(([key, amount, share]) => (
          <li key={key}>
            <span className={`pay-dot ${key}`} aria-hidden="true" />
            <span>{t(key)}</span>
            <strong>{som(amount, unit)}</strong>
            <span className="pay-share">{total ? `${share}%` : ''}</span>
          </li>
        ))}
      </ul>
      <dl className="cash-box">
        <dt>{t('cashToCount')}</dt>
        <dd>{som(cash, unit)}</dd>
      </dl>
    </>
  )
}
