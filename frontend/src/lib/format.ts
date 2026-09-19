const NBSP = ' '

/**
 * 250000 -> "250,000".
 *
 * Commas, not spaces: a spaced "150 000" reads as two separate numbers at a
 * glance. The name is historical - the grouping character is a comma now.
 */
export function spaced(value: number | string | null | undefined): string {
  const digits = String(value ?? '').replace(/[^\d-]/g, '')
  if (!digits || digits === '-') return ''
  const number = Number(digits)
  const sign = number < 0 ? '−' : ''
  return sign + Math.abs(number).toLocaleString('en-US')
}

export function som(value: number, unit: string): string {
  return `${spaced(value)}${NBSP}${unit}`
}

/** Strips separators a person typed: "250 000" -> 250000. */
export function parseMoney(value: string): number | null {
  const digits = value.replace(/\D/g, '')
  return digits ? Number(digits) : null
}

const pad = (n: number) => String(n).padStart(2, '0')

export function date(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`
}

export function dateTime(iso: string): string {
  const d = new Date(iso)
  return `${date(iso)}, ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

/** Local YYYY-MM-DD, for <input type="date"> and API date params. */
export function isoDay(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

export function daysAgo(n: number): string {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return isoDay(d)
}

const WEEKDAYS = {
  uz: ['yakshanba', 'dushanba', 'seshanba', 'chorshanba', 'payshanba', 'juma', 'shanba'],
  ru: ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'],
}

/** "2026-09-17" moved by n days, as YYYY-MM-DD in local time. */
export function shiftDay(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00`)
  d.setDate(d.getDate() + n)
  return isoDay(d)
}

/** "Today, 17.09.2026" / "16.09.2026, seshanba". */
export function dayLabel(day: string, lang: 'uz' | 'ru', today: string, yesterday: string): string {
  const d = new Date(`${day}T12:00:00`)
  const numeric = date(`${day}T12:00:00`)
  const now = isoDay(new Date())
  if (day === now) return `${today}, ${numeric}`
  if (day === shiftDay(now, -1)) return `${yesterday}, ${numeric}`
  return `${numeric}, ${WEEKDAYS[lang][d.getDay()]}`
}
