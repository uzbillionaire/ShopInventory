import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from './client'
import type { BrandGroup, DailyReport, Page, ReportDay, RestockResult, Sale, SizeEntry, SizeEntryDetail, Stats } from './types'

function query(params: Record<string, string | number | boolean | undefined | null>) {
  const search = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value))
  })
  const text = search.toString()
  return text ? `?${text}` : ''
}

export interface EntryFilters {
  q?: string
  size?: string
  stock?: string
  added_from?: string
  added_to?: string
  ordering?: string
}

/** The stock list, one brand per row; pages hold whole brands so one is never split. */
export function useBrandGroups(filters: EntryFilters) {
  return useInfiniteQuery({
    queryKey: ['entries', 'grouped', filters],
    queryFn: ({ pageParam }) => api<Page<BrandGroup>>(`/entries/grouped/${query({ ...filters, page: pageParam })}`),
    initialPageParam: 1,
    getNextPageParam: (last, pages) => (last.next ? pages.length + 1 : undefined),
    placeholderData: keepPreviousData,
  })
}

/** Sizes down to their last pair, for the home screen. */
export function useLowStock() {
  return useQuery({
    queryKey: ['entries', 'low'],
    queryFn: () => api<Page<SizeEntry>>(`/entries/${query({ stock: 'low', ordering: 'batch__brand' })}`),
  })
}

/** Every in-stock line for the labels screen; one shop's stock is a handful of pages. */
export function useInStockForLabels(onlyUnprinted: boolean) {
  return useQuery({
    queryKey: ['entries', 'labels', onlyUnprinted],
    queryFn: async () => {
      const results: SizeEntry[] = []
      for (let page = 1; ; page += 1) {
        const data = await api<Page<SizeEntry>>(
          `/entries/${query({ stock: 'in', label_printed: onlyUnprinted ? 'false' : undefined, page })}`,
        )
        results.push(...data.results)
        if (!data.next) return results
      }
    },
  })
}

export function useEntry(code: string) {
  return useQuery({
    queryKey: ['entry', code.toUpperCase()],
    queryFn: () => api<SizeEntryDetail>(`/entries/${encodeURIComponent(code)}/`),
    retry: (count, error) => (error as { status?: number }).status !== 404 && count < 2,
  })
}

export function useStats(params: { start?: string; end?: string; slow_days?: number }) {
  return useQuery({
    queryKey: ['stats', params],
    queryFn: () => api<Stats>(`/stats/${query(params)}`),
    placeholderData: keepPreviousData,
  })
}

export function useBrands() {
  return useQuery({ queryKey: ['brands'], queryFn: () => api<string[]>('/batches/brands/'), staleTime: 60_000 })
}

export function useInvalidateStock() {
  const client = useQueryClient()
  return () => {
    client.invalidateQueries({ queryKey: ['entries'] })
    client.invalidateQueries({ queryKey: ['entry'] })
    client.invalidateQueries({ queryKey: ['stats'] })
    client.invalidateQueries({ queryKey: ['brands'] })
  }
}

export function useAddStock() {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (form: FormData) => api<RestockResult>('/batches/', { method: 'POST', body: form }),
    onSuccess: invalidate,
  })
}

export function useSell(code: string) {
  const invalidate = useInvalidateStock()
  return useMutation({
    mutationFn: (soldPrice: number) =>
      api<{ sale: Sale; entry: SizeEntry }>(`/entries/${encodeURIComponent(code)}/sell/`, {
        method: 'POST',
        body: { sold_price: soldPrice },
      }),
    onSuccess: invalidate,
  })
}

export function useDailyReport(date: string) {
  return useQuery({
    queryKey: ['stats', 'daily', date],
    queryFn: () => api<DailyReport>(`/reports/daily/${query({ date })}`),
    placeholderData: keepPreviousData,
  })
}

export function useReportDays(start: string, end: string) {
  return useQuery({
    queryKey: ['stats', 'days', start, end],
    queryFn: () => api<{ start: string; end: string; days: ReportDay[] }>(`/reports/days/${query({ start, end })}`),
    placeholderData: keepPreviousData,
  })
}
