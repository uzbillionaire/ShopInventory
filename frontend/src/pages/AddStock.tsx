import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { Link } from 'react-router'
import { ApiError, download } from '../api/client'
import { useAddStock, useBrands, useInvalidateStock } from '../api/hooks'
import type { RestockResult } from '../api/types'
import { CameraIcon, CloseIcon } from '../components/Icons'
import { ErrorNotice, MoneyInput, SizeChip, useToast } from '../components/ui'
import { useI18n, type MessageKey } from '../i18n'
import { parseMoney, som } from '../lib/format'

interface Row {
  id: number
  size: string
  quantity: string
}

const SIZE_PATTERN = /^\d{1,2}([.,]5)?$/
let nextId = 1
const blankRows = () => [0, 1, 2].map(() => ({ id: nextId++, size: '', quantity: '' }))

export default function AddStock() {
  const { t } = useI18n()
  const brands = useBrands()
  const addStock = useAddStock()
  const [brand, setBrand] = useState('')
  const [price, setPrice] = useState('')
  const [rows, setRows] = useState<Row[]>(blankRows)
  const [photo, setPhoto] = useState<File | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, MessageKey>>({})
  const [result, setResult] = useState<RestockResult | null>(null)
  const rowsRef = useRef<HTMLDivElement>(null)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function choosePhoto(file: File | null) {
    setPhoto(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  function setRow(id: number, changes: Partial<Row>) {
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...changes } : row)))
  }

  function addRow() {
    setRows((current) => [...current, { id: nextId++, size: '', quantity: '' }])
    requestAnimationFrame(() => {
      const inputs = rowsRef.current?.querySelectorAll<HTMLInputElement>('.size-row:last-child input')
      inputs?.[0]?.focus()
    })
  }

  function removeRow(id: number) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.id !== id) : [{ id: nextId++, size: '', quantity: '' }]))
  }

  // Enter moves to the next box instead of submitting half-typed stock.
  function onRowKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== 'Enter' || !(event.target instanceof HTMLInputElement)) return
    event.preventDefault()
    const inputs = [...(rowsRef.current?.querySelectorAll('input') ?? [])]
    const next = inputs[inputs.indexOf(event.target) + 1]
    if (next) next.focus()
    else addRow()
  }

  function validate() {
    const found: Record<string, MessageKey> = {}
    if (!brand.trim()) found.brand = 'enterBrand'
    if (!parseMoney(price)) found.price = 'enterPrice'
    let filled = 0
    rows.forEach((row) => {
      const size = row.size.trim()
      const quantity = Number(row.quantity)
      if (!size && !row.quantity) return
      filled += 1
      if (!size) found[`size-${row.id}`] = 'whichSize'
      else if (!SIZE_PATTERN.test(size)) found[`size-${row.id}`] = 'sizeFormat'
      if (!row.quantity || !Number.isInteger(quantity) || quantity < 1) found[`qty-${row.id}`] = 'howManyPairs'
    })
    if (!filled) found.sizes = 'needSizes'
    setErrors(found)
    return Object.keys(found).length === 0
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!validate()) return
    const form = new FormData()
    form.set('brand', brand.trim())
    form.set('bought_price', String(parseMoney(price)))
    form.set('sizes', JSON.stringify(
      rows.filter((row) => row.size.trim()).map((row) => ({ size: row.size.trim(), quantity: Number(row.quantity) })),
    ))
    if (photo) form.set('picture', photo)
    addStock.mutate(form, {
      onSuccess: (data) => {
        setResult(data)
        window.scrollTo({ top: 0 })
      },
    })
  }

  function reset() {
    setResult(null)
    setBrand('')
    setPrice('')
    setRows(blankRows())
    setPhoto(null)
    setPreview(null)
    addStock.reset()
  }

  if (result) return <Added result={result} onAddMore={reset} />

  const serverError = addStock.error instanceof ApiError ? addStock.error : null

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('addStock')}</h1>
          <p className="page-sub">{t('addSubtitle')}</p>
        </div>
      </div>

      <form onSubmit={submit} noValidate>
        {addStock.isError && <ErrorNotice error={addStock.error} />}

        <div className="field">
          <label className="field-label" htmlFor="brand">{t('brand')}</label>
          <input id="brand" className="input" list="brand-options" autoComplete="off" autoCapitalize="words" maxLength={120}
            value={brand} onChange={(e) => setBrand(e.target.value)} aria-invalid={Boolean(errors.brand || serverError?.field('brand'))} />
          <datalist id="brand-options">{brands.data?.map((name) => <option key={name} value={name} />)}</datalist>
          {errors.brand && <span className="field-error">{t(errors.brand)}</span>}
        </div>

        <div className="field">
          <label className="field-label" htmlFor="price">{t('boughtPrice')}</label>
          <MoneyInput id="price" placeholder="250 000" value={price} onValueChange={setPrice} aria-invalid={Boolean(errors.price)} />
          <span className="hint">{t('priceHint')}</span>
          {errors.price && <span className="field-error">{t(errors.price)}</span>}
        </div>

        <fieldset className="sizes-fieldset">
          <legend className="field-label">{t('sizes')}</legend>
          {errors.sizes && <p className="notice error">{t(errors.sizes)}</p>}
          <div className="size-grid-head" aria-hidden="true"><span>{t('size')}</span><span>{t('pairsColumn')}</span><span /></div>
          <div className="size-rows" ref={rowsRef} onKeyDown={onRowKeyDown}>
            {rows.map((row, index) => (
              <div className="size-row" key={row.id}>
                <input className="input" inputMode="decimal" autoComplete="off" placeholder={String(40 + index)}
                  aria-label={`${t('size')} ${index + 1}`} value={row.size}
                  aria-invalid={Boolean(errors[`size-${row.id}`])} onChange={(e) => setRow(row.id, { size: e.target.value })} />
                <input className="input" type="number" inputMode="numeric" min={1}
                  aria-label={`${t('pairsColumn')} ${index + 1}`} value={row.quantity}
                  aria-invalid={Boolean(errors[`qty-${row.id}`])} onChange={(e) => setRow(row.id, { quantity: e.target.value })} />
                <button type="button" className="icon-button" title={t('removeSize')} onClick={() => removeRow(row.id)}>
                  <CloseIcon size={20} /><span className="visually-hidden">{t('removeSize')}</span>
                </button>
                {(errors[`size-${row.id}`] || errors[`qty-${row.id}`]) && (
                  <span className="field-error">{t((errors[`size-${row.id}`] ?? errors[`qty-${row.id}`])!)}</span>
                )}
              </div>
            ))}
          </div>
          <button type="button" className="button small ghost add-size" onClick={addRow}>{t('addSize')}</button>
        </fieldset>

        <div className="field">
          <span className="field-label">{t('photo')} <span className="hint">({t('optional')})</span></span>
          <div className="photo-input">
            {preview ? <img className="photo-preview" src={preview} alt="" /> : <span className="photo-preview"><CameraIcon size={26} /></span>}
            <span className="photo-text">
              <strong>{photo ? photo.name : t('photoHint')}</strong>
              {photo && (
                <button type="button" className="link-button" onClick={() => choosePhoto(null)}>{t('removePhoto')}</button>
              )}
            </span>
          </div>
          <div className="photo-actions">
            {/* capture="environment" opens the back camera on phones; the second input opens the gallery. */}
            <label className="button small">
              <CameraIcon size={18} />{photo ? t('retakePhoto') : t('takePhoto')}
              <input type="file" accept="image/*" capture="environment" className="visually-hidden"
                onChange={(e) => { choosePhoto(e.target.files?.[0] ?? null); e.target.value = '' }} />
            </label>
            <label className="button small ghost">
              {t('choosePhoto')}
              <input type="file" accept="image/*" className="visually-hidden"
                onChange={(e) => { choosePhoto(e.target.files?.[0] ?? null); e.target.value = '' }} />
            </label>
          </div>
        </div>

        <div className="form-footer">
          <button className="button block" type="submit" disabled={addStock.isPending}>
            {addStock.isPending ? t('saving') : t('saveStock')}
          </button>
        </div>
      </form>
    </>
  )
}

