import { useEffect, useState } from 'react'
import { NavLink, Route, Routes, useLocation } from 'react-router-dom'
import Overview from './pages/Overview'
import Samples from './pages/Samples'
import PopGen from './pages/PopGen'
import Sweeps from './pages/Sweeps'
import Variation from './pages/Variation'
import Browser from './pages/Browser'
import Download from './pages/Download'

const links = [
  { to: '/', label: 'Overview' },
  { to: '/samples', label: 'Samples' },
  { to: '/popgen', label: 'Population Genetics' },
  { to: '/sweeps', label: 'Selective Sweeps' },
  { to: '/variation', label: 'Variation' },
  { to: '/browser', label: 'Genome Browser' },
  { to: '/download', label: 'Download' },
]

export default function App() {
  const [navOpen, setNavOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setNavOpen(false)
  }, [location.pathname])

  useEffect(() => {
    document.body.style.overflow = navOpen ? 'hidden' : ''
    return () => {
      document.body.style.overflow = ''
    }
  }, [navOpen])

  return (
    <div className={`app-shell ${navOpen ? 'nav-open' : ''}`}>
      <header className="mobile-topbar">
        <button
          type="button"
          className="menu-toggle"
          aria-label={navOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={navOpen}
          onClick={() => setNavOpen((v) => !v)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="mobile-brand">
          <img className="mobile-brand-mark" src="/bee-logo.png" alt="" />
          <div>
            <strong>Apis WGS Atlas</strong>
            <span>2,360 samples · Amel_HAv3.1</span>
          </div>
        </div>
      </header>

      <div
        className="nav-backdrop"
        onClick={() => setNavOpen(false)}
        aria-hidden={!navOpen}
      />

      <aside className="sidebar">
        <div className="brand">
          <img className="brand-mark" src="/bee-logo.png" alt="Apis mellifera" />
          <h1>Apis WGS Atlas</h1>
          <p>Apis mellifera · 2,360 Samples · Ref: Amel_HAv3.1</p>
        </div>
        <nav className="nav">
          {links.map((l) => (
            <NavLink
              key={l.to}
              to={l.to}
              end={l.to === '/'}
              className={({ isActive }) => (isActive ? 'active' : undefined)}
            >
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot">Apis mellifera · Amel_HAv3.1</div>
      </aside>

      <main className="main">
        <Routes>
          <Route path="/" element={<Overview />} />
          <Route path="/samples" element={<Samples />} />
          <Route path="/popgen" element={<PopGen />} />
          <Route path="/sweeps" element={<Sweeps />} />
          <Route path="/variation" element={<Variation />} />
          <Route path="/browser" element={<Browser />} />
          <Route path="/download" element={<Download />} />
        </Routes>
      </main>
    </div>
  )
}
