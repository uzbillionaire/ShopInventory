import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams } from 'react-router'
import { ApiError } from '../api/client'
import { useBrands, useDeleteEntry, useEditEntry, useEntry } from '../api/hooks'
import type { SizeEntryDetail } from '../api/types'
import { BackIcon, CameraIcon } from '../components/Icons'
import { ErrorNotice, Loading, MoneyInput, useToast } from '../components/ui'
import { useI18n, type MessageKey } from '../i18n'
import { MAX_PRICE, parseMoney, spaced } from '../lib/format'

const SIZE_PATTERN = /^\d{1,2}([.,]5)?$/
const MAX_PAIRS = 9999

export default function EditEntry() {
  const { code = '' } = useParams()
  const entry = useEntry(code)

  if (entry.isPending) return <Loading />
  if (entry.isError) return <ErrorNotice error={entry.error} onRetry={() => entry.refetch()} />
  return <EditForm key={entry.data.code} entry={entry.data} />
}

function EditForm({ entry: e }: { entry: SizeEntryDetail }) {
  const { t } = useI18n()
  const navigate = useNavigate()
  const toast = useToast()
  const brands = useBrands()
  const edit = useEditEntry(e.code)
  const remove = useDeleteEntry(e.code)

  const [brand, setBrand] = useState(e.batch.brand)
  const [price, setPrice] = useState(spaced(e.batch.bought_price))
  const [size, setSize] = useState(e.size)
  const [quantity, setQuantity] = useState(String(e.quantity))
  // undefined: keep the current photo; null: remove it; File: replace it.
  const [photo, setPhoto] = useState<File | null | undefined>(undefined)
  const [preview, setPreview] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, MessageKey>>({})
  const [confirming, setConfirming] = useState(false)

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview) }, [preview])

  function choosePhoto(file: File | null) {
    setPhoto(file)
    setPreview(file ? URL.createObjectURL(file) : null)
  }

  const shownPhoto = photo === undefined ? e.batch.picture : preview
  const serverError = edit.error instanceof ApiError ? edit.error : null
  // The only size check the phone can't do itself: another line of this delivery already has it.
  const sizeTaken = serverError?.status === 400 && Boolean(serverError.field('size'))

  function validate() {
    const found: Record<string, MessageKey> = {}
    const amount = parseMoney(price)
    const pairs = Number(quantity)
    if (!brand.trim()) found.brand = 'enterBrand'
    if (!amount) found.price = 'enterPrice'
    else if (amount > MAX_PRICE) found.price = 'priceTooHigh'
    if (!size.trim()) found.size = 'whichSize'
    else if (!SIZE_PATTERN.test(size.trim())) found.size = 'sizeFormat'
    if (quantity === '' || !Number.isInteger(pairs) || pairs < 0 || pairs > MAX_PAIRS) found.quantity = 'howManyPairs'
    setErrors(found)
    return Object.keys(found).length === 0
  }

  function submit(event: FormEvent) {
    event.preventDefault()
    if (!validate()) return
    // Only what changed, so an untouched count can't overwrite a sale made meanwhile.
    const form = new FormData()
    if (brand.trim() !== e.batch.brand) form.set('brand', brand.trim())
    if (parseMoney(price) !== e.batch.bought_price) form.set('bought_price', String(parseMoney(price)))
    if (size.trim().replace(',', '.') !== e.size) form.set('size', size.trim())
    if (Number(quantity) !== e.quantity) form.set('quantity', quantity)
    if (photo !== undefined) form.set('picture', photo ?? '')

    const done = () => {
      navigate(`/e/${e.code}`, { replace: true })
      toast({ message: t('savedToast') })
    }
    if ([...form.keys()].length === 0) return done()
    edit.mutate(form, { onSuccess: done })
  }

  function deleteProduct() {
    remove.mutate(undefined, {
      onSuccess: () => {
        navigate('/stock', { replace: true })
        toast({ message: t('deletedToast') })
      },
    })
  }

  return (
    <>
      <button type="button" className="back" onClick={() => navigate(-1)}><BackIcon size={20} />{t('back')}</button>
      <div className="page-head">
        <div>
          <h1 className="page-title">{t('editTitle')}</h1>
          <p className="page-sub">{e.code}</p>
        </div>
      </div>

      <form onSubmit={submit} noValidate>
        {edit.isError && !sizeTaken && <ErrorNotice error={edit.error} />}

        <div className="edit-row">
          <div className="field">
            <label className="field-label" htmlFor="size">{t('size')}</label>
            <input id="size" className="input" inputMode="decimal" autoComplete="off" value={size}
              onChange={(ev) => setSize(ev.target.value)} aria-invalid={Boolean(errors.size || sizeTaken)} />
            {errors.size && <span className="field-error">{t(errors.size)}</span>}
            {!errors.size && sizeTaken && <span className="field-error">{t('sizeTaken')}</span>}
          </div>
          <div className="field">
            <label className="field-label" htmlFor="quantity">{t('pairsLeft')}</label>
            <input id="quantity" className="input" type="number" inputMode="numeric" min={0} max={MAX_PAIRS} value={quantity}
              onChange={(ev) => setQuantity(ev.target.value)} aria-invalid={Boolean(errors.quantity)} />
            {errors.quantity && <span className="field-error">{t(errors.quantity)}</span>}
          </div>
        </div>
        <p className="hint edit-hint">{t('pairsLeftHint')}</p>

        <fieldset className="delivery-fieldset">
          {e.delivery_sizes > 1 && <p className="notice">{t('deliveryShared', { n: e.delivery_sizes })}</p>}

          <div className="field">
            <label className="field-label" htmlFor="brand">{t('brand')}</label>
            <input id="brand" className="input" list="brand-options" autoComplete="off" autoCapitalize="words" maxLength={120}
              value={brand} onChange={(ev) => setBrand(ev.target.value)} aria-invalid={Boolean(errors.brand || serverError?.field('brand'))} />
            <datalist id="brand-options">{brands.data?.map((name) => <option key={name} value={name} />)}</datalist>
            {errors.brand && <span className="field-error">{t(errors.brand)}</span>}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="price">{t('boughtPrice')}</label>
            <MoneyInput id="price" value={price} onValueChange={setPrice} aria-invalid={Boolean(errors.price)} />
            {e.sold > 0 && <span className="hint">{t('priceFixHint')}</span>}
            {errors.price && <span className="field-error">{t(errors.price)}</span>}
          </div>

          <div className="field">
            <span className="field-label">{t('photo')} <span className="hint">({t('optional')})</span></span>
            <div className="photo-input">
              {shownPhoto ? <img className="photo-preview" src={shownPhoto} alt="" /> : <span className="photo-preview"><CameraIcon size={26} /></span>}
              <span className="photo-text">
                <strong>{photo ? photo.name : t('photoHint')}</strong>
                {shownPhoto && (
                  <button type="button" className="link-button" onClick={() => choosePhoto(null)}>{t('removePhoto')}</button>
                )}
              </span>
            </div>
            <div className="photo-actions">
              <label className="button small">
                <CameraIcon size={18} />{shownPhoto ? t('retakePhoto') : t('takePhoto')}
                <input type="file" accept="image/*" capture="environment" className="visually-hidden"
                  onChange={(ev) => { choosePhoto(ev.target.files?.[0] ?? null); ev.target.value = '' }} />
              </label>
              <label className="button small ghost">
                {t('choosePhoto')}
                <input type="file" accept="image/*" className="visually-hidden"
                  onChange={(ev) => { choosePhoto(ev.target.files?.[0] ?? null); ev.target.value = '' }} />
              </label>
            </div>
          </div>
        </fieldset>

        <p className="hint">{t('relabelHint')}</p>

        <div className="form-footer">
          <button className="button block" type="submit" disabled={edit.isPending || remove.isPending}>
            {edit.isPending ? t('saving') : t('saveChanges')}
          </button>
        </div>
      </form>

      <section className="section danger-zone">
        {e.sold > 0 ? (
          <p className="muted">{t('cantDeleteSold')}</p>
        ) : confirming ? (
          <div role="alertdialog" aria-labelledby="delete-question">
            <p id="delete-question">{t('deleteConfirm', { brand: e.batch.brand, size: e.size })}</p>
            {remove.isError && <ErrorNotice error={remove.error} />}
            <div className="secondary">
              <button type="button" className="button ghost" onClick={() => setConfirming(false)} disabled={remove.isPending}>
                {t('cancel')}
              </button>
              <button type="button" className="button danger" onClick={deleteProduct} disabled={remove.isPending} autoFocus>
                {remove.isPending ? t('deleting') : t('deleteYes')}
              </button>
            </div>
          </div>
        ) : (
          <button type="button" className="button ghost danger-outline block" onClick={() => setConfirming(true)}>
            {t('deleteProduct')}
          </button>
        )}
      </section>
    </>
  )
}
