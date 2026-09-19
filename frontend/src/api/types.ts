// Mirrors inventory/serializers.py

export interface Batch {
  id: number
  brand: string
  bought_price: number
  picture: string | null
  date_added: string
}

export interface SizeEntry {
  code: string
  size: string
  quantity: number
  initial_quantity: number
  sold: number
  in_stock: boolean
  label_printed: boolean
  batch: Batch
}

/** One brand on the stock list, with its matching size lines. */
export interface BrandGroup {
  brand: string
  pairs: number
  min_price: number
  max_price: number
  last_added: string
  deliveries: number
  entries: SizeEntry[]
}

export type Payment = 'cash' | 'card'

export interface Sale {
  id: number
  code: string
  brand: string
  size: string
  bought_price: number
  sold_price: number
  profit: number
  payment: Payment
  sold_at: string
}

export interface SizeEntryDetail extends SizeEntry {
  barcode_svg: string
  recent_sales: Sale[]
  last_brand_price: number | null
}

export interface Page<T> {
  count: number
  next: string | null
  previous: string | null
  results: T[]
}

export interface RestockResult {
  batch: Batch | null
  lines: { added: number; merged: boolean; entry: SizeEntry }[]
}

export interface Ranking {
  label: string
  units: number
  revenue: number
  share: number
}

export interface Stats {
  start: string
  end: string
  inventory: { value: number; pairs: number }
  sales: { revenue: number; cost: number; profit: number; units: number }
  best_brands: Ranking[]
  best_sizes: Ranking[]
  slow_moving: { days: number; entries: SizeEntry[] }
  timeline: {
    step: 'day' | 'week' | 'month'
    points: { date: string; revenue: number; profit: number; units: number }[]
  }
}

export interface User {
  id: number
  username: string
  first_name: string
  last_name: string
}

export interface DailyReport {
  date: string
  sales: { revenue: number; cost: number; profit: number; units: number }
  sales_list: Sale[]
  by_brand: Ranking[]
  by_payment: Record<Payment, number>
  received: { code: string; brand: string; size: string; quantity: number; bought_price: number; received_at: string }[]
  received_summary: { pairs: number; value: number }
}

export interface ReportDay {
  date: string
  units: number
  revenue: number
  profit: number
  received_pairs: number
  received_value: number
}
