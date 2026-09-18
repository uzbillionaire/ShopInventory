import { useState, type FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { ApiError } from '../api/client'
import { useAuth } from '../auth'
import { ShoeMark } from '../components/Icons'
import { LanguageSwitch } from '../components/ui'
import { useI18n } from '../i18n'

export default function Login() {
  const { t } = useI18n()
  const { loggedIn, login } = useAuth()
  const navigate = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from ?? '/'
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (loggedIn) return <Navigate to={from} replace />

  async function submit(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      await login(username.trim(), password)
      navigate(from, { replace: true })
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) setError(t('badLogin'))
      else if (err instanceof ApiError && err.status === 429) setError(t('tooManyAttempts'))
      else setError(t('networkError'))
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="login">
      <div className="login-head">
        <span className="wordmark"><ShoeMark size={24} />{t('appName')}</span>
        <LanguageSwitch />
      </div>
      <h1>{t('loginTitle')}</h1>
      <form onSubmit={submit} noValidate>
        {error && <p className="notice error" role="alert">{error}</p>}
        <div className="field">
          <label className="field-label" htmlFor="username">{t('username')}</label>
          <input id="username" className="input" value={username} onChange={(e) => setUsername(e.target.value)}
            autoComplete="username" autoCapitalize="none" autoFocus required />
        </div>
        <div className="field">
          <label className="field-label" htmlFor="password">{t('password')}</label>
          <input id="password" type="password" className="input" value={password} onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password" required />
        </div>
        <button className="button block" type="submit" disabled={busy || !username || !password}>
          {busy ? t('loggingIn') : t('logIn')}
        </button>
      </form>
    </main>
  )
}
