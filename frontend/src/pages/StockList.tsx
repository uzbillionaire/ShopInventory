import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { useBrandGroups, useStats } from '../api/hooks'
import type { BrandGroup } from '../api/types'
import { ChevronIcon, FilterIcon } from '../components/Icons'
import { ErrorNotice, Loading, SizeChip } from '../components/ui'
import { useI18n, type MessageKey } from '../i18n'
import { date, som, spaced } from '../lib/format'

const STOCK: [string, MessageKey][] = [['in', 'inStock'], ['low', 'runningLow'], ['out', 'soldOut'], ['all', 'all']]
const ORDERING: [string, MessageKey][] = [
  ['-batch__date_added', 'newestFirst'],
  ['batch__date_added', 'oldestFirst'],
  ['-quantity', 'mostPairs'],
  ['quantity', 'fewestPairs'],
  ['-batch__bought_price', 'highestPrice'],
  ['batch__bought_price', 'lowestPrice'],
]

export default function StockList() {
  const { t } = useI18n()
  const [params, setParams] = useSearchParams()
  const stock = params.get('stock') ?? 'in'
  const q = params.get('q') ?? ''
  const size = params.get('size') ?? ''
  const addedFrom = params.get('added_from') ?? ''
  const addedTo = params.get('added_to') ?? ''
  const ordering = params.get('ordering') ?? ''
  const hasFilters = Boolean(size || addedFrom || addedTo || ordering)

  const [search, setSearch] = useState(q)
  const [showFilters, setShowFilters] = useState(hasFilters)

  // Debounce typing into the URL so the list follows without a submit button.
  useEffect(() => {
    const timer = setTimeout(() => update({ q: search.trim() }), 300)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search])

  function update(changes: Record<string, string>) {
    setParams((current) => {
      const next = new URLSearchParams(current)
      Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)))
      return next
    }, { replace: true })
  }

  const entries = useBrandGroups({ q, size, stock, added_from: addedFrom, added_to: addedTo, ordering: ordering || undefined })
  const summary = useStats({})
  const rows = entries.data?.pages.flatMap((page) => page.results) ?? []
  const [open, setOpen] = useState<Set<string>>(new Set())

  function toggle(brand: string) {
    setOpen((current) => {
      const next = new Set(current)
      if (next.has(brand)) next.delete(brand)
      else next.add(brand)
      return next
    })
  }
  const filtered = Boolean(q) || hasFilters || stock !== 'in'

  return (
    <>
      <div className="page-head">
        <h1 className="page-title">{t('navStock')}</h1>
        <Link className="button small" to="/add">{t('addStock')}</Link>
      </div>

      {summary.data && (
        <dl className="stock-summary">
          <div><dt>{t('pairsOnShelf')}</dt><dd>{spaced(summary.data.inventory.pairs)}</dd></div>
          <div><dt>{t('worthAtCost')}</dt><dd>{som(summary.data.inventory.value, t('som'))}</dd></div>
        </dl>
      )}

      <div role="search">
        <div className="search">
          <label className="visually-hidden" htmlFor="q">{t('searchPlaceholder')}</label>
          <input id="q" type="search" className="input" placeholder={t('searchPlaceholder')} value={search}
            onChange={(e) => setSearch(e.target.value)} autoComplete="off" enterKeyHint="search" />
          <button type="button" className="filter-toggle" aria-expanded={showFilters} aria-controls="filters"
            title={t('filters')} onClick={() => setShowFilters((open) => !open)}>
            <FilterIcon size={22} />
            <span className="visually-hidden">{t('filters')}</span>
            {hasFilters && <span className="dot" />}
          </button>
        </div>

        {showFilters && (
          <div className="filters" id="filters">
            <div className="field">
              <label className="field-label" htmlFor="size">{t('size')}</label>
              <input id="size" className="input" inputMode="decimal" placeholder="41" value={size}
                onChange={(e) => update({ size: e.target.value.trim() })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="ordering">{t('sort')}</label>
              <select id="ordering" className="input" value={ordering || '-batch__date_added'}
                onChange={(e) => update({ ordering: e.target.value === '-batch__date_added' ? '' : e.target.value })}>
                {ORDERING.map(([value, key]) => <option key={value} value={value}>{t(key)}</option>)}
              </select>
            </div>
            <div className="field">
              <label className="field-label" htmlFor="added_from">{t('addedFrom')}</label>
              <input id="added_from" type="date" className="input" value={addedFrom} onChange={(e) => update({ added_from: e.target.value })} />
            </div>
            <div className="field">
              <label className="field-label" htmlFor="added_to">{t('addedTo')}</label>
              <input id="added_to" type="date" className="input" value={addedTo} onChange={(e) => update({ added_to: e.target.value })} />
            </div>
            {hasFilters && (
              <div className="full">
                <button type="button" className="button small ghost"
                  onClick={() => update({ size: '', added_from: '', added_to: '', ordering: '' })}>
                  {t('clearFilters')}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="segmented" role="group" aria-label={t('navStock')}>
        {STOCK.map(([value, key]) => (
          <button key={value} type="button" aria-pressed={stock === value} onClick={() => update({ stock: value === 'in' ? '' : value })}>
            {t(key)}
          </button>
        ))}
      </div>

      {entries.isPending ? (
        <Loading />
      ) : entries.isError ? (
        <ErrorNotice error={entries.error} onRetry={() => entries.refetch()} />
      ) : rows.length === 0 ? (
        filtered ? (
          <div className="empty">
            <h2>{t('nothingMatches')}</h2>
            <p>{t('nothingMatchesHint')}</p>
            <button type="button" className="button ghost" onClick={() => { setSearch(''); setParams({}, { replace: true }) }}>
              {t('clearFilters')}
            </button>
          </div>
        ) : (
          <div className="empty">
            <h2>{t('emptyTitle')}</h2>
            <p>{t('emptyHint')}</p>
            <Link className="button" to="/add">{t('addStock')}</Link>
          </div>
        )
      ) : (
        <>
          <ul className="stock-list">
            {rows.map((group, i) => (
              // A single result (a scanned code, one brand searched) opens by itself.
              <BrandRow key={group.brand} id={`brand-${i}`} group={group} open={rows.length === 1 || open.has(group.brand)}
                onToggle={() => toggle(group.brand)} />
            ))}
          </ul>
          {entries.hasNextPage && (
            <div className="more">
              <button type="button" className="button ghost" disabled={entries.isFetchingNextPage} onClick={() => entries.fetchNextPage()}>
                {entries.isFetchingNextPage ? t('loading') : t('showMore')}
              </button>
            </div>
          )}
        </>
      )}
    </>
  )
}

function BrandRow({ id, group, open, onToggle }: { id: string; group: BrandGroup; open: boolean; onToggle: () => void }) {
  const { t } = useI18n()
  const price = group.min_price === group.max_price
    ? som(group.min_price, t('som'))
    : `${spaced(group.min_price)} – ${som(group.max_price, t('som'))}`
  // Price and date per size only matter when the sizes came in different deliveries.
  const mixed = group.deliveries > 1

  return (
    <li className={`stock-row brand-row${group.pairs === 0 ? ' sold-out' : ''}${open ? ' open' : ''}`}>
      <button type="button" className="brand-toggle" aria-expanded={open} aria-controls={id} onClick={onToggle}>
        <span>
          <span className="stock-brand">{group.brand}</span>
          <span className="stock-meta">
            {t('sizesCount', { n: group.entries.length })} · {price}, {date(group.last_added)}
          </span>
        </span>
        <span className="stock-qty">
          {group.pairs > 0 ? (
            <><strong>{group.pairs}</strong><span>{t('left')}</span></>
          ) : (
            <strong>{t('soldOut')}</strong>
          )}
        </span>
        <ChevronIcon size={20} className="brand-chevron" />
      </button>

      {open && (
        <ul className="size-list" id={id}>
          {group.entries.map((entry) => (
            <li key={entry.code} className={`stock-row${entry.in_stock ? (entry.quantity <= 1 ? ' low' : '') : ' sold-out'}`}>
              <Link to={`/e/${entry.code}`}>
                <SizeChip size={entry.size} />
                <span className="stock-meta">
                  {mixed && <>{som(entry.batch.bought_price, t('som'))}, {date(entry.batch.date_added)}</>}
                </span>
                <span className="stock-qty">
                  {entry.in_stock ? (
                    <><strong>{entry.quantity}</strong><span>{t('left')}</span></>
                  ) : (
                    <strong>{t('soldOut')}</strong>
                  )}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </li>
  )
}
