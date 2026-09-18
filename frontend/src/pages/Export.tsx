import { useState } from 'react'
import { useNavigate } from 'react-router'
import { download } from '../api/client'
import { BackIcon } from '../components/Icons'
import { useToast } from '../components/ui'
import { useI18n } from '../i18n'
import { daysAgo, isoDay } from '../lib/format'

export default function Export() {
  const { t } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const today = isoDay(new Date())
  const [start, setStart] = useState(daysAgo(364))
  const [end, setEnd] = useState(today)
  const [busy, setBusy] = useState<string | null>(null)

  async function get(path: string) {
    setBusy(path)
    try {
      await download(path)
    } catch {
      toast({ message: t('networkError') })
    } finally {
      setBusy(null)
    }
  }

  const salesQuery = `?start=${start}&end=${end}`

  return (
    <>
      <button type="button" className="back" onClick={() => navigate('/stats')}><BackIcon size={20} />{t('statsTitle')}</button>
      <div className="page-head"><h1 className="page-title">{t('exportTitle')}</h1></div>

      <section className="export-block">
        <h2>{t('exportInventory')}</h2>
        <p>{t('exportInventoryHint')}</p>
        <div className="export-actions">
          {(['xlsx', 'csv'] as const).map((fmt) => (
            <button key={fmt} type="button" className={`button${fmt === 'csv' ? ' ghost' : ''}`} disabled={busy !== null}
              onClick={() => get(`/export/inventory.${fmt}`)}>
              {busy === `/export/inventory.${fmt}` ? t('preparing') : fmt === 'xlsx' ? 'Excel' : 'CSV'}
            </button>
          ))}
        </div>
      </section>

      <section className="export-block">
        <h2>{t('exportSales')}</h2>
        <p>{t('exportSalesHint')}</p>
        <div className="range-form">
          <div className="field">
            <label className="field-label" htmlFor="export-start">{t('from')}</label>
            <input id="export-start" type="date" className="input" value={start} max={end} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="export-end">{t('to')}</label>
            <input id="export-end" type="date" className="input" value={end} min={start} max={today} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>
        <div className="export-actions">
          {(['xlsx', 'csv'] as const).map((fmt) => (
            <button key={fmt} type="button" className={`button${fmt === 'csv' ? ' ghost' : ''}`} disabled={busy !== null || !start || !end}
              onClick={() => get(`/export/sales.${fmt}${salesQuery}`)}>
              {busy === `/export/sales.${fmt}${salesQuery}` ? t('preparing') : fmt === 'xlsx' ? 'Excel' : 'CSV'}
            </button>
          ))}
        </div>
      </section>
    </>
  )
}
