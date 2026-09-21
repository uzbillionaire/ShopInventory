import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router'
import { useEntry, useSell } from '../api/hooks'
import type { Payment } from '../api/types'
import { BackIcon } from '../components/Icons'
import { ErrorNotice, Loading, MoneyInput, SizeChip, useToast } from '../components/ui'
import { useI18n, type MessageKey } from '../i18n'
import { MAX_PRICE, parseMoney, som, spaced } from '../lib/format'

const PAYMENTS: [Payment, MessageKey][] = [['cash', 'cash'], ['card', 'card']]

export default function Sell() {
  const { code = '' } = useParams()
  const { t } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const entry = useEntry(code)
  const sell = useSell(code)
  const [price, setPrice] = useState('')
  const [missing, setMissing] = useState(false)
  const [payment, setPayment] = useState<Payment>('cash')

  if (entry.isPending) return <Loading />
  if (entry.isError) return <ErrorNotice error={entry.error} onRetry={() => entry.refetch()} />
  const e = entry.data
  if (!e.in_stock && !sell.isPending) return <Navigate to={`/e/${e.code}`} replace />

  const unit = t('som')
  const amount = parseMoney(price)
  const margin = amount === null ? null : amount - e.batch.bought_price
  const tooHigh = amount !== null && amount > MAX_PRICE

  function submit(event: FormEvent) {
    event.preventDefault()
    if (amount === null) {
      setMissing(true)
      return
    }
    if (tooHigh) return
    sell.mutate({ soldPrice: amount, payment }, {
      onSuccess: ({ entry: updated }) => {
        navigate(`/e/${e.code}`, { replace: true })
        toast({ message: t('soldToast', { size: updated.size, left: updated.quantity }) })
      },
    })
  }

  const suggestions = [...new Set([e.last_brand_price, e.batch.bought_price].filter((p): p is number => p !== null))]

  return (
    <>
      <button type="button" className="back" onClick={() => navigate(-1)}><BackIcon size={20} />{t('back')}</button>
      <div className="page-head"><h1 className="page-title">{t('sellTitle')}</h1></div>

      <div className="sell-for">
        <SizeChip size={e.size} />
        <div>
          <strong>{e.batch.brand}</strong>
          <p>{t('boughtFor', { price: som(e.batch.bought_price, unit) })}, {e.quantity} {t('left')}</p>
        </div>
      </div>

      <form onSubmit={submit} noValidate>
        {sell.isError && <ErrorNotice error={sell.error} />}
        <div className="field sell-price">
          <label className="field-label" htmlFor="sold_price">{t('soldFor')}</label>
          <MoneyInput id="sold_price" value={price} autoFocus aria-invalid={missing}
            onValueChange={(value) => { setPrice(value); setMissing(false) }} />
          {missing && <span className="field-error">{t('enterSoldPrice')}</span>}
          {tooHigh && <span className="field-error">{t('priceTooHigh')}</span>}
          <div className="quick-prices">
            {suggestions.map((value) => (
              <button type="button" key={value} onClick={() => { setPrice(spaced(value)); setMissing(false) }}>
                {value === e.last_brand_price ? t('lastSoldFor') : t('cost')}: {som(value, unit)}
              </button>
            ))}
          </div>
          <p className={`margin-preview${margin === null ? '' : margin >= 0 ? ' gain' : ' loss'}`} aria-live="polite">
            {margin !== null && t(margin >= 0 ? 'profit' : 'loss', { amount: `${spaced(Math.abs(margin))} ${unit}` })}
          </p>
        </div>
        <div className="field">
          <span className="field-label" id="payment-label">{t('paymentType')}</span>
          <div className="segmented payment-choice" role="group" aria-labelledby="payment-label">
            {PAYMENTS.map(([value, key]) => (
              <button key={value} type="button" aria-pressed={payment === value} onClick={() => setPayment(value)}>{t(key)}</button>
            ))}
          </div>
        </div>
        <button type="submit" className="button sell block" disabled={sell.isPending}>
          {sell.isPending ? t('saving') : t('saveSale')}
        </button>
      </form>
    </>
  )
}
