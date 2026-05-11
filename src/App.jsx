import { useState } from 'react'
import { useApp } from './context/AppContext.jsx'
import Home from './screens/Home.jsx'
import Vision from './screens/Vision.jsx'
import Categories from './screens/Categories.jsx'
import CategoryDetail from './screens/CategoryDetail.jsx'
import Progress from './screens/Progress.jsx'
import LanguageToggle from './components/LanguageToggle.jsx'

const SCREENS = {
  home: Home,
  vision: Vision,
  categories: Categories,
  category: CategoryDetail,
  progress: Progress
}

export default function App() {
  const { t } = useApp()
  const [screen, setScreen] = useState('home')

  const navigate = (next) => {
    setScreen(next)
    if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'instant' })
  }

  const Screen = SCREENS[screen] || Home

  return (
    <div className="min-h-full flex flex-col bg-cream">
      <header className="safe-top px-5 pt-3 pb-2 flex items-center justify-between sticky top-0 bg-cream/90 backdrop-blur z-10 border-b border-ink/5">
        <button
          onClick={() => navigate('home')}
          className="flex items-center gap-2 group"
          aria-label="home"
        >
          <span className="text-rose text-2xl leading-none group-active:scale-95 transition">✦</span>
          <span className="font-serif text-lg tracking-wide">{t.appName}</span>
        </button>
        <LanguageToggle />
      </header>

      <main className="flex-1 max-w-xl w-full mx-auto px-5 py-4 pb-28 animate-fade-in">
        <Screen navigate={navigate} />
      </main>

      <nav className="fixed bottom-0 inset-x-0 bg-cream/95 backdrop-blur border-t border-ink/5 safe-bottom">
        <div className="max-w-xl mx-auto grid grid-cols-4 text-xs">
          {[
            { id: 'home', label: t.nav.home, icon: '⌂' },
            { id: 'vision', label: t.nav.vision, icon: '✦' },
            { id: 'categories', label: t.nav.categories, icon: '☰' },
            { id: 'progress', label: t.nav.progress, icon: '◐' }
          ].map((n) => {
            const active = screen === n.id || (n.id === 'categories' && screen === 'category')
            return (
              <button
                key={n.id}
                onClick={() => navigate(n.id)}
                aria-label={n.label}
                data-nav={n.id}
                className={`py-3 flex flex-col items-center gap-0.5 transition ${
                  active ? 'text-rose' : 'text-ink/60'
                }`}
              >
                <span className="text-base leading-none" aria-hidden="true">{n.icon}</span>
                <span>{n.label}</span>
              </button>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
