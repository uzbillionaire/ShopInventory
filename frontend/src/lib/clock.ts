import { useSyncExternalStore } from 'react'

// "Today" is the shop's day in Tashkent, not whatever timezone or clock a phone happens to have.
// A phone with the wrong zone or date would otherwise open yesterday's or tomorrow's numbers.
const SHOP_TIME_ZONE = 'Asia/Tashkent'

// Server time minus phone time, learned from the Date header of API responses.
let offset = 0
const listeners = new Set<() => void>()

/** Called with each API response's Date header; corrects for a phone whose clock is wrong. */
export function syncClock(serverDate: string | null) {
  const server = serverDate ? Date.parse(serverDate) : Number.NaN
  if (Number.isNaN(server)) return
  // The header has 1-second precision and arrives after network delay; only a real gap counts.
  const next = Math.abs(server - Date.now()) > 60_000 ? server - Date.now() : 0
  if (Math.abs(next - offset) < 60_000) return
  offset = next
  listeners.forEach((listener) => listener())
}

/** Today in the shop, as YYYY-MM-DD. */
export function shopToday(): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone: SHOP_TIME_ZONE }).format(new Date(Date.now() + offset))
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** shopToday() for components: re-renders if the first API response shows the phone clock was off. */
export function useShopToday(): string {
  return useSyncExternalStore(subscribe, shopToday)
}
