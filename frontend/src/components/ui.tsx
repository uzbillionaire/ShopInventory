import { createContext, useCallback, useContext, useEffect, useRef, useState, type InputHTMLAttributes, type ReactNode } from 'react'
import { ApiError } from '../api/client'
import { useI18n } from '../i18n'
import { spaced } from '../lib/format'

export function LanguageSwitch() {
  const { lang, setLang, t } = useI18n()
  return (
    <div className="lang-switch" role="group" aria-label={t('language')}>
      <button type="button" lang="uz" title="O‘zbekcha" aria-pressed={lang === 'uz'} onClick={() => setLang('uz')}>UZ</button>
      <button type="button" lang="ru" title="Русский" aria-pressed={lang === 'ru'} onClick={() => setLang('ru')}>RU</button>
    </div>
  )
}

export function SizeChip({ size }: { size: string }) {
  const { t } = useI18n()
  return <span className="size-chip" aria-label={`${t('size')} ${size}`}>{size}</span>
}

type MoneyInputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

/** Shows "250 000" while typing; the parent keeps the formatted string. */
export function MoneyInput({ value, onValueChange, className = '', ...props }: MoneyInputProps) {
  const { t } = useI18n()
  const ref = useRef<HTMLInputElement>(null)
  return (
    <div className="money-wrap">
      <input
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        className={`input money ${className}`}
        value={value}
        onChange={(event) => {
          const input = event.target
          const fromEnd = input.value.length - (input.selectionStart ?? input.value.length)
          const next = spaced(input.value.replace(/\D/g, ''))
          onValueChange(next)
          requestAnimationFrame(() => {
            const pos = Math.max(0, next.length - fromEnd)
            ref.current?.setSelectionRange(pos, pos)
          })
        }}
        {...props}
      />
      <span className="unit">{t('som')}</span>
    </div>
  )
}

export function Loading() {
  const { t } = useI18n()
  return <p className="loading" role="status">{t('loading')}</p>
}

export function ErrorNotice({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { t } = useI18n()
  const message = error instanceof ApiError && error.status < 500 ? error.message : t('networkError')
  return (
    <div className="notice error" role="alert">
      <p>{message}</p>
      {onRetry && <button type="button" className="button small ghost" onClick={onRetry}>{t('retry')}</button>}
    </div>
  )
}

interface ToastState {
  message: string
  action?: { label: string; run: () => void }
}

const ToastContext = createContext<(toast: ToastState) => void>(() => {})

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null)
  const show = useCallback((next: ToastState) => setToast(next), [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), toast.action ? 8000 : 4000)
    return () => clearTimeout(timer)
  }, [toast])

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite">
        {toast && (
          <div className="toast">
            <span>{toast.message}</span>
            {toast.action && (
              <button type="button" onClick={() => { toast.action?.run(); setToast(null) }}>
                {toast.action.label}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast() {
  return useContext(ToastContext)
}