function Added({ result, onAddMore }: { result: RestockResult; onAddMore: () => void }) {
  const { t, pairs } = useI18n()
  const toast = useToast()
  const invalidate = useInvalidateStock()
  const [printing, setPrinting] = useState(false)
  const total = result.lines.reduce((sum, line) => sum + line.added, 0)
  const first = result.lines[0].entry

  async function printLabels() {
    setPrinting(true)
    try {
      await download('/labels/pdf/', {
        method: 'POST',
        body: { items: result.lines.map((line) => ({ code: line.entry.code, copies: line.added })) },
      })
      invalidate()
    } catch {
      toast({ message: t('networkError') })
    } finally {
      setPrinting(false)
    }
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('addedTitle')}</h1>
          <p className="page-sub">{first.batch.brand}, {som(first.batch.bought_price, t('som'))}: {pairs(total)}</p>
        </div>
      </div>

      <ul className="stock-list">
        {result.lines.map((line) => (
          <li className="stock-row" key={line.entry.code}>
            <Link to={`/e/${line.entry.code}`}>
              <SizeChip size={line.entry.size} />
              <span>
                <span className="stock-brand">{line.merged ? t('toppedUp') : t('newCode')}</span>
                <span className="stock-meta">{line.entry.code}</span>
              </span>
              <span className="stock-qty"><strong>+{line.added}</strong><span>{line.entry.quantity} {t('left')}</span></span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="tag-actions">
        <button type="button" className="button block" onClick={printLabels} disabled={printing}>
          {printing ? t('preparing') : t('printLabelsCount', { n: total })}
        </button>
        <div className="secondary">
          <button type="button" className="button ghost" onClick={onAddMore}>{t('addMoreStock')}</button>
          <Link className="button ghost" to="/">{t('navStock')}</Link>
        </div>
      </div>
    </>
  )
}
