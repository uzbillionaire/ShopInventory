const TOKENS_KEY = 'shop.tokens'
const BASE = import.meta.env.VITE_API_BASE ?? '/api'

interface Tokens {
  access: string
  refresh: string
}

/** DRF errors look like {field: [messages]} or {detail: message}. */
export class ApiError extends Error {
  status: number
  data: unknown

  constructor(status: number, data: unknown) {
    super(ApiError.describe(data) || `HTTP ${status}`)
    this.status = status
    this.data = data
  }

  field(name: string): string | undefined {
    const value = (this.data as Record<string, unknown> | null)?.[name]
    return ApiError.describe(value) || undefined
  }

  static describe(value: unknown): string {
    if (!value) return ''
    if (typeof value === 'string') return value
    if (Array.isArray(value)) return value.map(ApiError.describe).filter(Boolean).join(' ')
    if (typeof value === 'object') {
      const record = value as Record<string, unknown>
      if ('detail' in record) return ApiError.describe(record.detail)
      return Object.values(record).map(ApiError.describe).filter(Boolean).join(' ')
    }
    return String(value)
  }
}

const listeners = new Set<(value: Tokens | null) => void>()

export const tokens = {
  get(): Tokens | null {
    try {
      const raw = localStorage.getItem(TOKENS_KEY)
      return raw ? (JSON.parse(raw) as Tokens) : null
    } catch {
      return null
    }
  },
  set(value: Tokens | null) {
    try {
      if (value) localStorage.setItem(TOKENS_KEY, JSON.stringify(value))
      else localStorage.removeItem(TOKENS_KEY)
    } catch {
      /* storage unavailable: the session lasts until reload */
    }
    listeners.forEach((listener) => listener(value))
  },
}

export function onTokensChange(listener: (value: Tokens | null) => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

let language = 'uz'
export function setApiLanguage(code: string) {
  language = code
}

let refreshing: Promise<boolean> | null = null

function refreshAccess(): Promise<boolean> {
  const current = tokens.get()
  if (!current) return Promise.resolve(false)
  refreshing ??= fetch(`${BASE}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: current.refresh }),
  })
    .then(async (response) => {
      if (!response.ok) return false
      const data = await response.json()
      tokens.set({ access: data.access, refresh: data.refresh ?? current.refresh })
      return true
    })
    .catch(() => false)
    .finally(() => {
      refreshing = null
    })
  return refreshing
}

type Body = FormData | object | undefined
interface RequestOptions {
  method?: string
  body?: Body
}

async function send(path: string, init: RequestOptions, retry = true): Promise<Response> {
  const headers: Record<string, string> = { 'Accept-Language': language }
  const access = tokens.get()?.access
  if (access) headers.Authorization = `Bearer ${access}`

  let body: BodyInit | undefined
  if (init.body instanceof FormData) body = init.body
  else if (init.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(init.body)
  }

  const response = await fetch(`${BASE}${path}`, { method: init.method ?? 'GET', headers, body })
  if (response.status === 401 && retry && access) {
    if (await refreshAccess()) return send(path, init, false)
    tokens.set(null)
  }
  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(response.status, data)
  }
  return response
}

export async function api<T>(path: string, init: RequestOptions = {}): Promise<T> {
  const response = await send(path, init)
  if (response.status === 204) return undefined as T
  return response.json() as Promise<T>
}

/** Fetch a file with auth and hand it to the browser as a download. */
export async function download(path: string, init: RequestOptions = {}) {
  const response = await send(path, init)
  const blob = await response.blob()
  const disposition = response.headers.get('Content-Disposition') ?? ''
  const name = /filename="([^"]+)"/.exec(disposition)?.[1] ?? 'download'
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = name
  document.body.append(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

export async function login(username: string, password: string) {
  const response = await fetch(`${BASE}/auth/token/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Accept-Language': language },
    body: JSON.stringify({ username, password }),
  })
  const data = await response.json().catch(() => null)
  if (!response.ok) throw new ApiError(response.status, data)
  tokens.set({ access: data.access, refresh: data.refresh })
}

export function logout() {
  tokens.set(null)
}
