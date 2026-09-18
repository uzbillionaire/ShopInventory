import { Link, NavLink, Outlet, useLocation } from 'react-router'
import { useAuth } from '../auth'
import { useI18n } from '../i18n'
import { ChartIcon, ListIcon, LogoutIcon, PlusIcon, ScanIcon, ShoeMark, TagIcon } from './Icons'
import { LanguageSwitch } from './ui'

export default function Layout() {
  const { t } = useI18n()
  const { logout } = useAuth()
  const { pathname } = useLocation()
  const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : undefined)

  return (
    <div className="app">
      <header className="topbar">
        <Link className="wordmark" to="/">
          <ShoeMark />
          {t('appName')}
        </Link>
        <div className="topbar-tools">
          <LanguageSwitch />
          <button type="button" className="icon-button" title={t('logOut')} onClick={logout}>
            <LogoutIcon size={22} />
            <span className="visually-hidden">{t('logOut')}</span>
          </button>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <nav className="nav" aria-label={t('mainMenu')}>
        <ul>
          <li><NavLink to="/" end className={({ isActive }) => (isActive || pathname.startsWith('/e/') ? 'active' : undefined)}><ListIcon />{t('navStock')}</NavLink></li>
          <li><NavLink to="/add" className={navClass}><PlusIcon />{t('navAdd')}</NavLink></li>
          <li className="scan-tab">
            <NavLink to="/scan" className={navClass}>
              <span className="scan-disc"><ScanIcon size={28} /></span>
              {t('navScan')}
            </NavLink>
          </li>
          <li><NavLink to="/labels" className={navClass}><TagIcon />{t('navLabels')}</NavLink></li>
          <li><NavLink to="/stats" className={({ isActive }) => (isActive || pathname === '/export' || pathname.startsWith('/reports') ? 'active' : undefined)}><ChartIcon />{t('navStats')}</NavLink></li>
        </ul>
      </nav>
    </div>
  )
}
